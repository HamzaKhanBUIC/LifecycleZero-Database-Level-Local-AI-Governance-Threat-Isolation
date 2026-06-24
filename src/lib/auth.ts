import { auth } from "@clerk/nextjs/server";

export async function getTenantContext() {
  const { orgId, userId } = await auth();

  if (!orgId) {
    throw new Error("Unauthorized: No organization selected.");
  }

  return {
    tenantId: orgId,
    userId: userId
  };
}
