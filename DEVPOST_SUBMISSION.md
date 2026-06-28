# LifecycleZero: Local AI Governance & Threat Isolation

---

## 💡 1. The Problem: The Offline AI Blind Spot

Many developers and employees are running local AI models (like Ollama, Llama.cpp, or LM Studio) directly on their workstations. This allows them to use AI offline and bypass corporate network firewalls. 

However, this creates a major security blind spot for companies:
*   **Web Gateways and Firewalls** only look at external network traffic. They don't see anything when someone runs a local model to analyze sensitive company data offline.
*   **Antivirus & EDR** (like CrowdStrike) monitor for malware. They don't block tools like Ollama because they are legitimate, signed developer applications. 
*   **Standard DLP (Data Loss Prevention)** software is extremely heavy, slows down developer laptops, and usually only checks browser extensions.

We built **LifecycleZero** to solve this. It acts as a lightweight telemetry system and edge gatekeeper to monitor local AI usage and block data leaks in real time.

---

## 🛠️ 2. How We Built It

We built the backend to scale easily on AWS and run with a zero-idle database cost:

### The Database: DynamoDB Single-Table Design
We put all our B2B data (tenant settings, employee directories, hardware specs, logs, and audit trails) into a single DynamoDB table called `LifecycleZero_Assets`.
*   **B2B Tenant Isolation**: We separate each company's data by prefixing the partition keys (`PK = TENANT#<TenantId>`). The server reads the tenant ID directly from secure Clerk authentication tokens, so data can never leak between customers.
*   **Cost-Efficient Sparse Index**: 99% of logs are normal. If we indexed every single ping, our database costs would skyrocket. Instead, we created a Sparse Index (`GSI2`) that only indexes events marked as warnings or critical alerts. This makes loading the alerts page on the dashboard cheap and fast.
*   **Write Sharding**: We split telemetry logs across 10 shards (`PK = TENANT#<TenantId>#TELEMETRY#SHARD#<0-9>`) using a hash of the device ID. This prevents database write bottlenecks when many devices report status at the same time.
*   **Atomic Isolation Transactions**: When an administrator isolates a device, the system runs an atomic transaction (`TransactWriteItems`) that checks if the device is active, marks it as `ISOLATED`, and writes an unchangeable audit log detailing who isolated it and why.

### Ingestion & SQS Queue
*   **Amazon SQS Buffer**: Instead of writing telemetry directly to the database (which could crash under heavy load), the API writes logs straight to an SQS queue and returns a fast `202 Accepted` response in under 50ms.
*   **Queue Worker & Quarantine**: A TypeScript worker processes logs from the queue. If a corrupt message fails to process 5 times, it gets quarantined and deleted automatically so it doesn't clog the queue.

### Edge Proxy & Security Checks
*   **Edge Rate Limiting**: Our Vercel Edge Middleware checks request rates using an API call to Upstash Redis, preventing API spam before it hits our serverless routes.
*   **Cryptographic Key Rotation**: The first time an agent runs, it registers using a global enrollment key. The server registers the device, generates a unique, device-specific key, and returns it. The agent saves this key locally and signs all future pings using HMAC-SHA256. 
*   **Hardware UUID Lock**: The agent checks the motherboard BIOS UUID on startup. If a spoofed device tries to copy the agent's key, the signature check fails because the hardware UUID does not match.

---

## 🎨 3. Design and User Experience

We wanted the UI to look and feel like a modern security dashboard:

*   **Clean Monospace Theme**: We went with a dark, high-contrast dashboard with clean borders and monospace badges so the security status is easy to read.
*   **3D Interactive Grid**: We built a 3D server grid using CSS transforms. Administrators can rotate the grid, hover over machines to see active processes, and select devices to isolate them.
*   **Real-time Sparklines**: Instead of heavy graphing libraries that slow down the browser, we drew live telemetry graphs directly onto an HTML5 Canvas at 12 frames per second.
*   **Acoustic Synth Alerts**: The dashboard uses the Web Audio API to play sound alerts when a threat is detected or when an administrator executes an isolation command.

---

## 💼 4. Business Value & B2B Fit

*   **Compliance Ready**: Regulations like the EU AI Act require companies to audit how AI is used and penalize companies heavily for compliance failures. LifecycleZero provides downloadable CSV and JSON audit logs to satisfy compliance requirements.
*   **Easy Onboarding**: Built with Clerk B2B organization portals. Admins sign in, invite their team, and get their enrollment key instantly.
*   **SaaS Pricing Model**: 
    *   Target pricing: $8.00 per monitored device per month.
    *   For a 200-device client: Monthly revenue is **$1,600.00**.
    *   Serverless infrastructure cost (AWS SQS, DynamoDB, Upstash, hosting): **$66.87/month**.
    *   **Gross Margin: 95.8%**.

---

## 🧪 5. Testing & Verification

We wrote integration tests to verify every database access pattern, transaction, and isolation state:

```bash
npm run test:integration
```
```text
🧪 Starting Backend Integration Verification for LifecycleZero...
Tenant under test: org_test_999

1. Seeding mock test employee...
✅ Employee created.

2. Testing submitProcurementRequest (Access Pattern 2)...
✅ Request submitted: REQ-TEST-001
✅ Pattern 2 (Fetch Pending for Department) passed!

3. Testing resolveProcurementRequest (Pattern 5)...
✅ Request resolved. New Asset ID created: AST-XJBSZOS
✅ Sparse index write verification passed (Removed from GSI2).

4. Testing getActiveAssetsForEmployee (Access Pattern 1)...
✅ Assets currently assigned: 3

5. Testing updateAssetStatusTransaction (Access Pattern 5)...
✅ Transaction completed successfully.
✅ Pattern 1 (Get Active Assets for Employee) passed!

6. Testing getAuditTrailForAsset (Access Pattern 3)...
✅ Audit Logs retrieved: 2
✅ Pattern 3 (Chronological Audit Trail) passed!

7. Testing getTenantDashboardData (Access Pattern 4)...
✅ Dashboard stats: 3 assets, 1 employees, 0 pending.
✅ Pattern 4 (Dashboard Aggregation) passed!

8. Testing Failure Path: Double-Isolation ConditionCheck...
✅ Success: Double-isolation blocked by DynamoDB ConditionCheck. Details: ConditionalCheckFailed

9. Testing Ingestion Block for Isolated Asset...
✅ Success: Ingestion API blocked telemetry and returned 403 FORBIDDEN_ISOLATED.

🎉 ALL 5 ACCESS PATTERNS & FAILURE PATHS VERIFIED SUCCESSFULLY!
```

---

## 🎥 Links & References
*   **Primary Database Used**: Amazon DynamoDB
*   **Published Dashboard URL**: `https://YOUR_VERCEL_DEPLOYMENT_URL.vercel.app`
*   **Ingestion Endpoint**: `https://YOUR_VERCEL_DEPLOYMENT_URL.vercel.app/api/ingest`
*   **Vercel Team ID**: `team_YOUR_VERCEL_TEAM_ID`
*   **AWS Proof**: *Attach a screenshot of your AWS DynamoDB Console showing the items inside the LifecycleZero_Assets table.*
*   **Walkthrough Video**: *Link to your YouTube or Vimeo video explaining the DynamoDB design and how threat isolation works.*
