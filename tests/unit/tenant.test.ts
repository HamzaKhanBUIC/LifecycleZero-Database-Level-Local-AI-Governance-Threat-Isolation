import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
const auth = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lifecycle_tenant_id" && jar.value ? { value: jar.value } : undefined),
  }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dynamodb", () => ({ docClient: { send } }));

import { requireTenant, UnauthorizedError } from "@/lib/tenant";
import { upgradeTenantPlanAction } from "@/app/actions/api";

beforeEach(() => {
  jar.value = undefined;
  auth.mockReset();
  send.mockReset();
  send.mockResolvedValue({});
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_unit");
  vi.stubEnv("NEXT_PUBLIC_SKIP_CLERK", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireTenant", () => {
  it("uses the Clerk organization", async () => {
    auth.mockResolvedValue({ orgId: "org_acme", userId: "user_1" });
    await expect(requireTenant()).resolves.toEqual({ tenantId: "org_acme", userId: "user_1", isSandbox: false });
  });

  it("uses a personal workspace when the user has no organization", async () => {
    auth.mockResolvedValue({ orgId: null, userId: "user_1" });
    await expect(requireTenant()).resolves.toMatchObject({ tenantId: "USER_user_1", isSandbox: false });
  });

  it("throws UnauthorizedError without a session", async () => {
    auth.mockResolvedValue({ orgId: null, userId: null });
    await expect(requireTenant()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("never lets the tenant cookie select a real tenant", async () => {
    jar.value = "org_victim";
    auth.mockResolvedValue({ orgId: null, userId: null });
    await expect(requireTenant()).rejects.toBeInstanceOf(UnauthorizedError);

    auth.mockResolvedValue({ orgId: "org_acme", userId: "user_1" });
    await expect(requireTenant()).resolves.toMatchObject({ tenantId: "org_acme" });
  });

  it("accepts the cookie only for the fixed sandbox tenants", async () => {
    jar.value = "org_fintech_456";
    await expect(requireTenant()).resolves.toMatchObject({ tenantId: "org_fintech_456", isSandbox: true });
    expect(auth).not.toHaveBeenCalled();
  });

  it("only exposes the default sandbox tenant when Clerk is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SKIP_CLERK", "true");
    jar.value = "org_victim";
    await expect(requireTenant()).resolves.toMatchObject({ tenantId: "org_demo_123", isSandbox: true });
  });
});

describe("upgradeTenantPlanAction", () => {
  it("refuses live tenants and writes nothing", async () => {
    auth.mockResolvedValue({ orgId: "org_acme", userId: "user_1" });
    const res = await upgradeTenantPlanAction();
    expect(res.success).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses unauthenticated callers and writes nothing", async () => {
    auth.mockResolvedValue({ orgId: null, userId: null });
    const res = await upgradeTenantPlanAction();
    expect(res.success).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("upgrades only the caller's sandbox tenant", async () => {
    jar.value = "org_demo_123";
    const res = await upgradeTenantPlanAction();
    expect(res.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input.Item.PK).toBe("TENANT#org_demo_123");
  });
});
