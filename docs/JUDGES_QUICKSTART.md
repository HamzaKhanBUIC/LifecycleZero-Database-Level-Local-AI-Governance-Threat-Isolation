# LifecycleZero: Judges & Compliance Auditor Quickstart Guide

Welcome to the **LifecycleZero** evaluation guide. The platform is designed to support two distinct evaluation tracks: a pre-populated **Simulated Sandbox** (for rapid evaluation) and a secure **Real B2B Enterprise Portal** (using Clerk B2B Auth and real-time telemetry).

---

## 🔬 Route A: The Judges Sandbox Demo (Bypasses Auth)
This is the recommended path for a rapid walk-through of the security cockpit's interactive capabilities.

### Step 1: Launch the Sandbox
1. Navigate to the root URL `http://localhost:3000/`.
2. Click **LAUNCH SANDBOX DEMO** (or go directly to `http://localhost:3000/security?demo=true`).
3. You will enter the dashboard immediately without any login prompt. A purple banner will verify: `[🔬 ACTIVE JUDGES SANDBOX MODE — PREPOPULATED SIMULATED FLEET ACTIVE]`.

### Step 2: Inject Threats & Audit Logs
1. Locate the **Threat Simulation Sandbox** card in the bottom-right sidebar.
2. Select a threat scenario (e.g. `llama.cpp Accessing auth_tokens.json (Critical)`).
3. Click **RUN THREAT SIMULATION**.
4. The simulated local terminal will output the telemetry logs, SQS queuing result, and AI risk analysis in real time. An alarm alert will trigger.
5. In the **Security Incident Feed**, you will see the active threat step-by-step audit, showing the AI reasoning from AWS Bedrock / Gemini.

### Step 3: Trigger Device Isolation
1. Click **ISOLATE HOST** on the incident card.
2. A security confirmation modal will appear. Type an isolation reason (e.g., `Suspicious local AI activity`) and click **Confirm Isolation**.
3. The Tactical 3D Grid will update instantly, transitioning the host cell to red/grey (Isolated).
4. Future telemetry from this host is blocked at the gateway edge (returning `403 FORBIDDEN_ISOLATED`).
5. Click **RESET SANDBOX** in the top purple banner at any time to restore the sandbox database to its pristine pre-seeded state.

---

## 🏢 Route B: The Real B2B Enterprise Portal (Enforces Clerk)
This path verifies the production-grade multi-tenant B2B onboarding, custom Clerk authentication widgets, and webhook database synchronization.

### Step 1: Login & Organization Provisioning
1. Navigate to `http://localhost:3000/` and click **ENTERPRISE PORTAL** (or go to `http://localhost:3000/security`).
2. The Next.js Edge Middleware will intercept the request and redirect you to the styled `/sign-in` page.
3. Sign Up for a new account.
4. Once registered, create a new B2B Organization (e.g., "Acme Security").
5. Clerk will send a secure webhook event to `/api/webhooks/clerk`, registering the organization and sync-populating the employee directory in DynamoDB.

### Step 2: Initialize or Connect Local Hardware
1. Upon logging in, you will notice your organization's Fleet Directory is **completely empty** (the real environment starts blank, as requested by the client).
2. **Path 1 (Mock Initializer)**: Click the **INITIALIZE THREAT GRID** button inside the Tactical Grid card. This will populate your organization's database partition with a fresh cohort of assets, allowing you to run local simulations.
3. **Path 2 (Real Device Integration)**: Connect your own computer!
   - Run the following command in your terminal:
     ```bash
     npm run agent MY-LAPTOP
     ```
   - The daemon will boot, register itself dynamically at `/api/ingest`, auto-enroll your laptop into the database fleet, and stream local processes, CPU, RAM, and network egress telemetry directly to your admin console!
   - Navigate to `/dashboard/assets` to view your laptop in the active hardware directory.

### Step 3: Export Compliance Trails
1. Click **EXPORT CSV** or **EXPORT JSON** in the top navbar to download the secure SOC 2 compliance ledger, which records all administrative isolation actions and historical audit logs.
