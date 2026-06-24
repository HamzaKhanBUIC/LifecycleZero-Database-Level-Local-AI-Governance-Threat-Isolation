"use server";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getAssetById, updateAssetStatusTransaction } from "../../lib/dao";

const isLocal = process.env.DB_LOCAL === "true";
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

/**
 * Fetch all assets for a given tenant
 */
export async function getAssets(tenantId: string) {
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

/**
 * Fetch cross-asset telemetry alerts using GSI2 (Sparse Index)
 */
export async function getCrossAssetAlerts(tenantId: string = "org_demo_123") {
  // Query both CRITICAL and WARNING concurrently via our new Sparse Index
  const queryAlerts = async (riskLevel: string) => {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2-SparseWorkflow",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#ALERT#${riskLevel}`
      },
      ScanIndexForward: false, // newest first
      Limit: 20
    });
    const response = await docClient.send(command);
    return response.Items || [];
  };

  const [criticals, warnings] = await Promise.all([
    queryAlerts("CRITICAL"),
    queryAlerts("WARNING")
  ]);

  // Merge and sort in memory by timestamp descending
  const combined = [...criticals, ...warnings].sort((a, b) => 
    new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
  );

  return combined.slice(0, 20);
}

/**
 * Isolate an asset immediately, writing to the audit log.
 */
export async function isolateAsset(tenantId: string, assetId: string) {
  // 1. Idempotency Check: Fetch the asset first
  const asset = await getAssetById(tenantId, assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found.`);
  }

  // If already isolated, return early (idempotency)
  if (asset.Status === "ISOLATED") {
    return { success: true, message: "Asset is already isolated." };
  }

  // 2. Execute Transaction
  try {
    await updateAssetStatusTransaction({
      tenantId,
      assetId,
      newStatus: "ISOLATED",
      assignedEmployeeId: asset.EmployeeId,
      assignedEmployeeName: asset.EmployeeName,
      actorId: "ADMIN_123", // In a real app, get this from Clerk/Auth
      actorName: "Security Administrator",
      action: "EMERGENCY_ISOLATION",
      details: "Asset isolated due to critical anomalous behavior detected by local AI engine."
    });

    return { success: true, message: `Asset ${assetId} has been successfully isolated.` };
  } catch (error: any) {
    console.error(`❌ Isolation transaction failed for asset ${assetId}:`, error);
    return { 
      success: false, 
      error: error.message || "An unexpected database error occurred during isolation." 
    };
  }
}
