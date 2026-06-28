# LifecycleZero: B2B Enterprise Portal & Governance Guidelines

> **Status Notice:** LifecycleZero is currently in its **Prototype & Testing Phase**. All core mechanics (Edge rate-limiting, Clerk authentication, sharded database writes, local-only AI threat classification, and hardware BIOS UUID handshakes) are fully built, functional, and ready for deployment.

This guide details the architectural rules, authentication integrations, device registration protocols, and database management guidelines for the **LifecycleZero B2B Enterprise Portal**.

---

## 1. Executive B2B System Architecture

In the production Enterprise Portal, LifecycleZero uses a decoupled, event-driven model to ensure data privacy and scalable multi-tenancy.

```
                      ┌───────────────────────────────┐
                      │    Client Workstation Node    │
                      │    (Native Telemetry Agent)   │
                      └───────────────┬───────────────┘
                                      │
                      HTTP POST (Telemetry, Hardware UUID)
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │      Vercel Edge Proxy        │
                      │   (Clerk Auth & Edge Blocks)  │
                      └───────────────┬───────────────┘
                                      │
                         403 Block (If ISOLATED)
                                      │
                        Queue Payload (If ACTIVE)
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    AWS SQS Ingestion Queue    │
                      │  (Returns Instant 202 Response)│
                      └───────────────┬───────────────┘
                                      │
                                Pull Telemetry
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │     Fargate Queue Worker      │
                      │  (Local Ollama / Heuristics)  │
                      └───────────────┬───────────────┘
                                      │
                                Sharded Writes
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  Amazon DynamoDB Single-Table  │
                      │   (Tenant-Isolated Partition) │
                      └───────────────────────────────┘
```

* **Data Isolation:** Enforced strictly at the primary key level. All client admin queries are filtered by `PK = TENANT#<TenantId>`, preventing cross-tenant leakage.
* **Telemetry Write Sharding:** To handle massive device scales, telemetry logs are sharded into 10 partitions (`TENANT#<TenantId>#TELEMETRY#SHARD#<0-9>`) using a polynomial hash modulo 10 on the `AssetId`.
* **Privacy-First AI Evaluation:** Rather than sharing sensitive telemetry or file events with third-party cloud models (like AWS Bedrock or external OpenAI/Gemini), all analysis runs **completely locally** using a local Ollama container (`llama3` or similar local model) combined with offline heuristic signature rules.

---

## 2. Clerk B2B Authentication & Onboarding Guidelines

The administrative cockpit is protected using **Clerk B2B Organization Management**.

* **Authentication Channels:**
  * **Google Accounts:** Both personal Gmail and enterprise **Google Workspace** accounts are supported.
  * **Microsoft Accounts:** Personal Outlook/Live and corporate **Microsoft Entra ID (Azure AD)** accounts are supported.
* **Onboarding Gate:**
  * When a new operator signs in, the Edge middleware checks if they belong to a Clerk Organization.
  * If they do not, they are directed to the **Organization Management** screen where they must either **Create a New Organization** (e.g. Acme Corp) or **Accept an invitation** to join their company team.
  * Once the organization is provisioned, Clerk triggers a secure webhook event to `/api/webhooks/clerk`, writing the tenant record and syncing the employee roster into the DynamoDB database.

---

## 3. Device Registration Strategy (Best for Prototype Phase)

To facilitate rapid testing and grading without complex mobile application installs, we utilize a dual-track device registration strategy:

### Track 1: Client Workstations (Laptops/Servers)
* **Strategy:** Native Client Daemon.
* **Process:** Run the lightweight CLI script on the computer you want to register:
  ```bash
  TENANT_ID=org_your_org_id npm run agent MY-LAPTOP
  ```
* **Handshake:** The daemon fetches the unique **motherboard BIOS hardware UUID** and sends its first ping signed with the global registration key (`demo_agent_key_99`). The gateway auto-enrolls the asset, locks it to the hardware UUID, generates a **rotated device-specific agent key**, and returns it in the `202 Accepted` response.

### Track 2: Mobile Devices (iPads/Phones)
* **Strategy:** Manual Inventory Enrollment.
* **Process:** Administrative operators can register mobile devices directly via the **Register Device** UI modal on the `/dashboard/assets` page. Select `MOBILE` as the asset type and enter the device details.
* **Why this is best right now:** It allows auditors to build a complete inventory list of mobile endpoints, assign them to employees, and test the administrative quarantine loops without having to sideload compiled iOS or Android packages onto physical smartphones during the prototype review.

---

## 4. AWS Database Management & Access Ownership

* **Shared SaaS Model:** By default, all data is hosted in our centralized AWS DynamoDB database. Logical isolation guarantees that clients can only access their data via Next.js server actions using validated Clerk organization tokens.
* **Access Control:** Client administrators **never** get direct access to raw AWS DynamoDB tables or console credentials. They query, manage, and download compliance audits exclusively through the B2B dashboard.

---

## 5. Future Scaling Roadmap: Multi-Organization Expansion

As we transition from testing to a scale of thousands of active organizations, we will implement the following database and architecture changes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SCALING MILESTONES                               │
├──────────────────────────────────────┬──────────────────────────────────────┤
│               PHASE 1                │               PHASE 2                │
│             (SaaS Scale)             │          (Enterprise Private)        │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Dynamically deploy regional caches │ • Automate private AWS deployments  │
│   for Edge-level quarantine status.   │   using Terraform / CloudControl.    │
│ • Replace manual mobile entries with │ • Implement VPC Peering & Private    │
│   Microsoft Intune / Jamf Webhooks.  │   Link ingestion channels.           │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

1. **Automated MDM Webhooks (Mobile Scaling):**
   Replace manual mobile inventory registrations with direct **Microsoft Intune / Jamf Pro API webhooks**. When an employee enrolls a phone, the MDM automatically pings our ingestion gateway to register the mobile device.
2. **Dynamic Edge Quarantining Cache:**
   Instead of querying DynamoDB on every telemetry request, Edge quarantine status will be synced dynamically to a global **Vercel KV / Redis** cache. This keeps edge-blocking latency under 10ms regardless of fleet size.
3. **Dedicated AWS Account Deployments (Private Cloud):**
   To support strict compliance rules (SOC 2 Type II, HIPAA), we will offer a **dedicated private cloud deployment**. We will automate the setup of separate Next.js containers and DynamoDB tables inside the **customer's own AWS account** using Terraform templates, keeping all telemetry strictly in their private perimeter.
4. **Directory Sync (SCIM):**
   Integrate SCIM (System for Cross-domain Identity Management) to automatically sync employee profiles from Azure AD, Okta, or Google Workspaces in real time without waiting for users to sign in.
