import crypto from "node:crypto";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dynamodb", () => ({ docClient: { send } }));

import { POST as stripePOST } from "@/app/api/webhooks/stripe/route";
import { POST as clerkPOST } from "@/app/api/webhooks/clerk/route";

const STRIPE_SECRET = "whsec_unit_test_stripe_secret";
const CLERK_SECRET = `whsec_${crypto.randomBytes(24).toString("base64")}`;

const stripeEvent = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "customer.subscription.deleted",
  data: { object: { id: "sub_test", status: "canceled", metadata: { tenantId: "org_victim" } } },
});

function stripeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers, body: stripeEvent });
}

const clerkEvent = JSON.stringify({
  type: "organizationMembership.deleted",
  object: "event",
  data: { organization: { id: "org_victim" }, public_user_data: { user_id: "user_1" } },
});

/** Standard Webhooks / Svix signature: base64(HMAC-SHA256(key, `${id}.${ts}.${body}`)). */
function clerkHeaders(secret: string, body: string) {
  const id = "msg_unit_test";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

function clerkRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/webhooks/clerk", { method: "POST", headers, body: clerkEvent });
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe webhook", () => {
  it("fails closed with 500 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const header = Stripe.webhooks.generateTestHeaderString({ payload: stripeEvent, secret: STRIPE_SECRET });
    const res = await stripePOST(stripeRequest({ "stripe-signature": header }));
    expect(res.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a request without a stripe-signature header", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", STRIPE_SECRET);
    const res = await stripePOST(stripeRequest());
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an event signed with a different secret", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", STRIPE_SECRET);
    const forged = Stripe.webhooks.generateTestHeaderString({ payload: stripeEvent, secret: "whsec_attacker" });
    const res = await stripePOST(stripeRequest({ "stripe-signature": forged }));
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("processes a correctly signed event", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", STRIPE_SECRET);
    const header = Stripe.webhooks.generateTestHeaderString({ payload: stripeEvent, secret: STRIPE_SECRET });
    const res = await stripePOST(stripeRequest({ "stripe-signature": header }));
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("Clerk webhook", () => {
  it("fails closed with 500 when CLERK_WEBHOOK_SECRET is unset", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", "");
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const res = await clerkPOST(clerkRequest(clerkHeaders(CLERK_SECRET, clerkEvent)));
    expect(res.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an unsigned request", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", CLERK_SECRET);
    const res = await clerkPOST(clerkRequest());
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an event signed with a different secret", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", CLERK_SECRET);
    const attackerSecret = `whsec_${crypto.randomBytes(24).toString("base64")}`;
    const res = await clerkPOST(clerkRequest(clerkHeaders(attackerSecret, clerkEvent)));
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("processes a correctly signed event", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", CLERK_SECRET);
    const res = await clerkPOST(clerkRequest(clerkHeaders(CLERK_SECRET, clerkEvent)));
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
