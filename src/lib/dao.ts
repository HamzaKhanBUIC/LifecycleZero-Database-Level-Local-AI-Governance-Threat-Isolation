import { 
  QueryCommand, 
  PutCommand, 
  TransactWriteCommand,
  GetCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";
import type { Tenant, Employee, HardwareAsset, ProcurementRequest, AuditLog } from "./types";

import { env } from "./env";

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

// Helper to check if a status requires administrative action (e.g. provisioning, shipping, wiping)
function statusRequiresAction(status: string): boolean {
  return ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(status);
}

/**
 * Access Pattern 1: Retrieve All Active Assets Assigned to a Specific Employee
 */
export async function getActiveAssetsForEmployee(tenantId: string, employeeId: string): Promise<HardwareAsset[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1-OverloadIndex",
    KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statePrefix)",
    ExpressionAttributeValues: {
      ":gsi1pk": `EMP#${employeeId}`,
      ":statePrefix": "STATE#"
    }
  });

  const response = await docClient.send(command);
  return (response.Items || []) as HardwareAsset[];
}

/**
 * Access Pattern 2: Fetch Pending Procurement Requests for a Department (using Sparse Index GSI2)
 */
export async function getPendingProcurementRequests(tenantId: string, department?: string): Promise<ProcurementRequest[]> {
  const gsi2pk = `TENANT#${tenantId}#PENDING_PROCURE`;
  
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI2-SparseWorkflow",
    KeyConditionExpression: "GSI2PK = :gsi2pk" + (department ? " AND begins_with(GSI2SK, :gsi2sk)" : ""),
    ExpressionAttributeValues: {
      ":gsi2pk": gsi2pk,
      ...(department ? { ":gsi2sk": `DEPT#${department}#` } : {})
    }
  });

  const response = await docClient.send(command);
  return (response.Items || []) as ProcurementRequest[];
}

/**
 * Access Pattern 3: Retrieve the Comprehensive Audit Trail for a Hardware Asset (Sorted Descending)
 */
export async function getAuditTrailForAsset(tenantId: string, assetId: string): Promise<AuditLog[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": `TENANT#${tenantId}`,
      ":sk": `AUDIT#${assetId}#`
    },
    ScanIndexForward: false // Retrieve reverse chronological order (newest first)
  });

  const response = await docClient.send(command);
  return (response.Items || []) as AuditLog[];
}

/**
 * Access Pattern 4: Unified Tenant Dashboard Aggregation
 * Fetches the Tenant metadata and performs basic aggregations.
 */
export async function getTenantDashboardData(tenantId: string) {
  const [tenantRes, assetsRes, empRes, pendingRequests] = await Promise.all([
    docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: "METADATA" }
    })),
    docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "ASSET#"
      }
    })),
    docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "EMP#"
      }
    })),
    getPendingProcurementRequests(tenantId)
  ]);

  const tenant = tenantRes.Item as Tenant | undefined;
  const assets = (assetsRes.Items || []) as HardwareAsset[];
  const employees = (empRes.Items || []) as Employee[];

  return {
    tenant,
    employees,
    assets,
    pendingRequests
  };
}

/**
 * Access Pattern 5: Transactional Lifecycle State Change with Immutability
 * Atomically updates the HardwareAsset's status and adds an AuditLog record.
 */
export async function updateAssetStatusTransaction(params: {
  tenantId: string;
  assetId: string;
  newStatus: HardwareAsset['Status'];
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
}): Promise<void> {
  const { 
    tenantId, 
    assetId, 
    newStatus, 
    assignedEmployeeId = "UNASSIGNED", 
    assignedEmployeeName = "Unassigned", 
    actorId, 
    actorName, 
    action, 
    details 
  } = params;

  const timestamp = new Date().toISOString();
  const assetKey = { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` };
  
  // Setup standard update fields
  const updateExpressions: string[] = [
    "SET #status = :newStatus",
    "GSI1PK = :gsi1pk",
    "GSI1SK = :gsi1sk",
    "EmployeeId = :empId",
    "EmployeeName = :empName",
    "UpdatedAt = :updatedAt"
  ];
  
  const expressionNames: Record<string, string> = {
    "#status": "Status"
  };

  const expressionValues: Record<string, any> = {
    ":newStatus": newStatus,
    ":gsi1pk": `EMP#${assignedEmployeeId}`,
    ":gsi1sk": `STATE#${newStatus}`,
    ":empId": assignedEmployeeId,
    ":empName": assignedEmployeeName,
    ":updatedAt": timestamp
  };

  // If status requires action, add sparse index attributes, else remove them
  let updateExpressionStr = updateExpressions.join(", ");
  if (statusRequiresAction(newStatus)) {
    updateExpressionStr += ", GSI2PK = :gsi2pk, GSI2SK = :gsi2sk";
    expressionValues[":gsi2pk"] = `TENANT#${tenantId}#ACTION_REQ`;
    expressionValues[":gsi2sk"] = `DATE#${timestamp}`;
  } else {
    // If not requiring action, we must REMOVE the GSI2 attributes so the sparse GSI drops the record
    updateExpressionStr += " REMOVE GSI2PK, GSI2SK";
  }

  const transactionCommand = new TransactWriteCommand({
    TransactItems: [
      // 1. Update the Hardware Asset
      {
        Update: {
          TableName: TABLE_NAME,
          Key: assetKey,
          UpdateExpression: updateExpressionStr,
          ConditionExpression: "attribute_exists(PK) AND #status <> :newStatus",
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues
        }
      },
      // 2. Add the Immutable Audit Log record
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `TENANT#${tenantId}`,
            SK: `AUDIT#${assetId}#${timestamp}`,
            AssetId: assetId,
            ActorId: actorId,
            ActorName: actorName,
            Action: action,
            Timestamp: timestamp,
            Details: details
          } as AuditLog
        }
      }
    ]
  });

  try {
    await docClient.send(transactionCommand);
  } catch (error: any) {
    console.error("❌ Transaction status update failed:", error);
    if (error.name === "TransactionCanceledException") {
      const reasons = error.CancellationReasons || [];
      const reasonDetails = reasons.map((r: any, idx: number) => `Item ${idx}: ${r.Code} - ${r.Message || "No message"}`).join(", ");
      throw new Error(`TRANSACTION_CANCELLED: The transaction was cancelled by DynamoDB. Reasons: [${reasonDetails}]`);
    }
    if (error.name === "ProvisionedThroughputExceededException") {
      throw new Error("THROTTLED: DynamoDB write capacity limit exceeded. Provisioned throughput exceeded. Please retry shortly.");
    }
    throw new Error(`DATABASE_ERROR: Failed to update asset status. ${error.message}`);
  }
}

/**
 * Retrieve a specific Hardware Asset by ID
 */
export async function getAssetById(tenantId: string, assetId: string): Promise<HardwareAsset | undefined> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}`,
      SK: `ASSET#${assetId}`
    }
  });

  const response = await docClient.send(command);
  return response.Item as HardwareAsset | undefined;
}

/**
 * Updates the last seen heartbeat timestamp of a hardware asset
 */
export async function updateAssetHeartbeat(tenantId: string, assetId: string): Promise<void> {
  const timestamp = new Date().toISOString();
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` },
    UpdateExpression: "SET LastHeartbeat = :ts",
    ExpressionAttributeValues: {
      ":ts": timestamp
    }
  }));
}

/**
 * Creates a new hardware asset (initiates procurement)
 */
export async function createHardwareAsset(tenantId: string, asset: Omit<HardwareAsset, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'GSI2PK' | 'GSI2SK' | 'UpdatedAt'>) {
  const timestamp = new Date().toISOString();
  const gsi2pk = statusRequiresAction(asset.Status) ? `TENANT#${tenantId}#ACTION_REQ` : undefined;
  const gsi2sk = statusRequiresAction(asset.Status) ? `DATE#${timestamp}` : undefined;

  const item: HardwareAsset = {
    ...asset,
    PK: `TENANT#${tenantId}`,
    SK: `ASSET#${asset.AssetId}`,
    GSI1PK: `EMP#${asset.EmployeeId || "UNASSIGNED"}`,
    GSI1SK: `STATE#${asset.Status}`,
    ...(gsi2pk ? { GSI2PK: gsi2pk, GSI2SK: gsi2sk } : {}),
    AgentKey: asset.AgentKey || (typeof crypto !== "undefined" ? crypto.randomUUID() : `key_${Math.random().toString(36).substring(2, 10)}`),
    HardwareUuid: asset.HardwareUuid || undefined,
    UpdatedAt: timestamp
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  // Log initial creation audit
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TENANT#${tenantId}`,
      SK: `AUDIT#${asset.AssetId}#${timestamp}`,
      AssetId: asset.AssetId,
      ActorId: "SYSTEM",
      ActorName: "System Auto-Provisioner",
      Action: "ASSET_CREATED",
      Timestamp: timestamp,
      Details: `Asset created with status ${asset.Status}`
    } as AuditLog
  }));

  return item;
}

/**
 * Submits a new procurement request
 */
export async function submitProcurementRequest(tenantId: string, request: Omit<ProcurementRequest, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'GSI2PK' | 'GSI2SK' | 'CreatedAt' | 'Status'>) {
  const timestamp = new Date().toISOString();
  const requestId = request.RequestId;
  
  const item: ProcurementRequest = {
    ...request,
    PK: `TENANT#${tenantId}`,
    SK: `PROCURE#${requestId}`,
    Status: "PENDING",
    CreatedAt: timestamp,
    GSI1PK: `DEPT#${request.Department}`,
    GSI1SK: `DATE#${timestamp}`,
    GSI2PK: `TENANT#${tenantId}#PENDING_PROCURE`,
    GSI2SK: `DEPT#${request.Department}#DATE#${timestamp}`
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  return item;
}

/**
 * Resolves a procurement request (Approve/Reject)
 */
export async function resolveProcurementRequest(tenantId: string, requestId: string, decision: 'APPROVED' | 'REJECTED', actorId: string, actorName: string) {
  const timestamp = new Date().toISOString();
  
  // 1. Get the procurement request to get details (asset name, type, department)
  const reqRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `TENANT#${tenantId}`, SK: `PROCURE#${requestId}` }
  }));

  const request = reqRes.Item as ProcurementRequest | undefined;
  if (!request) {
    throw new Error("Procurement request not found.");
  }

  if (request.Status !== "PENDING") {
    throw new Error(`Request has already been resolved with status: ${request.Status}`);
  }

  // 2. Perform transactional write:
  // - Update the procurement request status to APPROVED/REJECTED, and REMOVE GSI2PK, GSI2SK (so it leaves the pending sparse index)
  // - If APPROVED, create a new HardwareAsset with status 'PROCURING' (which will put it in the ACTION_REQ sparse GSI)
  const transactItems: any[] = [
    {
      Update: {
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: `PROCURE#${requestId}` },
        UpdateExpression: "SET #status = :newStatus REMOVE GSI2PK, GSI2SK",
        ExpressionAttributeNames: { "#status": "Status" },
        ExpressionAttributeValues: { ":newStatus": decision }
      }
    }
  ];

  let newAssetId: string | null = null;
  if (decision === "APPROVED") {
    newAssetId = `AST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const assetItem: HardwareAsset = {
      PK: `TENANT#${tenantId}`,
      SK: `ASSET#${newAssetId}`,
      AssetId: newAssetId,
      AssetName: request.AssetName,
      SerialNo: `SN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      Type: request.Type,
      Status: "PROCURING",
      EmployeeId: request.RequesterId,
      EmployeeName: request.RequesterName,
      GSI1PK: `EMP#${request.RequesterId}`,
      GSI1SK: `STATE#PROCURING`,
      GSI2PK: `TENANT#${tenantId}#ACTION_REQ`,
      GSI2SK: `DATE#${timestamp}`,
      UpdatedAt: timestamp
    };

    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: assetItem
      }
    });

    // Add audit log for asset creation
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${tenantId}`,
          SK: `AUDIT#${newAssetId}#${timestamp}`,
          AssetId: newAssetId,
          ActorId: actorId,
          ActorName: actorName,
          Action: "ASSET_APPROVED_PROCURING",
          Timestamp: timestamp,
          Details: `Asset approved via procurement request ${requestId}`
        } as AuditLog
      }
    });
  }

  const command = new TransactWriteCommand({ TransactItems: transactItems });
  await docClient.send(command);

  return { decision, assetId: newAssetId };
}

/**
 * Seed helper to create an employee
 */
export async function createEmployee(tenantId: string, employee: Omit<Employee, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>) {
  const item: Employee = {
    ...employee,
    PK: `TENANT#${tenantId}`,
    SK: `EMP#${employee.EmployeeId}`,
    GSI1PK: `DEPT#${employee.Department}`,
    GSI1SK: `EMP#${employee.EmployeeId}`
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  return item;
}

export interface TenantOllamaConfig {
  evaluationMode: 'HYBRID_HEURISTIC' | 'PURE_OLLAMA';
  ollamaEndpoint: string;
  ollamaModel: string;
}

/**
 * Get active Ollama configuration for a tenant
 */
export async function getTenantOllamaConfig(tenantId: string): Promise<TenantOllamaConfig> {
  try {
    const res = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: "METADATA" }
    }));
    const tenant = res.Item as Tenant | undefined;
    return {
      evaluationMode: tenant?.EvaluationMode || 'HYBRID_HEURISTIC',
      ollamaEndpoint: tenant?.OllamaEndpoint || env("OLLAMA_HOST", "http://localhost:11434"),
      ollamaModel: tenant?.OllamaModel || env("OLLAMA_MODEL", "llama3")
    };
  } catch (err) {
    console.error("Failed to get tenant Ollama config:", err);
    return {
      evaluationMode: 'HYBRID_HEURISTIC',
      ollamaEndpoint: env("OLLAMA_HOST", "http://localhost:11434"),
      ollamaModel: env("OLLAMA_MODEL", "llama3")
    };
  }
}

/**
 * Update Ollama configuration for a tenant
 */
export async function updateTenantOllamaConfig(
  tenantId: string,
  config: Partial<TenantOllamaConfig>
): Promise<void> {
  const expressions: string[] = [];
  const attributeValues: any = {};

  if (config.evaluationMode !== undefined) {
    expressions.push("EvaluationMode = :mode");
    attributeValues[":mode"] = config.evaluationMode;
  }
  if (config.ollamaEndpoint !== undefined) {
    expressions.push("OllamaEndpoint = :endpoint");
    attributeValues[":endpoint"] = config.ollamaEndpoint;
  }
  if (config.ollamaModel !== undefined) {
    expressions.push("OllamaModel = :model");
    attributeValues[":model"] = config.ollamaModel;
  }

  if (expressions.length === 0) return;

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `TENANT#${tenantId}`, SK: "METADATA" },
    UpdateExpression: `SET ${expressions.join(", ")}`,
    ExpressionAttributeValues: attributeValues
  }));
}
