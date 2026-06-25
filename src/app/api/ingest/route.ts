import { NextResponse } from 'next/server';
import { getAssetById } from '@/lib/dao';
import { sendToQueue } from '@/lib/queue';

import { env } from '@/lib/env';

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

    // 5. Return 202 Accepted (Standard for high-throughput queues)
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
