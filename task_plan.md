# Task Plan: Implementing Custom Clerk Auth Pages & Enforcing Auth Rules

This plan outlines how we will add custom sign-in/sign-up routes using Clerk B2B components, configure middleware to protect all secure routes (`/security` and `/dashboard/*`), and move the Clerk bypass flag out of `package.json` into `.env.local` to allow toggling it on/off.

## Goal
Enable full Clerk sign-in and sign-up flows in local dev mode when `NEXT_PUBLIC_SKIP_CLERK=false` is set in `.env.local`, while maintaining the default skip-clerk bypass so judges can view it without setup.

## Current Phase
Phase 7: Delivery

## Phases

### Phase 1: Planning & Setup
- [x] Audit codebase folders and configuration (`.env.local`, `src/app`, `src/lib`)
- [x] Design cookie-based tenant routing for local development
- **Status:** complete

### Phase 2: Create Planning Files
- [x] Create `task_plan.md` in workspace root (this file)
- [x] Create `findings.md` in workspace root
- [x] Create `progress.md` in workspace root
- **Status:** complete

### Phase 3: Auth Context & Cookie Integration
- [x] Modify `src/lib/auth.ts` to read the `lifecycle_tenant_id` cookie in local dev mode (defaulting to `org_real_impl` if absent)
- [x] Modify `src/app/page.tsx` (Welcome page) to set client-side cookies before navigating to `/security` vs `/security?demo=true`
- [x] Modify `src/components/Dashboard.tsx` to set the cookie in `useEffect` (for initial load) and `onChange` (for tenant dropdown switches)
- **Status:** complete

### Phase 4: Verification and Testing
- [x] Start dev server
- [x] Test **Enterprise Portal** route: Verify it loads `org_real_impl` as an empty slate (total assets = 0, no mock data, no demo banner)
- [x] Test **Sandbox Demo** route: Verify it loads `org_demo_123` with pre-populated data and the sandbox reset banner
- [x] Connect local agent script (`npm run agent MY-LAPTOP`) targeting `org_real_impl` and confirm it populates the Real portal only
- **Status:** complete

### Phase 5: Auth Setup & Webhooks
- [x] Copy `src/proxy.ts` to `src/middleware.ts` to enable Next.js middleware routing
- [x] Add `organizationMembership` webhook events in `clerk/route.ts`
- **Status:** complete

### Phase 6: Custom Sign-In/Sign-Up Pages & Config Toggles
- [x] Create `/src/app/sign-in/[[...sign-in]]/page.tsx` with Clerk's `<SignIn />` component and beautiful dark styling
- [x] Create `/src/app/sign-up/[[...sign-up]]/page.tsx` with Clerk's `<SignUp />` component and beautiful dark styling
- [x] Modify `src/middleware.ts` (formerly `proxy.ts`) to protect `/security` alongside `/dashboard` routes when Clerk is active
- [x] Add `NEXT_PUBLIC_SKIP_CLERK=true` to `.env.local`
- [x] Modify `package.json` to remove the hardcoded `NEXT_PUBLIC_SKIP_CLERK=true` from `npm run dev` so it respects `.env.local`
- **Status:** complete

## Key Questions
1. **Should the sandbox reset button wipe org_real_impl?** No, the seeder whitelist only permits `org_demo_123`, `org_fintech_456`, and `org_healthco_789` to be reset.
2. **How does Next.js know which tenant context to load on subpages (e.g. /dashboard/assets)?** Next.js reads the `lifecycle_tenant_id` cookie from the headers inside `getTenantContext()` on the server side.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a cookie (`lifecycle_tenant_id`) to track active tenant | Enables server components and server actions to know which tenant the developer is currently viewing/modifying under SKIP_CLERK local dev mode. |
| Use dynamic cookie and query check for middleware protection | Allows bypassing authentication automatically for the Judges Sandbox Demo workspace, while enforcing Clerk sign-in blocks for the Enterprise Portal workspace. |
