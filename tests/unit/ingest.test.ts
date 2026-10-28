import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dao = vi.hoisted(() => ({
  getAssetById: vi.fn(),
  createHardwareAsset: vi.fn(),
  getTenantOllamaConfig: vi.fn(),
  getTenantMetadata: vi.fn(),
}));
const sendToQueue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dao", () => dao);
vi.mock("@/lib/queue", () => ({ sendToQueue }));
vi.mock("@/lib/ai", () => ({ evaluateTelemetryRisk: vi.fn() }));
vi.mock("@/lib/dynamodb", () => ({ docClient: { send: vi.fn() } }));

import { POST as ingestPOST } from "@/app/api/ingest/route";
import { POST as rotatePOST } from "@/app/api/webhooks/rotate-key/route";

const AGENT_KEY = crypto.randomBytes(32).toString("hex");
const payload = JSON.stringify({ tenantId: "org_acme", assetId: "AST-NEW-1", processName: "node" });

function ingestRequest(agentKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (agentKey !== undefined) headers["X-Agent-Key"] = agentKey;
  return new Request("http://localhost/api/ingest", { method: "POST", headers, body: payload });
}

beforeEach(() => {
  Object.values(dao).forEach((fn) => fn.mockReset());
  sendToQueue.mockReset();
  dao.getTenantMetadata.mockResolvedValue(null);
  dao.getAssetById.mockResolvedValue(null);
  dao.createHardwareAsset.mockImplementation(async (_tenantId: string, asset: any) => asset);
  dao.getTenantOllamaConfig.mockResolvedValue({ evaluationMode: "HYBRID_HEURISTIC" });
  sendToQueue.mockResolvedValue({ messageId: "msg-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ingest", () => {
  it("fails closed with 500 and touches nothing when AGENT_API_KEY is unset", async () => {
    vi.stubEnv("AGENT_API_KEY", "");
    const res = await ingestPOST(ingestRequest("any-key"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("INGEST_NOT_CONFIGURED");
    expect(dao.getTenantMetadata).not.toHaveBeenCalled();
    expect(dao.getAssetById).not.toHaveBeenCalled();
    expect(dao.createHardwareAsset).not.toHaveBeenCalled();
    expect(sendToQueue).not.toHaveBeenCalled();
  });

  it("rejects enrollment with the old public demo key or no key", async () => {
    vi.stubEnv("AGENT_API_KEY", AGENT_KEY);
    for (const key of ["demo_agent_key_99", undefined]) {
      const res = await ingestPOST(ingestRequest(key));
      expect(res.status).toBe(401);
    }
    expect(dao.createHardwareAsset).not.toHaveBeenCalled();
  });

  it("enrolls with the configured key and issues a random 32-byte device key", async () => {
    vi.stubEnv("AGENT_API_KEY", AGENT_KEY);
    const res = await ingestPOST(ingestRequest(AGENT_KEY));
    expect(res.status).toBe(202);
    const enrolled = dao.createHardwareAsset.mock.calls[0][1];
    expect(enrolled.AgentKey).toMatch(/^key_[0-9a-f]{64}$/);
  });
});

describe("POST /api/webhooks/rotate-key", () => {
  it("fails closed with 500 when ADMIN_ROTATION_SECRET is unset", async () => {
    vi.stubEnv("ADMIN_ROTATION_SECRET", "");
    const res = await rotatePOST(new Request("http://localhost/api/webhooks/rotate-key", {
      method: "POST",
      headers: { "x-admin-token": "anything" },
    }));
    expect(res.status).toBe(500);
    expect((await res.json()).newKey).toBeUndefined();
  });
});
