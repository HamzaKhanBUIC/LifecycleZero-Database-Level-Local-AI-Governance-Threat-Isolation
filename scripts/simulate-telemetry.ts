import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
import { evaluateTelemetryRisk } from "../src/lib/ai";

dotenv.config({ path: ".env.local" });

const isLocal = process.env.DB_LOCAL === "true";
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

// Sample processes that might be running locally
const BENIGN_PROCESSES = ["chrome.exe", "vscode.exe", "docker", "slack", "zoom"];
const AGENTIC_PROCESSES = ["llama.cpp", "ollama", "copilot-local", "jan.ai", "lmstudio"];
const SENSITIVE_FILES = ["payroll_2026.xlsx", "q3_roadmap_confidential.pdf", "customer_pii.csv", "auth_tokens.json"];
const BENIGN_FILES = ["notes.txt", "design_draft.png", "node_modules", "temp.log"];

async function getActiveAssets(tenantId: string) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `TENANT#${tenantId}`,
      ":skPrefix": "ASSET#",
    },
  });
  const response = await docClient.send(command);
  return response.Items || [];
}

async function simulateTelemetryEvent(tenantId: string, assetId: string) {
  const timestamp = new Date().toISOString();
  
  // Decide if this event is benign or agentic
  const isAgentic = Math.random() < 0.15; // 15% chance to run a local AI agent
  
  const processName = isAgentic 
    ? AGENTIC_PROCESSES[Math.floor(Math.random() * AGENTIC_PROCESSES.length)]
    : BENIGN_PROCESSES[Math.floor(Math.random() * BENIGN_PROCESSES.length)];
    
  // If agentic, chance of accessing sensitive files
  const filesAccessed: string[] = [];
  if (isAgentic && Math.random() < 0.2) {
    filesAccessed.push(SENSITIVE_FILES[Math.floor(Math.random() * SENSITIVE_FILES.length)]);
  } else if (!isAgentic && Math.random() < 0.3) {
    filesAccessed.push(BENIGN_FILES[Math.floor(Math.random() * BENIGN_FILES.length)]);
  }

  const cpuUsage = Math.floor(Math.random() * 100);
  const ramUsage = Math.floor(Math.random() * 64); // up to 64GB
  const networkEgress = Math.floor(Math.random() * 1000); // up to 1000MB

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

  // Run AI evaluation
  console.log(`[EVALUATING] Asset: ${assetId} | Process: ${processName}...`);
  const aiResult = await evaluateTelemetryRisk(baseTelemetry as any);

  // 90 days TTL
  const ttlEpoch = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

  const telemetry: any = {
    ...baseTelemetry,
    RiskLevel: aiResult.riskLevel,
    AiAnalysis: aiResult.reasoning,
    TTL: ttlEpoch,
  };

  // Populate GSI2 (Sparse Index) for CRITICAL/WARNING
  if (aiResult.riskLevel === "CRITICAL" || aiResult.riskLevel === "WARNING") {
    telemetry.GSI2PK = `TENANT#${tenantId}#ALERT#${aiResult.riskLevel}`;
    telemetry.GSI2SK = `DATE#${timestamp}`;
  }

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: telemetry
  }));
  
  console.log(`[TELEMETRY SENT] Asset: ${assetId} | Risk: ${aiResult.riskLevel} | Reason: ${aiResult.reasoning}`);
}

async function startSimulation() {
  console.log("🚀 Starting Agentic Telemetry Simulation...");
  const tenantId = "org_demo_123"; // Default mock tenant from seed
  
  const assets = await getActiveAssets(tenantId);
  if (assets.length === 0) {
    console.error("❌ No assets found. Did you run the seed script first? (npm run db:provision-local)");
    return;
  }
  console.log(`📡 Found ${assets.length} assets. Beginning real-time stream...`);

  // Infinite loop sending random telemetry every 1-3 seconds
  while (true) {
    const randomAsset = assets[Math.floor(Math.random() * assets.length)];
    await simulateTelemetryEvent(tenantId, randomAsset.AssetId);
    
    // Random delay between 5000ms and 10000ms to save API quotas
    const delay = Math.floor(Math.random() * 5000) + 5000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

startSimulation().catch(console.error);
