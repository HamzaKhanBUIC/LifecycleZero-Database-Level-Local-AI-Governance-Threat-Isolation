import { NextResponse } from 'next/server';
import { getAssetById } from '@/lib/dao';
import { sendToQueue } from '@/lib/queue';
import { env } from '@/lib/env';
import { evaluateTelemetryRisk } from '@/lib/ai';
import { docClient } from '@/lib/dynamodb';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

async function processTelemetryInline(payload: any) {
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

  try {
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

    // Write directly to DynamoDB table
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: telemetry
    }));

    // Update Asset LastHeartbeat
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TENANT#${tenantId}`, SK: `ASSET#${assetId}` },
      UpdateExpression: "SET LastHeartbeat = :ts",
      ExpressionAttributeValues: {
        ":ts": new Date().toISOString()
      }
    }));
    
    console.log(`[INLINE PROCESSING] Successfully processed telemetry alert for ${assetId}. Risk: ${aiResult.riskLevel}`);
  } catch (err) {
    console.error(`[INLINE PROCESSING ERROR] Failed to process telemetry for ${assetId}:`, err);
  }
}


export async function POST(request: Request) {
  try {
    // 1. Agent Authentication Check (HMAC / API Key Verification)
    const agentKey = request.headers.get("x-agent-key");
    const expectedKey = env("AGENT_API_KEY", "demo_agent_key_99");
    if (agentKey !== expectedKey) {
      return NextResponse.json({
        error: "UNAUTHORIZED_AGENT",
        message: "Invalid or missing X-Agent-Key authentication header."
      }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, assetId, processName, filesAccessed, cpuUsage, ramUsage, networkEgress } = body;

    // Validation
    if (!tenantId || !assetId || !processName) {
      return NextResponse.json({ error: "Missing required fields: tenantId, assetId, processName" }, { status: 400 });
    }

    // 2. Fetch asset to check status
    const asset = await getAssetById(tenantId, assetId);
    if (!asset) {
      return NextResponse.json({ error: `Asset ${assetId} not found under tenant ${tenantId}.` }, { status: 404 });
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

    // 4. Send to SQS (or local fallback file)
    const result = await sendToQueue(queuePayload);

    // 5. Instantly process telemetry inline to update the dashboard immediately for real-time visibility.
    // This allows the threat simulations to work seamlessly even when a background worker daemon is not running (e.g., Serverless Vercel).
    processTelemetryInline(queuePayload).catch((err) => {
      console.error("Inline telemetry processing fallback failed:", err);
    });

    // 6. Return 202 Accepted (Standard for high-throughput queues)
    return NextResponse.json({
      success: true,
      status: "QUEUED",
      messageId: result.messageId,
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
