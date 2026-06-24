import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { evaluateTelemetryRisk } from "../src/lib/ai";

dotenv.config({ path: ".env.local" });

const QUEUE_FILE_PATH = path.join(process.cwd(), "scratch", "sqs-fallback-queue.json");
const TABLE_NAME = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

// DynamoDB initialization
const isLocal = process.env.DB_LOCAL === "true";
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// SQS Client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

async function processTelemetryItem(payload: any) {
  const { tenantId, assetId, processName, filesAccessed, cpuUsage, ramUsage, networkEgress, timestamp } = payload;
  
  const baseTelemetry = {
    PK: `TENANT#${tenantId}`,
    SK: `TELEMETRY#${assetId}#${timestamp}`,
    AssetId: assetId,
    Timestamp: timestamp,
    ProcessName: processName,
    FilesAccessed: filesAccessed,
    CpuUsage: cpuUsage,
    RamUsage: ramUsage,
    NetworkEgress: networkEgress,
    GSI1PK: `ASSET#${assetId}`,
    GSI1SK: `DATE#${timestamp}`,
  };

  // Evaluate risk level via Bedrock
  console.log(`[WORKER] Evaluating threat behavior for ${assetId}...`);
  const aiResult = await evaluateTelemetryRisk(baseTelemetry as any);

  // 90 days TTL
  const ttlEpoch = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

  const telemetry: any = {
    ...baseTelemetry,
    RiskLevel: aiResult.riskLevel,
    AiAnalysis: aiResult.reasoning,
    TTL: ttlEpoch,
  };

  // Populate Sparse Index for Alerts
  if (aiResult.riskLevel === "CRITICAL" || aiResult.riskLevel === "WARNING") {
    telemetry.GSI2PK = `TENANT#${tenantId}#ALERT#${aiResult.riskLevel}`;
    telemetry.GSI2SK = `DATE#${timestamp}`;
  }

  // Write to DynamoDB
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: telemetry
  }));

  console.log(`[WORKER SUCCESS] Processed event for ${assetId}. Risk: ${aiResult.riskLevel} - ${aiResult.reasoning}`);
}

async function pollLocalQueue() {
  if (!fs.existsSync(QUEUE_FILE_PATH)) return;

  try {
    const content = fs.readFileSync(QUEUE_FILE_PATH, "utf-8");
    const queue = JSON.parse(content);
    if (queue.length === 0) return;

    console.log(`[WORKER] Found ${queue.length} messages in local fallback queue.`);
    
    // Process messages sequentially
    for (const msg of queue) {
      const payload = JSON.parse(msg.Body);
      try {
        await processTelemetryItem(payload);
      } catch (err) {
        console.error(`[WORKER ERROR] Failed to process message ${msg.MessageId}:`, err);
      }
    }

    // Clear queue file
    fs.writeFileSync(QUEUE_FILE_PATH, JSON.stringify([], null, 2), "utf-8");
    console.log(`[WORKER] Cleared fallback queue file.`);
  } catch (err) {
    console.error("Local queue processing failed:", err);
  }
}

async function pollAwsQueue() {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    console.error("❌ SQS_QUEUE_URL missing in production env.");
    return;
  }

  try {
    const response = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 5
    }));

    const messages = response.Messages || [];
    if (messages.length === 0) return;

    console.log(`[WORKER] Retrieved ${messages.length} messages from AWS SQS.`);

    for (const msg of messages) {
      if (!msg.Body) continue;
      
      const payload = JSON.parse(msg.Body);
      try {
        await processTelemetryItem(payload);
        
        // Delete message after successful processing
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle
        }));
      } catch (err) {
        console.error(`[WORKER ERROR] Processing failed for SQS message ${msg.MessageId}:`, err);
      }
    }
  } catch (err) {
    console.error("AWS SQS queue polling failed:", err);
  }
}

async function startWorker() {
  console.log("👷 Telemetry Queue Worker starting up...");
  if (isLocal) {
    console.log(`📡 Mode: Local File System Queue (${QUEUE_FILE_PATH})`);
  } else {
    console.log(`📡 Mode: AWS SQS Queue (${process.env.SQS_QUEUE_URL})`);
  }

  while (true) {
    if (isLocal) {
      await pollLocalQueue();
    } else {
      await pollAwsQueue();
    }
    
    // Poll every 1.5 seconds
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

startWorker().catch(console.error);
