export async function getTenantContext() {
  // When Clerk is disabled, return mock context for demo tenant
  if (process.env.NEXT_PUBLIC_SKIP_CLERK === "true") {
    return {
      tenantId: "org_demo_123",
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
