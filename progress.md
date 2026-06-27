# Progress: Separating Workspace Portals

## Logs

### 2026-06-27
- Completed Requirements & Discovery.
- Created `task_plan.md` and `findings.md`.
- Implemented cookie-based tenant context routing:
  - Modified `src/lib/auth.ts` to check `lifecycle_tenant_id` cookie on the server.
  - Modified `src/app/page.tsx` (Welcome) to set `lifecycle_tenant_id` cookie on the client on button click and auto-redirect.
  - Modified `src/components/Dashboard.tsx` to keep the cookie synchronized with the active dropdown switcher tenant.
- Modified `src/app/dashboard/layout.tsx` to read the active tenant name dynamically from `getTenantContext()` instead of hardcoding `org_demo_123`.
- Implemented **Auto-Enrollment** in the telemetry ingest route (`src/app/api/ingest/route.ts`). New assets reporting telemetry are automatically enrolled on the fly, enabling zero-friction live device integrations (e.g. running `npm run agent <Asset-ID>` on the real laptop).
- Auth Setup & Webhooks:
  - Copied `src/proxy.ts` to `src/middleware.ts` to enable Next.js middleware execution.
  - Implemented `organizationMembership.created`, `organizationMembership.updated`, and `organizationMembership.deleted` webhook handling in `clerk/route.ts` to synchronize B2B members to the Employee directory in DynamoDB.
  - Exported `force-dynamic` in `layout.tsx` to resolve compiler dynamic routing warnings.
  - Created customized, glassmorphic sign-in and sign-up page routes using Clerk `<SignIn />` and `<SignUp />` widgets.
  - Updated `src/proxy.ts` and `src/lib/auth.ts` to perform a **dynamic bypass** checks. If the cookie matches a sandbox tenant (e.g. `org_demo_123`) or is launched via `?demo=true`, the system automatically bypasses Clerk auth.
  - For real tenants (e.g. clicking Enterprise Portal), the system enforces Clerk authentication and redirects visitors to our custom `/sign-in` page.
- Successfully built production bundle without warnings/errors.
