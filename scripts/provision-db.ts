import dotenv from "dotenv";
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  UpdateTimeToLiveCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

dotenv.config({ path: ".env.local" });

const isLocal = process.env.DB_LOCAL === "true";
const tableName = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

// Initialize client based on target environment
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined,
});

async function waitForTableActive(name: string, maxWaitSecs = 90) {
  console.log(`⏳ Waiting for table "${name}" to become ACTIVE (up to ${maxWaitSecs}s)...`);
  const deadline = Date.now() + maxWaitSecs * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await client.send(new DescribeTableCommand({ TableName: name }));
    const status = res.Table?.TableStatus;
    if (status === "ACTIVE") {
      console.log(`✅ Table is ACTIVE.`);
      return;
    }
    console.log(`   Status: ${status} — waiting...`);
  }
  throw new Error(`Table did not become ACTIVE within ${maxWaitSecs}s`);
}

async function enableTTL() {
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "TTL" },
      })
    );
    console.log("✅ TTL enabled on attribute 'TTL'.");
  } catch (ttlError: any) {
    // "already enabled" is not a real error
    if (ttlError?.message?.includes("already")) {
      console.log("ℹ️ TTL already enabled.");
    } else {
      console.error("⚠️ Could not enable TTL:", ttlError?.message);
    }
  }
}

async function provision() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");

  if (shouldReset && isLocal) {
    console.log(`⚠️ Reset flag detected. Tearing down table: ${tableName}...`);
    try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      console.log("✅ Old table deleted.");
    } catch (e) {
      console.log("ℹ️ Table did not exist yet. Proceeding to creation.");
    }
  }

  console.log(`🚀 Provisioning DynamoDB table "${tableName}" (Local Mode: ${isLocal})...`);

  const command = new CreateTableCommand({
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
      { AttributeName: "GSI2PK", AttributeType: "S" },
      { AttributeName: "GSI2SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1-OverloadIndex",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "GSI2-SparseWorkflow",
        KeySchema: [
          { AttributeName: "GSI2PK", KeyType: "HASH" },
          { AttributeName: "GSI2SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    SSESpecification: {
      Enabled: true,
      SSEType: "KMS",
      KMSMasterKeyId: process.env.AWS_KMS_KEY_ARN || undefined,
    },
  });

  try {
    await client.send(command);
    console.log(`🎉 Table "${tableName}" create request accepted.`);

    // Wait for ACTIVE before enabling TTL (production AWS needs ~5-10s)
    if (!isLocal) {
      await waitForTableActive(tableName);
    }

    await enableTTL();
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      console.log(`ℹ️ Table already exists — applying TTL idempotently.`);
      if (!isLocal) {
        await waitForTableActive(tableName).catch(() => {});
      }
      await enableTTL();
    } else {
      console.error("❌ Provisioning failed:", error.message || error);
      process.exit(1);
    }
  }
}

provision();
