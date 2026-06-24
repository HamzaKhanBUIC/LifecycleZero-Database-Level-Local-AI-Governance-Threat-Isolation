import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DeleteTableCommand,
  UpdateTimeToLiveCommand
} from "@aws-sdk/client-dynamodb";

const isLocal = process.env.DB_LOCAL === "true";
const tableName = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

// Initialize client based on target environment
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined
});

async function provision() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");

  if (shouldReset && isLocal) {
    console.log(`⚠️ Reset flag detected. Teardown table: ${tableName}...`);
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
    BillingMode: "PAY_PER_REQUEST", // On-Demand capacity for zero-cost maintenance
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
      { AttributeName: "GSI2PK", AttributeType: "S" },
      { AttributeName: "GSI2SK", AttributeType: "S" }
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1-OverloadIndex",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" }
        ],
        Projection: { ProjectionType: "ALL" } // Fixes fetch amplification
      },
      {
        IndexName: "GSI2-SparseWorkflow",
        KeySchema: [
          { AttributeName: "GSI2PK", KeyType: "HASH" },
          { AttributeName: "GSI2SK", KeyType: "RANGE" }
        ],
        Projection: { ProjectionType: "ALL" }
      }
    ]
  });

  try {
    await client.send(command);
    console.log(`🎉 Table "${tableName}" successfully created and ready for access patterns.`);
    
    // Enable TTL
    console.log("⏳ Enabling TTL on attribute 'TTL'...");
    try {
      await client.send(new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: "TTL"
        }
      }));
      console.log("✅ TTL enabled.");
    } catch (ttlError) {
      console.error("⚠️ Could not enable TTL (might not be supported in local mode):", ttlError);
    }
    
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      console.error("❌ Table already exists. Run with '--reset' locally to wipe and recreate.");
    } else {
      console.error("❌ Provisioning failed:", error);
    }
  }
}

provision();
