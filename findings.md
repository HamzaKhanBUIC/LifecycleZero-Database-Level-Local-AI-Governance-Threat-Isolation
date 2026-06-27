# Findings: Tenant Routing Discovery & Auth Bypasses

## Discovery Summary
During local development under `NEXT_PUBLIC_SKIP_CLERK=true`, the `getTenantContext()` helper in `src/lib/auth.ts` unconditionally returns `org_demo_123`. This results in both `/security` (Enterprise Portal) and `/security?demo=true` (Sandbox Demo) loading the exact same tenant workspace data.

## Code Details
1. **`src/lib/auth.ts`**:
   ```typescript
   export async function getTenantContext() {
     if (process.env.NEXT_PUBLIC_SKIP_CLERK === "true") {
       return {
         tenantId: "org_demo_123",
         userId: "user_mock_admin"
       };
     }
     ...
   ```
2. **Dashboard views** (overview, assets, procurement) call `getTenantContext()` on the server side to determine which database entries to retrieve.

## Resolution Design
We will introduce a client-side session cookie named `lifecycle_tenant_id` that gets set when navigating to either:
- **Sandbox Demo**: Sets `lifecycle_tenant_id=org_demo_123`
- **Enterprise Portal**: Sets `lifecycle_tenant_id=org_real_impl`

On the server side, `getTenantContext()` will read this cookie from `next/headers` cookies. If Clerk skip mode is enabled, it returns the cookie value, falling back to `org_real_impl`.
This completely separates the two environments locally without requiring URL changes to existing pages or database table splits.

---

## 🔐 Real B2B Auth & Signup Discovery

We discovered two major issues that would prevent a real production authentication setup from working:

1. **Incorrect Middleware Filename (`src/proxy.ts`)**:
   - The edge middleware containing rate limiting and Clerk `auth.protect()` checks is named `src/proxy.ts`.
   - In Next.js, the middleware file **must** be named exactly `middleware.ts` (directly under `src/` or the project root) to be loaded by Next.js. Because of this, no authentication protection or rate-limiting is currently active during next dev/start!
   - **Resolution**: Create a symbolic link or rename/copy `src/proxy.ts` to `src/middleware.ts`.

2. **Clerk Webhook Synchronization (`src/app/api/webhooks/clerk/route.ts`)**:
   - The webhook currently only handles `organization.created` and `organization.updated`.
   - It **does not** synchronize organization memberships (such as `organizationMembership.created` or `organizationMembership.deleted`).
   - Consequently, when employees register or are assigned to an enterprise tenant in Clerk, they are never written to DynamoDB. This leaves the `Employee` directory (`PK: TENANT#<tenantId>`, `SK: EMP#<employeeId>`) completely empty for real tenants, breaking the assignment list.
   - **Resolution**: Expand the webhook handler to support `organizationMembership.created` and `organizationMembership.deleted` events to sync employee metadata.

3. **Missing Sign-In/Sign-Up Frontend Pages**:
   - In a production-grade Clerk auth system, when Clerk redirects unauthorized users to login, it points to `/sign-in` and `/sign-up` to render the embedded Clerk login widgets. Since these routes were completely missing, users would hit Next.js 404s.
   - **Resolution**: Create custom, glassmorphic sign-in and sign-up page routes using Clerk's `<SignIn />` and `<SignUp />` components.

4. **Hardcoded Environment Variable in package.json**:
   - The `npm run dev` script hardcoded `NEXT_PUBLIC_SKIP_CLERK=true`. This completely overrides `.env.local` settings, preventing the developer from ever testing the real authentication flow.
   - **Resolution**: Remove the hardcoded var from `package.json` and declare `NEXT_PUBLIC_SKIP_CLERK=true` inside `.env.local` instead, enabling easy toggling.


