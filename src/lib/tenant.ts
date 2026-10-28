/**
 * Single source of truth for "which tenant is this request acting on".
 *
 * The tenant is NEVER taken from client input (server action arguments, request
 * bodies or query strings). It is derived only from:
 *   1. the sandbox cookie, and only when it names one of the fixed public sandbox
 *      tenants below (they hold demo data, so the cookie can never select a real tenant);
 *   2. the Clerk session: the active organization, or a personal `USER_<userId>` workspace.
 *
 * Without a Clerk session (and outside the sandbox) requireTenant() throws UnauthorizedError.
 */

export const SANDBOX_TENANTS = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
export const DEFAULT_SANDBOX_TENANT = "org_demo_123";
export const TENANT_COOKIE = "lifecycle_tenant_id";
export const SANDBOX_USER_ID = "user_mock_admin";

export interface TenantContext {
  tenantId: string;
  userId: string;
  isSandbox: boolean;
}

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized: sign in and select an organization.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function isSandboxTenant(tenantId?: string | null): tenantId is string {
  return !!tenantId && SANDBOX_TENANTS.includes(tenantId);
}

function sandboxContext(tenantId: string): TenantContext {
  return { tenantId, userId: SANDBOX_USER_ID, isSandbox: true };
}

function isClerkConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_SKIP_CLERK === "true") return false;
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return !!pubKey && pubKey.startsWith("pk_");
}

export async function requireTenant(): Promise<TenantContext> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get(TENANT_COOKIE)?.value;

  // Public sandbox (judges demo): only the fixed sandbox tenants can be selected.
  if (isSandboxTenant(tenantCookie)) {
    return sandboxContext(tenantCookie);
  }

  // Clerk disabled (local development): only the default sandbox tenant is reachable.
  if (!isClerkConfigured()) {
    return sandboxContext(DEFAULT_SANDBOX_TENANT);
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { orgId, userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  return {
    tenantId: orgId || `USER_${userId}`,
    userId,
    isSandbox: false
  };
}
