"use server";

import { revalidatePath } from "next/cache";
import { QueryCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getTenantContext } from "@/lib/auth";
import { docClient } from "@/lib/dynamodb";
import { env } from "@/lib/env";
import { 
  getAssetById, 
  updateAssetStatusTransaction, 
  submitProcurementRequest, 
  resolveProcurementRequest,
  createHardwareAsset,
  getTenantOllamaConfig,
  updateTenantOllamaConfig,
  getTenantMetadata
} from "@/lib/dao";
import { HardwareAsset, ProcurementRequest, Tenant, Employee, AuditLog } from "@/lib/types";

/**
 * Helper function to retrieve authenticated operator name from Clerk.
 */
async function getActorName(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const tenantCookie = cookieStore.get("lifecycle_tenant_id")?.value;
    const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
    const isSandbox = allowedSandboxTenants.includes(tenantCookie || "");

    if (isSandbox) {
      return "Demo Administrator";
    }

    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (
      process.env.NEXT_PUBLIC_SKIP_CLERK !== "true" &&
      pubKey?.startsWith("pk_")
    ) {
      const { currentUser } = await import('@clerk/nextjs/server');
      const user = await currentUser();
      if (user) return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Authenticated Operator";
    }
  } catch (err) {
    console.warn("Failed to retrieve actor name, defaulting to Demo Administrator:", err);
  }
  return "Demo Administrator";
}

/**
 * Fetch all assets for a given tenant
 */
export async function getAssets(tenantId: string) {
  const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");
  // Only override tenantId from auth context when Clerk is active (not in demo/skip mode)
  let activeTenantId = tenantId;
  if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        activeTenantId = context.tenantId;
      }
    } catch {
      console.warn("[getAssets] Fallback to client tenantId:", tenantId);
    }
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
  const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");
  // Only override tenantId from auth context when Clerk is active (not in demo/skip mode)
  let activeTenantId = tenantId;
  if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        activeTenantId = context.tenantId;
      }
    } catch {
      console.warn("[getCrossAssetAlerts] Fallback to client tenantId:", tenantId);
    }
  }

  const queryAlerts = async (riskLevel: string) => {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2-SparseWorkflow",
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": `TENANT#${activeTenantId}#ALERT#${riskLevel}`,
      },
    });
    const res = await docClient.send(command);
    return res.Items || [];
  };

  const [criticalAlerts, warningAlerts] = await Promise.all([
    queryAlerts("CRITICAL"),
    queryAlerts("WARNING")
  ]);

  return [...criticalAlerts, ...warningAlerts];
}

/**
 * Isolate an asset, writing to the audit log.
 */
export async function isolateAsset(tenantId: string, assetId: string, reason?: string) {
  let activeTenantId = tenantId;
  let actorId = "ADMIN_123";
  const actorName = await getActorName();
  if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        activeTenantId = context.tenantId;
        actorId = context.userId || actorId;
      }
    } catch {
      console.warn("[isolateAsset] Fallback to client tenantId:", tenantId);
    }
  } else {
    // In demo mode, get actorId from mock context
    actorId = "user_mock_admin";
  }

  const asset = await getAssetById(activeTenantId, assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found.`);
  }

  if (asset.Status === "ISOLATED") {
    return { success: true, message: "Asset is already isolated." };
  }

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
  const actorName = await getActorName();
  if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        activeTenantId = context.tenantId;
        actorId = context.userId || actorId;
      }
    } catch {
      console.warn("[restoreAsset] Fallback to client tenantId:", tenantId);
    }
  } else {
    actorId = "user_mock_admin";
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
  if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        activeTenantId = context.tenantId;
        actorId = context.userId || actorId;
      }
    } catch {
      console.warn("[bulkIsolateAssets] Fallback to client tenantId:", tenantId);
    }
  } else {
    actorId = "user_mock_admin";
  }

  const results = await Promise.allSettled(
    assetIds.map(async (assetId) => {
      const asset = await getAssetById(activeTenantId, assetId);
      if (!asset) throw new Error("NOT_FOUND");

      if (asset.Status === "ISOLATED") {
        return { assetId, status: "ALREADY_ISOLATED" };
      }

      await updateAssetStatusTransaction({
        tenantId: activeTenantId,
        assetId,
        newStatus: "ISOLATED",
        assignedEmployeeId: asset.EmployeeId,
        assignedEmployeeName: asset.EmployeeName,
        actorId,
        actorName,
        action: "EMERGENCY_ISOLATION",
        details: "Asset bulk isolated due to system administrator directive."
      });

      return { assetId, status: "SUCCESS" };
    })
  );

  const succeeded: string[] = [];
  const alreadyIsolated: string[] = [];
  const failed: Array<{ assetId: string; reason: string }> = [];

  results.forEach((res, index) => {
    const assetId = assetIds[index];
    if (res.status === "fulfilled") {
      const val = res.value;
      if (val.status === "ALREADY_ISOLATED") {
        alreadyIsolated.push(assetId);
      } else {
        succeeded.push(assetId);
      }
    } else {
      failed.push({
        assetId,
        reason: res.reason?.message || "Database transaction error."
      });
    }
  });

  return {
    totalRequested: assetIds.length,
    succeeded,
    failed,
    alreadyIsolated
  };
}

/**
 * Server action to simulate an agent going silent by setting LastHeartbeat to 10 minutes ago.
 */
export async function simulateSilentHost(tenantId: string, assetId: string) {
  const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");
  const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` },
      UpdateExpression: "SET LastHeartbeat = :ts",
      ExpressionAttributeValues: {
        ":ts": timestamp
      }
    }));
    
    console.log(`[SIMULATION] Set asset ${assetId} heartbeat to silent: ${timestamp}`);
    return { success: true, message: `Successfully simulated agent silence on ${assetId}.` };
  } catch (error: any) {
    console.error("Failed to simulate silent agent:", error);
    return { success: false, error: error.message || "Database update failed." };
  }
}

/**
 * Update the status of an asset
 */
export async function updateAssetStatusAction(params: {
  assetId: string;
  newStatus: HardwareAsset['Status'];
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  action: string;
  details: string;
}) {
  try {
    const { tenantId, userId } = await getTenantContext();
    const userName = await getActorName();

    await updateAssetStatusTransaction({
      tenantId,
      assetId: params.assetId,
      newStatus: params.newStatus,
      assignedEmployeeId: params.assignedEmployeeId,
      assignedEmployeeName: params.assignedEmployeeName,
      actorId: userId || "SYSTEM",
      actorName: userName,
      action: params.action,
      details: params.details
    });

    revalidatePath(`/dashboard/assets/${params.assetId}`);
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("❌ updateAssetStatusAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit a procurement request
 */
export async function createRequestAction(data: {
  assetName: string;
  type: ProcurementRequest['Type'];
  department: string;
}) {
  try {
    const { tenantId, userId } = await getTenantContext();
    const userName = await getActorName();
    const requestId = `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    await submitProcurementRequest(tenantId, {
      RequestId: requestId,
      RequesterId: userId || "SYSTEM",
      RequesterName: userName,
      AssetName: data.assetName,
      Type: data.type,
      Department: data.department
    });

    revalidatePath('/dashboard/procurement');
    revalidatePath('/dashboard');
    return { success: true, requestId };
  } catch (error: any) {
    console.error("❌ createRequestAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve a procurement request (Approve/Reject)
 */
export async function resolveRequestAction(requestId: string, decision: 'APPROVED' | 'REJECTED') {
  try {
    const { tenantId, userId } = await getTenantContext();
    const userName = await getActorName();

    const result = await resolveProcurementRequest(
      tenantId,
      requestId,
      decision,
      userId || "SYSTEM",
      userName
    );

    revalidatePath('/dashboard/procurement');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true, ...result };
  } catch (error: any) {
    console.error("❌ resolveRequestAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Seed sample data for active tenant sandbox
 */
export async function seedActiveTenantAction(tenantIdOverride?: string) {
  const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");
  try {
    let tenantId = tenantIdOverride;
    if (!tenantId) {
      const context = await getTenantContext();
      tenantId = context.tenantId;
    }

    const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
    if (!allowedSandboxTenants.includes(tenantId)) {
      throw new Error("Sandbox seeding/resetting is restricted to sandbox demo tenants only.");
    }
    const timestamp = new Date().toISOString();

    console.log(`🌱 Seeding active tenant: ${tenantId}`);

    // 1. Create/Update Tenant metadata (just in case)
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: "METADATA",
        TenantName: "Sandbox Enterprise",
        TenantSlug: "sandbox-ent",
        CreatedAt: timestamp,
        Status: "ACTIVE",
        Plan: "ENTERPRISE",
        MaxAllowedEndpoints: 150,
        StripeCustomerId: "cus_live_sandbox123",
        StripeSubscriptionId: "sub_live_sandbox123"
      } as Tenant
    }));

    // 2. Seed Employees
    const employees: Employee[] = [
      {
        PK: `TENANT#${tenantId}`,
        SK: "EMP#emp_john",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        Email: "john@sandbox.com",
        Department: "Engineering",
        Role: "Principal Architect",
        GSI1PK: "DEPT#Engineering",
        GSI1SK: "EMP#emp_john"
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "EMP#emp_sarah",
        EmployeeId: "emp_sarah",
        EmployeeName: "Sarah Connor",
        Email: "sarah@sandbox.com",
        Department: "Operations",
        Role: "Security Operations Manager",
        GSI1PK: "DEPT#Operations",
        GSI1SK: "EMP#emp_sarah"
      }
    ];

    for (const emp of employees) {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: emp }));
    }

    // 3. Seed Assets
    const assets: HardwareAsset[] = [
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-M3PRO-001",
        AssetId: "AST-M3PRO-001",
        AssetName: "MacBook Pro 16\" M3 Pro",
        SerialNo: "SN-C02F12345678",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        GSI1PK: "EMP#emp_john",
        GSI1SK: "STATE#ACTIVE",
        LastHeartbeat: timestamp,
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-M3AIR-003",
        AssetId: "AST-M3AIR-003",
        AssetName: "MacBook Air 13\" M3",
        SerialNo: "SN-C02G87654321",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_sarah",
        EmployeeName: "Sarah Connor",
        GSI1PK: "EMP#emp_sarah",
        GSI1SK: "STATE#ACTIVE",
        LastHeartbeat: timestamp,
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-M3MAX-777",
        AssetId: "AST-M3MAX-777",
        AssetName: "MacBook Pro 16\" M3 Max",
        SerialNo: "SN-M3MAX777",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        GSI1PK: "EMP#emp_john",
        GSI1SK: "STATE#ACTIVE",
        LastHeartbeat: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-THINK-888",
        AssetId: "AST-THINK-888",
        AssetName: "Lenovo ThinkPad X1 Carbon",
        SerialNo: "SN-THINK888",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_sarah",
        EmployeeName: "Sarah Connor",
        GSI1PK: "EMP#emp_sarah",
        GSI1SK: "STATE#ACTIVE",
        LastHeartbeat: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-WIPE-999",
        AssetId: "AST-WIPE-999",
        AssetName: "iPad Pro 12.9\"",
        SerialNo: "SN-IPAD999",
        Type: "MOBILE",
        Status: "OFFBOARDING",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        GSI1PK: "EMP#emp_john",
        GSI1SK: "STATE#OFFBOARDING",
        GSI2PK: `TENANT#${tenantId}#ACTION_REQ`,
        GSI2SK: `DATE#${timestamp}`,
        UpdatedAt: timestamp
      }
    ];

    for (const asset of assets) {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: asset }));
    }

    // 4. Seed Procurement Requests
    const request: ProcurementRequest = {
      PK: `TENANT#${tenantId}`,
      SK: "PROCURE#REQ-SANDBOX-101",
      RequestId: "REQ-SANDBOX-101",
      RequesterId: "emp_sarah",
      RequesterName: "Sarah Connor",
      AssetName: "Dell UltraSharp 38\" Curved Monitor",
      Type: "MONITOR",
      Department: "Operations",
      Status: "PENDING",
      CreatedAt: timestamp,
      GSI1PK: "DEPT#Operations",
      GSI1SK: `DATE#${timestamp}`,
      GSI2PK: `TENANT#${tenantId}#PENDING_PROCURE`,
      GSI2SK: `DEPT#Operations#DATE#${timestamp}`
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: request }));

    // 5. Seed Audit Logs
    const audit: AuditLog = {
      PK: `TENANT#${tenantId}`,
      SK: `AUDIT#AST-M3MAX-777#${timestamp}`,
      AssetId: "AST-M3MAX-777",
      ActorId: "SYSTEM",
      ActorName: "System Provisioner",
      Action: "ASSET_ASSIGNED",
      Timestamp: timestamp,
      Details: "Hardware assigned to John Doe upon tenant onboarding."
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: audit }));

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/procurement');

    return { success: true };
  } catch (error: any) {
    console.error("❌ seedActiveTenantAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Register a new hardware asset manually
 */
export async function registerAssetAction(data: {
  assetId: string;
  assetName: string;
  type: HardwareAsset['Type'];
  serialNo: string;
  status: HardwareAsset['Status'];
  employeeId?: string;
  employeeName?: string;
}) {
  try {
    const { tenantId } = await getTenantContext();
    
    // Check if asset already exists
    const existing = await getAssetById(tenantId, data.assetId);
    if (existing) {
      return { success: false, error: "Asset ID already exists." };
    }

    await createHardwareAsset(tenantId, {
      AssetId: data.assetId,
      AssetName: data.assetName,
      SerialNo: data.serialNo || `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      Type: data.type,
      Status: data.status || "ACTIVE",
      EmployeeId: data.employeeId || "UNASSIGNED",
      EmployeeName: data.employeeName || "Open Stock"
    });

    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("❌ registerAssetAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action to get Ollama config for active tenant context
 */
export async function getTenantOllamaConfigAction() {
  try {
    const { tenantId } = await getTenantContext();
    const config = await getTenantOllamaConfig(tenantId || "org_demo_123");
    return { success: true, config };
  } catch (error: any) {
    console.error("❌ getTenantOllamaConfigAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action to update Ollama config for active tenant context
 */
export async function updateTenantOllamaConfigAction(config: {
  evaluationMode?: 'HYBRID_HEURISTIC' | 'PURE_OLLAMA';
  ollamaEndpoint?: string;
  ollamaModel?: string;
  sensitiveFilePatterns?: string[];
}) {
  try {
    const { tenantId } = await getTenantContext();
    await updateTenantOllamaConfig(tenantId || "org_demo_123", config);
    revalidatePath('/security');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error("❌ updateTenantOllamaConfigAction Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action to get all sharded telemetry data for a given tenant within the last 15 minutes
 */
export async function getTenantTelemetryAction(tenantId: string) {
  try {
    const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");
    let activeTenantId = tenantId;
    if (process.env.NEXT_PUBLIC_SKIP_CLERK !== "true") {
      try {
        const context = await getTenantContext();
        if (context.tenantId) {
          activeTenantId = context.tenantId;
        }
      } catch {
        console.warn("[getTenantTelemetryAction] Fallback to client tenantId:", tenantId);
      }
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const promises = Array.from({ length: 10 }).map((_, shardId) => {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK > :skPrefix",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${activeTenantId}#TELEMETRY#SHARD#${shardId}`,
          ":skPrefix": `TELEMETRY#`,
        },
      });
      return docClient.send(command).then(res => res.Items || []);
    });

    const results = await Promise.all(promises);
    const allTelemetry = results.flat();

    // Filter and sort by timestamp
    const filtered = allTelemetry
      .filter(item => item.Timestamp >= fifteenMinutesAgo)
      .sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));

    return { success: true, telemetry: filtered };
  } catch (error: any) {
    console.error("❌ getTenantTelemetryAction Error:", error);
    return { success: false, error: error.message, telemetry: [] };
  }
}

/**
 * Server action to get Tenant plan and subscription metadata
 */
export async function getTenantMetadataAction() {
  try {
    const { tenantId } = await getTenantContext();
    const metadata = await getTenantMetadata(tenantId || "org_demo_123");
    
    // Fallback if metadata not seeded
    const fallbackMetadata: Tenant = {
      PK: `TENANT#${tenantId || "org_demo_123"}`,
      SK: "METADATA",
      TenantName: "Acme Corp Remote",
      TenantSlug: "acme-corp",
      CreatedAt: new Date().toISOString(),
      Status: "ACTIVE" as const,
      Plan: "FREE_TIER" as const,
      MaxAllowedEndpoints: 150
    };

    return { 
      success: true, 
      metadata: metadata || fallbackMetadata 
    };
  } catch (error: any) {
    console.error("❌ getTenantMetadataAction Error:", error);
    return { success: false, error: error.message };
  }
}


