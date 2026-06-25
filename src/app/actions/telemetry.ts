"use server";

import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getAssetById, updateAssetStatusTransaction } from "../../lib/dao";
import { docClient } from "../../lib/dynamodb";
import { getTenantContext } from "../../lib/auth";

import { env } from "../../lib/env";

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

/**
 * Fetch all assets for a given tenant
 */
export async function getAssets(tenantId: string) {
  let activeTenantId = tenantId;
  try {
    const context = await getTenantContext();
    if (context.tenantId) {
      activeTenantId = context.tenantId;
    }
  } catch (e) {
    console.warn("[getAssets] Fallback to client tenantId:", tenantId);
  }

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `TENANT#${activeTenantId}`,
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
  let activeTenantId = tenantId;
  try {
    const context = await getTenantContext();
    if (context.tenantId) {
      activeTenantId = context.tenantId;
    }
  } catch (e) {
    console.warn("[getCrossAssetAlerts] Fallback to client tenantId:", tenantId);
  }

  // Query both CRITICAL and WARNING concurrently via our new Sparse Index
  const queryAlerts = async (riskLevel: string) => {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2-SparseWorkflow",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${activeTenantId}#ALERT#${riskLevel}`
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
  let activeTenantId = tenantId;
  let actorId = "ADMIN_123";
  let actorName = "Security Administrator";
  try {
    const context = await getTenantContext();
    if (context.tenantId) {
      activeTenantId = context.tenantId;
      actorId = context.userId || actorId;
    }
  } catch (e) {
    console.warn("[isolateAsset] Fallback to client tenantId:", tenantId);
  }

  // 1. Idempotency Check: Fetch the asset first
  const asset = await getAssetById(activeTenantId, assetId);
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
      tenantId: activeTenantId,
      assetId,
      newStatus: "ISOLATED",
      assignedEmployeeId: asset.EmployeeId,
      assignedEmployeeName: asset.EmployeeName,
      actorId,
      actorName,
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
