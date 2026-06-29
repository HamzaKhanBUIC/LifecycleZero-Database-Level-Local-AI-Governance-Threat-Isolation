# LifecycleZero: Technical Architecture & Feature Activity Flowcharts

This document compiles the technical system blueprints, feature-specific activity flows, and execution timelines mapping out the exact functions and pings called during LifecycleZero security events.

---

## 🗺️ 1. Global Technical System Architecture

The following diagram maps the decoupled network boundaries and functional database segments.

```mermaid
graph TD
    %% Styling Classes
    classDef client fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef gateway fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff
    classDef buffer fill:#78350f,stroke:#f59e0b,stroke-width:2px,color:#fff
    classDef worker fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
    classDef database fill:#172554,stroke:#3b82f6,stroke-width:2px,color:#fff

    subgraph Client [Workstation Agent]
        Daemon[Agent CLI Client]
        Signer[HMAC-SHA256 Signer]
        Cache[Key Cache File]
    end
    Daemon --- Signer
    Daemon --- Cache
    class Daemon,Signer,Cache client

    subgraph Edge [Next.js Control Plane]
        Middleware[Proxy Middleware]
        IngestAPI[Ingest Gateway API]
        MetadataCheck[Metadata / Limit Check]
        HMACCheck[HMAC Validator]
    end
    Middleware --> IngestAPI
    IngestAPI --- HMACCheck
    HMACCheck --- MetadataCheck
    class Middleware,IngestAPI,MetadataCheck,HMACCheck gateway

    subgraph Queue [Buffering Plane]
        SQS[Amazon SQS Queue]
    end
    class SQS buffer

    subgraph WorkerPlane [Threat Engine]
        Worker[Fargate Worker Daemon]
        Heuristics[Heuristics Engine]
        Ollama[Local Ollama instance]
    end
    Worker --- Heuristics
    Heuristics --- Ollama
    class Worker,Heuristics,Ollama worker

    subgraph Storage [Single-Table Storage]
        DynamoDB[(AWS DynamoDB)]
        SparseIndex[Sparse GSI2 Alert Index]
    end
    DynamoDB --- SparseIndex
    class DynamoDB,SparseIndex database

    %% Workflows
    Daemon -->|1. Post Telemetry with HMAC| Middleware
    MetadataCheck -->|2. Queue Buffered Payload| SQS
    SQS -->|3. Long Poll (20s)| Worker
    Worker -->|4. Heuristics / Local LLM Risk Analysis| Ollama
    Worker -->|5. Batch PutItem| DynamoDB
```

---

## 🏎️ 2. Feature Activity Flowcharts & Function Execution

### 📥 Flow A: Telemetry Ingestion, HMAC Attestation, & Quota Check
*   **Trigger**: Workstation agent streams system process metrics to the cloud control plane.
*   **Feature Goal**: Validate client identity, verify payload signature, verify active payment status, enforce endpoint quota, and buffer message in SQS.

```mermaid
autonumber
activityBeta
title Telemetry Ingestion Activity Flow

Agent->>Edge: POST /api/ingest (Payload + X-Agent-Signature)
Note over Edge: getTenantContext()
alt Sandbox Tenant Whitelisted? (org_demo_123)
    Edge->>Edge: Bypass Clerk Authentication
else Production Tenant
    Edge->>Edge: Enforce Clerk JWT Session Validation
end

Note over Edge: getTenantMetadata(tenantId)
Edge->>DB: Query Tenant Metadata PK = TENANT#<TenantId>, SK = METADATA
DB-->>Edge: Return Plan, Status, MaxAllowedEndpoints

alt Status is SUSPENDED?
    Edge-->>Agent: Return 403 Forbidden (TENANT_SUSPENDED)
    Note over Edge: Abort Execution
end

alt New Endpoint Enrolling?
    Edge->>DB: Query Current Active Count PK = TENANT#<TenantId>, begins_with(SK, "ASSET#")
    DB-->>Edge: Return Enrolled Node Count
    alt Count >= MaxAllowedEndpoints?
        Edge-->>Agent: Return 402 Payment Required (INGESTION_QUOTA_EXCEEDED)
        Note over Edge: Abort Execution
    end
end

Note over Edge: HMAC Validation
Edge->>DB: Query Rotated AgentKey for AssetId
DB-->>Edge: Return HMAC Secret Key
Edge->>Edge: crypto.timingSafeEqual(CalculatedHMAC, X-Agent-Signature)
alt Signatures Mismatch?
    Edge-->>Agent: Return 401 Unauthorized (SIGNATURE_MISMATCH)
    Note over Edge: Abort Execution
end

Edge->>SQS: SendMessageCommand (Queue Telemetry)
SQS-->>Edge: SQS Enqueue Confirmation
Edge-->>Agent: Return 202 Accepted (Queued)
```

---

### 🕵️ Flow B: Asynchronous Threat Analyzer (Queue Worker)
*   **Trigger**: Message arrives in Amazon SQS queue.
*   **Feature Goal**: Process telemetry, evaluate risks completely offline, update asset records, and index alerts in a Sparse Secondary Index (GSI2).

```mermaid
autonumber
activityBeta
title Queue Worker Threat Analysis Flow

Worker->>SQS: ReceiveMessageCommand (Long Poll 20s)
SQS-->>Worker: Return Telemetry Payloads

alt Receive Count > 5? (Poison Pill Check)
    Worker->>SQS: DeleteMessageCommand (Quarantine Dead Message)
    Note over Worker: Skip to next message
end

Note over Worker: Heuristics Assessment
alt Match Obvious Rogue Signatures? (Obfuscated paths, id_rsa, .env)
    Worker->>Worker: Flag RiskLevel = CRITICAL / WARNING
else Clean / Unknown Obfuscations
    Note over Worker: Offline Ollama Assessment
    Worker->>Ollama: POST /api/generate (llama3/qwen2.5-coder)
    Ollama-->>Worker: Return JSON Risk Report (riskLevel, reasoning)
end

Note over Worker: Batch Write Mapping
Worker->>DB: PutItem (PK = TENANT#<TenantId>#TELEMETRY#SHARD#<0-9>, SK = TELEMETRY#<AssetId>#<Timestamp>)
alt RiskLevel is WARNING or CRITICAL?
    Note over Worker: Populate Sparse Index Attributes
    Worker->>DB: PutItem GSI2PK = TENANT#<TenantId>#ALERT#<RiskLevel>, GSI2SK = DATE#<Timestamp>
else RiskLevel is SAFE
    Note over Worker: Ignore Sparse Index Attributes (Save WCU Costs)
end

Worker->>DB: UpdateItem (PK = TENANT#<TenantId>, SK = ASSET#<AssetId>, Set LastHeartbeat = TS)
Worker->>SQS: DeleteMessageCommand (Prune Processed Message)
```

---

### 🔒 Flow C: Emergency Host Network Isolation (ACID Custody Transaction)
*   **Trigger**: Security administrator clicks "ISOLATE HOST" on the SOC Dashboard.
*   **Feature Goal**: Atomically isolate the endpoint device and write an audit log utilizing database ACID transactions.

```mermaid
autonumber
activityBeta
title Emergency Isolation Activity Flow

Admin->>Dashboard: Clicks "Isolate Host" button
Dashboard->>Dashboard: Open Confirm Modal & prompt for Isolation Reason
Admin->>Dashboard: Submits Isolation Reason & clicks "Confirm"
Dashboard->>APIWrapper: Call LifecycleZeroAPI.updateAssetStatusAction(tenantId, assetId, "ISOLATED")
APIWrapper->>ServerAction: Invoke updateAssetStatusTransaction(tenantId, assetId, "ISOLATED")

Note over ServerAction: TransactWriteItems Action
ServerAction->>DB: Item 0: ConditionCheck (Status is ACTIVE & attribute_exists(PK))
ServerAction->>DB: Item 1: UpdateItem (Set Status = ISOLATED)
ServerAction->>DB: Item 2: PutItem (SK = AUDIT#<AssetId>#<Timestamp>, Action = DEPLOY_ISOLATION)

alt Transaction Successful?
    DB-->>ServerAction: ACID Transaction Committed
    ServerAction-->>APIWrapper: Return { success: true }
    APIWrapper-->>Dashboard: Return Success Response
    Dashboard->>Dashboard: Trigger audio.playClick() (Acoustic confirmation)
    Dashboard->>Dashboard: Mutate SWR Cache, visual grid cell transitions to RED (Isolated)
else Transaction Fails? (e.g. Host already isolated)
    DB-->>ServerAction: TransactionCanceledException
    ServerAction-->>APIWrapper: Return { success: false, error }
    APIWrapper-->>Dashboard: Return Error Response
    Dashboard->>Dashboard: Toast Alert "ALERT_COMMAND_FAILED"
end
```

---

### 💳 Flow D: B2B stripe Billing Checkout Upgrade
*   **Trigger**: B2B Tenant Admin clicks "UPGRADE TO ENTERPRISE" on the Billing Card.
*   **Feature Goal**: Collect payment credentials securely, upgrade plan metadata in DynamoDB, and lift Edge rate limits.

```mermaid
autonumber
activityBeta
title B2B Subscription Upgrade Flow

Admin->>Dashboard: Clicks "⚡ UPGRADE TO ENTERPRISE"
Dashboard->>Dashboard: Open Stripe Checkout Modal
Admin->>Dashboard: Inputs Cardholder Name & test card number (4242 4242 4242 4242)
Admin->>Dashboard: Clicks "CONFIRM UPGRADE"
Dashboard->>Dashboard: Set isUpgrading = true & show processing state (2s delay)
Dashboard->>APIWrapper: Call LifecycleZeroAPI.upgradeTenantPlanAction(tenantId)
APIWrapper->>ServerAction: Invoke upgradeTenantPlanAction(tenantId)

ServerAction->>DB: PutItem PK = TENANT#<TenantId>, SK = METADATA (Plan = ENTERPRISE, Limit = 150, Status = ACTIVE)
DB-->>ServerAction: Database Write Complete
ServerAction-->>APIWrapper: Return { success: true }
APIWrapper-->>Dashboard: Return Success Response
Dashboard->>Dashboard: Set showPaymentModal = false, play acoustic click sound
Dashboard->>Dashboard: Mutate SWR Dashboard Cache
Dashboard->>DB: Poll getTenantMetadataAction()
DB-->>Dashboard: Returns upgraded plan metadata (ENTERPRISE, Limit = 150)
Dashboard->>Dashboard: Update UI progress bar and active status badges
```
