import { cookies } from "next/headers";

export async function getTenantContext() {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get("lifecycle_tenant_id")?.value;

  const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
  const isSandbox = allowedSandboxTenants.includes(tenantCookie || "");

  // When Clerk is bypassed globally OR the user is in the sandbox demo workspace, return mock context
  if (process.env.NEXT_PUBLIC_SKIP_CLERK === "true" || isSandbox) {
    return {
      tenantId: tenantCookie || "org_demo_123",
      userId: "user_mock_admin"
    };
  }

  // Only load Clerk auth when a valid publishable key exists
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pubKey || !pubKey.startsWith("pk_")) {
    return {
      tenantId: "org_demo_123",
      userId: "user_mock_admin"
    };
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { orgId, userId } = await auth();

  if (!orgId) {
    if (userId) {
      return {
        tenantId: `USER_${userId}`,
        userId: userId
      };
    }
    throw new Error("Unauthorized: No organization selected.");
  }

  return {
    tenantId: orgId,
    userId: userId
  };
}
