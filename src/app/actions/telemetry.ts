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
export async function isolateAsset(tenantId: string, assetId: string, reason?: string) {
  let activeTenantId = tenantId;
  let actorId = "ADMIN_123";
  const actorName = "Security Administrator";
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
      details: reason || "Asset isolated due to critical anomalous behavior detected by local AI engine."
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

/**
 * Restore an asset from isolation, writing to the audit log.
 */
export async function restoreAsset(tenantId: string, assetId: string) {
  let activeTenantId = tenantId;
  let actorId = "ADMIN_123";
  const actorName = "Security Administrator";
  try {
    const context = await getTenantContext();
    if (context.tenantId) {
      activeTenantId = context.tenantId;
      actorId = context.userId || actorId;
    }
  } catch (e) {
    console.warn("[restoreAsset] Fallback to client tenantId:", tenantId);
  }

  const asset = await getAssetById(activeTenantId, assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found.`);
  }

  if (asset.Status === "ACTIVE") {
    return { success: true, message: "Asset is already active." };
  }

  try {
    await updateAssetStatusTransaction({
      tenantId: activeTenantId,
      assetId,
      newStatus: "ACTIVE",
      assignedEmployeeId: asset.EmployeeId,
      assignedEmployeeName: asset.EmployeeName,
      actorId,
      actorName,
      action: "RESTORE_FROM_ISOLATION",
      details: "Asset restored from isolation by administrator. Connectivity and access restored."
    });

    return { success: true, message: `Asset ${assetId} has been successfully restored.` };
  } catch (error: any) {
    console.error(`❌ Restore transaction failed for asset ${assetId}:`, error);
    return { 
      success: false, 
      error: error.message || "An unexpected database error occurred during restoration." 
    };
  }
}

/**
 * Bulk-isolate multiple assets in parallel.
 * Runs N concurrent DynamoDB TransactWrite operations, one per asset.
 * Returns a per-asset result summary so the UI can show which succeeded.
 *
 * This is the "select 5 devices, isolate all" enterprise capability — it
 * demonstrates that our isolation plane is fully programmatic, not manual.
 */
export async function bulkIsolateAssets(
  tenantId: string,
  assetIds: string[]
): Promise<{
  totalRequested: number;
  succeeded: string[];
  failed: Array<{ assetId: string; reason: string }>;
  alreadyIsolated: string[];
}> {
  if (!assetIds || assetIds.length === 0) {
    return { totalRequested: 0, succeeded: [], failed: [], alreadyIsolated: [] };
  }

  let activeTenantId = tenantId;
  let actorId = "ADMIN_123";
  const actorName = "Security Administrator";
  try {
    const context = await getTenantContext();
    if (context.tenantId) {
      activeTenantId = context.tenantId;
      actorId = context.userId || actorId;
    }
  } catch (e) {
    console.warn("[bulkIsolateAssets] Fallback to client tenantId:", tenantId);
  }

  const results = await Promise.allSettled(
    assetIds.map(async (assetId) => {
      const asset = await getAssetById(activeTenantId, assetId);
      if (!asset) throw new Error("NOT_FOUND");
      if (asset.Status === "ISOLATED") throw new Error("ALREADY_ISOLATED");

      await updateAssetStatusTransaction({
        tenantId: activeTenantId,
        assetId,
        newStatus: "ISOLATED",
        assignedEmployeeId: asset.EmployeeId,
        assignedEmployeeName: asset.EmployeeName,
        actorId,
        actorName,
        action: "BULK_EMERGENCY_ISOLATION",
        details: `Asset isolated as part of a bulk containment operation against ${assetIds.length} devices.`
      });

      return assetId;
    })
  );

  const succeeded: string[] = [];
  const failed: Array<{ assetId: string; reason: string }> = [];
  const alreadyIsolated: string[] = [];

  results.forEach((result, idx) => {
    const assetId = assetIds[idx];
    if (result.status === "fulfilled") {
      succeeded.push(assetId);
    } else {
      const reason = (result as PromiseRejectedResult).reason?.message || "Unknown error";
      if (reason === "ALREADY_ISOLATED") {
        alreadyIsolated.push(assetId);
      } else {
        failed.push({ assetId, reason });
      }
    }
  });

  console.log(
    `[bulkIsolateAssets] Requested: ${assetIds.length}, Succeeded: ${succeeded.length}, ` +
    `Already isolated: ${alreadyIsolated.length}, Failed: ${failed.length}`
  );

  return { totalRequested: assetIds.length, succeeded, failed, alreadyIsolated };
}
