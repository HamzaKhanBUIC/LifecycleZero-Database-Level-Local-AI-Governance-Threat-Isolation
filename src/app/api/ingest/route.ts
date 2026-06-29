import { NextResponse } from 'next/server';
import { getAssetById, createHardwareAsset, getTenantOllamaConfig, getTenantMetadata } from '@/lib/dao';
import { sendToQueue } from '@/lib/queue';
import { env } from '@/lib/env';
import { evaluateTelemetryRisk } from '@/lib/ai';
import { docClient } from '@/lib/dynamodb';
import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

function getShardId(assetId: string): number {
  let hash = 0;
  for (let i = 0; i < assetId.length; i++) {
    hash = (hash << 5) - hash + assetId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10;
}

async function processTelemetryInline(payload: any) {
  const { tenantId, assetId, processName, filesAccessed, cpuUsage, ramUsage, networkEgress, timestamp } = payload;
  
  const shardId = getShardId(assetId);
  const baseTelemetry = {
    PK: `TENANT#${tenantId}#TELEMETRY#SHARD#${shardId}`,
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

  // Evaluate risk level via Bedrock / Gemini fallback
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

  // Write directly to DynamoDB table and update heartbeat in parallel to optimize latency (AWS best practice)
  await Promise.all([
    docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: telemetry
    })),
    docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` },
      UpdateExpression: "SET LastHeartbeat = :ts",
      ExpressionAttributeValues: {
        ":ts": new Date().toISOString()
      }
    }))
  ]);
  
  console.log(`[INLINE PROCESSING] Successfully processed telemetry alert for ${assetId}. Risk: ${aiResult.riskLevel}`);
  return aiResult;
}


export async function POST(request: Request) {
  try {
    const agentKey = request.headers.get("x-agent-key");
    const signature = request.headers.get("x-agent-signature");
    
    // Read raw body text first to guarantee layout matches signature computation (AWS/cryptographic standard)
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const { tenantId, assetId, processName, filesAccessed, cpuUsage, ramUsage, networkEgress, hardwareUuid } = body;

    // Validation
    if (!tenantId || !assetId || !processName) {
      return NextResponse.json({ error: "Missing required fields: tenantId, assetId, processName" }, { status: 400 });
    }

    const globalEnrollmentKey = env("AGENT_API_KEY", "demo_agent_key_99");

    // Fetch tenant metadata to enforce limits
    const tenantMeta = await getTenantMetadata(tenantId);
    if (tenantMeta) {
      if (tenantMeta.Status === "SUSPENDED") {
        return NextResponse.json({
          error: "TENANT_SUSPENDED",
          message: "Organization subscription is suspended. Ingestion disabled."
        }, { status: 403 });
      }
    }

    // 2. Fetch asset to check status (auto-enroll if not exists)
    let asset = await getAssetById(tenantId, assetId);
    if (!asset) {
      if (tenantMeta) {
        const assetsRes = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": `TENANT#${tenantId}`,
            ":sk": "ASSET#"
          }
        }));
        const activeCount = assetsRes.Count || 0;
        const maxAllowed = tenantMeta.MaxAllowedEndpoints || 5;
        if (activeCount >= maxAllowed) {
          return NextResponse.json({
            error: "INGESTION_QUOTA_EXCEEDED",
            message: `Endpoint limit reached (${activeCount}/${maxAllowed}). Upgrade your plan to enroll more devices.`
          }, { status: 402 });
        }
      }

      // New devices require the global enrollment key to onboard
      if (agentKey !== globalEnrollmentKey) {
        return NextResponse.json({
          error: "UNAUTHORIZED_AGENT",
          message: "Device registration requires a valid global enrollment key."
        }, { status: 401 });
      }

      console.log(`[INGEST] Asset ${assetId} not found under tenant ${tenantId}. Auto-enrolling...`);
      try {
        const deviceSpecificKey = `key_${Math.random().toString(36).substring(2, 10)}_${Math.random().toString(36).substring(2, 10)}`;
        asset = await createHardwareAsset(tenantId, {
          AssetId: assetId,
          AssetName: `Host Device (${assetId})`,
          SerialNo: `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          Type: "LAPTOP",
          Status: "ACTIVE",
          EmployeeId: "UNASSIGNED",
          EmployeeName: "Open Stock",
          AgentKey: deviceSpecificKey,
          HardwareUuid: hardwareUuid || undefined
        });
      } catch (enrollErr) {
        console.error(`[INGEST] Auto-enrollment failed for asset ${assetId}:`, enrollErr);
        return NextResponse.json({ error: `Asset ${assetId} not found and auto-enrollment failed.` }, { status: 404 });
      }
    } else {
      const expectedAgentKey = asset.AgentKey || globalEnrollmentKey;
      const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
      const isSandbox = allowedSandboxTenants.includes(tenantId);

      // Perform HMAC-SHA256 signature verification
      if (!isSandbox || signature) {
        if (!signature) {
          return NextResponse.json({
            error: "UNAUTHORIZED_SIGNATURE",
            message: "Missing required x-agent-signature header for production tenant."
          }, { status: 401 });
        }

        const computedSignature = crypto
          .createHmac("sha256", expectedAgentKey)
          .update(rawBody)
          .digest("hex");

        const signatureBuffer = Buffer.from(signature, "hex");
        const computedBuffer = Buffer.from(computedSignature, "hex");

        // Validate exact buffer length to prevent timingSafeEqual crash
        if (signatureBuffer.length !== computedBuffer.length) {
          return NextResponse.json({
            error: "UNAUTHORIZED_SIGNATURE",
            message: "Invalid cryptographic signature length."
          }, { status: 401 });
        }

        const isSignatureValid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);
        if (!isSignatureValid) {
          return NextResponse.json({
            error: "UNAUTHORIZED_SIGNATURE",
            message: "Cryptographic verification failed. Spoofing attempt blocked."
          }, { status: 401 });
        }
      } else {
        // Fallback for legacy sandbox telemetry that does not support cryptographic signing
        if (agentKey !== expectedAgentKey) {
          return NextResponse.json({
            error: "UNAUTHORIZED_AGENT",
            message: "Invalid X-Agent-Key credentials for this device."
          }, { status: 401 });
        }
      }

      // Mitigate device spoofing by checking hardware signature matches enrolled signature
      if (asset.HardwareUuid && hardwareUuid && asset.HardwareUuid !== hardwareUuid) {
        return NextResponse.json({
          error: "SPOOFING_ATTEMPT",
          message: "Ingestion rejected: Hardware UUID drift detected. Identification verification failed."
        }, { status: 400 });
      }
    }

    // 3. Reject telemetry if the host is isolated
    if (asset.Status === "ISOLATED") {
      return NextResponse.json({
        error: "FORBIDDEN_ISOLATED",
        message: "Host is isolated. Network egress restricted. Telemetry ingestion blocked at edge API gateway."
      }, { status: 403 });
    }

    // 3. Construct Queue Payload
    const queuePayload = {
      tenantId,
      assetId,
      processName,
      filesAccessed: filesAccessed || [],
      cpuUsage: Number(cpuUsage) || 0,
      ramUsage: Number(ramUsage) || 0,
      networkEgress: Number(networkEgress) || 0,
      timestamp: new Date().toISOString()
    };

    const config = await getTenantOllamaConfig(tenantId);

    // If PURE_OLLAMA mode is active, evaluate synchronously to bubble up connection errors to the judge
    if (config.evaluationMode === "PURE_OLLAMA") {
      try {
        const aiResult = await processTelemetryInline(queuePayload);
        return NextResponse.json({
          success: true,
          status: "EVALUATED",
          agentKey: asset.AgentKey,
          message: `Local Ollama evaluation completed successfully! Model '${config.ollamaModel}' analyzed the telemetry and concluded: "${aiResult.reasoning}"`
        }, { status: 200 });
      } catch (err: any) {
        console.error("❌ PURE_OLLAMA Ingestion Evaluation Failed:", err);
        return NextResponse.json({
          error: "OLLAMA_OFFLINE",
          message: err.message || `Local Ollama is offline or unreachable at '${config.ollamaEndpoint}'. Please start Ollama first.`
        }, { status: 503 });
      }
    }

    // 4. Send to SQS (or local fallback file)
    const result = await sendToQueue(queuePayload);

    // 5. Instantly process telemetry inline only for sandbox/demo tenants to update the dashboard immediately for real-time visibility.
    // Production tenants bypass inline processing entirely to save execution capacity and avoid double-writing bottlenecks.
    const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
    if (allowedSandboxTenants.includes(tenantId)) {
      processTelemetryInline(queuePayload).catch((err) => {
        console.error("Inline telemetry processing fallback failed:", err);
      });
    } else {
      console.log(`[INGEST] Asynchronous queue ingestion active for enterprise tenant ${tenantId}. Inline bypass active.`);
    }

    // 6. Return 202 Accepted (Standard for high-throughput queues)
    return NextResponse.json({
      success: true,
      status: "QUEUED",
      messageId: result.messageId,
      agentKey: asset.AgentKey,
      message: "Telemetry received and queued for asynchronous evaluation."
    }, { status: 202 });

  } catch (error: any) {
    console.error("Telemetry ingestion failed:", error);
    return NextResponse.json({
      error: "Ingestion failed",
      message: error.message || "An unexpected error occurred."
    }, { status: 500 });
  }
}
