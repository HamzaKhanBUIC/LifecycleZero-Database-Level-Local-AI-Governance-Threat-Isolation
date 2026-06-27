# LifecycleZero: Enterprise Architecture Playbook & Developer Guide

Welcome to the master technical reference for **LifecycleZero**—the local AI Governance and Threat Isolation SaaS platform. This playbook provides a complete blueprint of the platform's multi-tenant architecture, database schema, decoupled telemetry ingest queues, transactional isolation logic, newly implemented security controls, and step-by-step verification instructions.

---

## 🧭 1. Architectural System Overview

LifecycleZero is an enterprise B2B SaaS platform designed to govern local, decentralized AI activity on employee endpoints (laptops, workstations) and execute remote network containment when a data leakage threat is detected.

### The System Archetype (Decoupled SaaS Control Plane)
*   **The Ingestion Gateway & Dashboard (Next.js & Vercel)**: Serves as the administrative cockpit and API endpoint for telemetry logs.
*   **Decoupled Telemetry Buffer (AWS SQS)**: Queues high-velocity telemetry logs asynchronously, protecting the database from write lockouts.
*   **Asynchronous AI Risk Scorer (AWS Bedrock / Gemini)**: Pulls telemetry from the queue, evaluates files accessed against security policies, and flags anomalous behaviors.
*   **Serverless Database Partitioning (AWS DynamoDB)**: Stores fleet inventory, threat records, and SOC 2 custody logs using a cost-efficient Single-Table Design.
*   **The Monitoring Agent (Node.js Daemon)**: Lightweight, low-overhead daemon running on employee devices, streaming process metadata.

---

## 🏢 2. Multi-Tenant Database Architecture (DynamoDB Single-Table Design)

LifecycleZero consolidates all data entities into a single physical table (`LifecycleZero_Assets`) to enforce isolation boundaries, eliminate relational SQL join operations, and keep AWS database costs near zero.

### Data Model & Index Keys Layout

The following keys and sorting conventions are mapped to our single table:

| Entity | PK (Partition Key) | SK (Sort Key) | GSI1PK (Index 1) | GSI1SK (Index 1) | GSI2PK (Index 2 - Sparse) | GSI2SK (Index 2 - Sparse) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant Metadata** | `TENANT#<TenantId>` | `METADATA` | - | - | - | - |
| **Employee Profile** | `TENANT#<TenantId>` | `EMP#<EmployeeId>` | `DEPT#<Department>` | `EMP#<EmployeeId>` | - | - |
| **Hardware Asset** | `TENANT#<TenantId>` | `ASSET#<AssetId>` | `EMP#<EmployeeId>` | `STATE#<Status>` | `TENANT#<TenantId>#ACTION_REQ` *(if quarantined/pending)* | `DATE#<Timestamp>` |
| **Telemetry Heartbeat** | `TENANT#<TenantId>#TELEMETRY#SHARD#<0-9>` | `TELEMETRY#<AssetId>#<Timestamp>` | `ASSET#<AssetId>` | `DATE#<Timestamp>` | `TENANT#<TenantId>#ALERT#<Risk>` *(if alert triggers)* | `DATE#<Timestamp>` |
| **Procurement Request** | `TENANT#<TenantId>` | `PROCURE#<RequestId>` | `DEPT#<Department>` | `DATE#<Timestamp>` | `TENANT#<TenantId>#PENDING_PROCURE` *(if pending)* | `DEPT#<Dept>#DATE#<TS>` |
| **Audit Custody Log** | `TENANT#<TenantId>` | `AUDIT#<AssetId>#<Timestamp>` | - | - | - | - |

### Key Indexing Strategies
1.  **Logical Tenant Isolation**: Multi-tenant privacy is enforced at the database level by partitioning all core records using the `PK = TENANT#<TenantId>` prefix. Tenant contexts are resolved server-side from secure Clerk B2B cookies, making it impossible for one company to access or query keys belonging to another.
2.  **Sparse GSI2 (Cost Optimization)**: 99.9% of telemetry logs are benign and do not need to be scanned on the dashboard. Index attributes (`GSI2PK` and `GSI2SK`) are **only populated** on telemetry records flagged as `CRITICAL` or `WARNING`. The admin dashboard queries `GSI2` directly, loading active alerts in milliseconds with zero-cost O(1) index scans instead of expensive table scans.
3.  **Automatic Data Pruning (TTL)**: Telemetry records are tagged with a 90-day Unix epoch. DynamoDB's background engine purges expired items at no cost, preventing storage bloat.

---

## ⚡ 3. The Telemetry & Ingestion Pipeline

To process heartbeats from thousands of endpoints without driving up database usage, LifecycleZero uses a decoupled, event-driven pipeline:

```
[Local Agent Daemon]
        │ (POST /api/ingest + X-Agent-Key + Hardware UUID)
        ▼
[Next.js Gateway API] ──► Checks Isolation: If ISOLATED ──► Returns 403 Forbidden
        │
        ▼ (Queue Telemetry)
[AWS SQS Buffer Queue] (Instant 202 Accepted response, sub-50ms latency)
        │
        ▼ (Continuous long-polling container worker)
[Fargate SQS Queue Worker]
        │
        ├─► Evaluates risk via Bedrock AI (Claude 3 Haiku)
        ├─► Writes telemetry metrics to sharded table partition
        └─► Updates Asset LastHeartbeat and logs alert to Sparse GSI2
```

---

## 🔐 4. ACID Containment Transactions

When a security administrator isolates a host, transactional consistency is critical for SOC 2 and ISO 27001 compliance. LifecycleZero uses DynamoDB's `TransactWriteItems` to execute the isolation command:

1.  **ConditionCheck & Asset Update**: Checks that the asset exists in the partition (`attribute_exists(PK)`) and its current status is active (not already `ISOLATED`). Updates `Status` to `ISOLATED`.
2.  **Immutable Audit Log**: Appends a chronological custody log (`SK = AUDIT#<AssetId>#<Timestamp>`) detailing the operator ID, name, isolation reason, and timestamp.

If either step fails or is interrupted, DynamoDB rolls back the entire transaction instantly, preventing fragmented or un-audited isolation states.

---

## 🛠️ 5. Built-in Security & Scalability Features

The platform includes three advanced security and scaling mechanisms directly in the codebase:

### 1. Host-Specific Agent Key Rotation
*   **The Flow**: The first time a daemon is booted on an endpoint, it authenticates using the global tenant enrollment key (`AGENT_API_KEY`).
*   **Key Rotation**: The ingestion API registers the device, generates a unique, cryptographically random `AgentKey`, saves it on the asset record, and returns it in the `202 Accepted` JSON payload.
*   **Credential Caching**: The daemon receives this unique key and caches it in memory, using it for all future telemetry requests. Subsequent pings must match this host-specific key or they are rejected as `401 Unauthorized`.

### 2. Device Spoofing Mitigation (Anti-Tampering)
*   **Hardware Signature**: During the initial handshake, the daemon queries the physical device's BIOS serial number or motherboard UUID (using OS-specific commands: `wmic` on Windows, `system_profiler` on macOS, or `/sys/class/dmi` on Linux).
*   **Signature Enforcement**: The UUID is saved on the asset. On future telemetry pings, if the incoming payload has a mismatched `hardwareUuid`, the API gateway rejects it as a `SPOOFING_ATTEMPT` (`400 Bad Request`), preventing malicious users from spoofing another laptop's status.

### 3. Database Write Sharding
*   **Telemetry Sharding**: Raw telemetry writes partition keys are sharded across 10 physical partitions: `TENANT#<TenantId>#TELEMETRY#SHARD#<0-9>` using a random hashing function.
*   **Throughput Scale**: This distributes the write load, raising write throughput limits to 10,000 WCUs/sec (capable of scaling to 50,000+ endpoints per tenant) while keeping dashboard global queries fast and responsive.

---

## 🧪 6. Step-by-Step Developer Verification Guide

Follow these steps to spin up and test all platform components locally:

### Step 1: Run local DynamoDB
Make sure Docker is running on your machine, then start the DynamoDB local container:
```bash
docker run -d -p 8000:8000 --name lifecycle-dynamo amazon/dynamodb-local
```

### Step 2: Initialize & Seed Database
Provision the local tables and populate the default demo workspaces:
```bash
# Provision the DynamoDB schemas
npm run db:provision-local

# Seed mock fleet cohort (120 assets, employees, active alerts)
npm run db:seed-local
```

### Step 3: Run the Ingest Queue Worker
The background worker pulls telemetry from the queue, executes AI risk heuristics, and writes metrics. Start it in a terminal:
```bash
npm run worker
```

### Step 4: Run the Next.js Dev Server
Start the Next.js application in another terminal window:
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```
*Note: Binding to `0.0.0.0` allows other local network devices (like your phone) to connect to `http://<your-pc-ip>:3000`.*

### Step 5: Run the Integration Test Suite
To verify the database transaction boundaries, condition checks, sparse indexes, and edge gateway rules:
```bash
npm run test:integration
```

### Step 6: Connect a Real Device
To register and stream telemetry from an active device:
1. Open a terminal and run:
   ```bash
   npm run agent MY-TEST-LAPTOP
   ```
2. The agent daemon boots, queries its hardware UUID, performs the key rotation handshake, and starts streaming metrics every 3–7 seconds.
3. Open the Hardware Fleet (`/dashboard/assets`) in your browser to view your device.

---

## 💵 7. B2B SaaS Economics & Pricing

LifecycleZero is highly profitable due to its serverless, pay-per-use backend architecture.

### Monthly Unit Economics (Per 200 Endpoints)
*   **Infrastructure Costs**:
    *   *AWS SQS Ingestion Buffer*: 103.68M pings/mo = **$41.07 / month**
    *   *AWS DynamoDB (Coalesced writes + TTL)*: **$10.80 / month**
    *   *AWS Bedrock AI Evaluation (Claude 3 Haiku on 0.1% traffic)*: **$5.18 / month**
    *   **Total Infrastructure Cost: $57.05 / month**
*   **B2B SaaS Revenue**:
    *   *Subscription Price*: $8.00 per monitored endpoint per month.
    *   *Gross Monthly Revenue (200 Endpoints)*: 200 * $8.00 = **$1,600.00 / month**
*   **Profit Margins**:
    *   **96.4% Gross Profit Margin** ($1,542.95 net profit per month per customer).
