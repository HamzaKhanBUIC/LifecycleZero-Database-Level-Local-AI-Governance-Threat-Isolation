# LifecycleZero: Database-Level Local AI Governance and Threat Isolation

## Inspiration
As open-source Large Language Models (such as Ollama, Llama.cpp, and LM Studio) proliferate on corporate endpoints, security teams face a critical blind spot: Shadow AI. Employees are running powerful models locally to bypass corporate firewalls and upload limits. Traditional Endpoint Detection and Response (EDR) agents and network monitoring tools cannot detect when a local model reads sensitive files (such as payroll.xlsx or source code) offline. CrowdStrike Falcon cannot inspect the semantic file context of a local Ollama process because it operates at the kernel syscall layer, not the application context layer.

LifecycleZero was built to bridge this gap, framing local AI safety as a high-throughput telemetry ingestion, database-level state, and automated gateway isolation problem.

## What It Does
LifecycleZero provides an end-to-end local AI governance platform:
1. **Endpoint Telemetry Monitoring:** A lightweight system daemon monitors the execution of local AI model runtimes, tracking RAM/CPU utilization, process names, network egress, and specific files accessed.
2. **High-Throughput Ingestion:** Telemetry is streamed to a secure Next.js API Gateway, immediately queued on AWS SQS (or a resilient fallback queue), returning a 202 Accepted response in under 20ms.
3. **Autonomous Risk Analysis:** An asynchronous queue worker pulls messages and routes them through a multi-tier AI evaluation pipeline (AWS Bedrock Claude 3 Haiku primary, falling back to Google Gemini or Groq) to evaluate risk.
4. **Database-Level Isolation:** If an agentic threat is identified, an administrator can execute a single-click transaction in the SOC dashboard. This uses a DynamoDB TransactWriteCommand to atomically isolate the asset and write an immutable audit log, immediately blocking further ingestion at the API gateway edge. Audit logs are structured to support SOC 2 Type II, ISO 27001, and NIST CSF reporting requirements.

## System Architecture

![LifecycleZero System Architecture](public/system_architecture_diagram.png)

## How We Built It
* **Frontend:** Next.js (App Router) styled with a clinical, high-contrast brutalist design system.
* **Server-Pre-Rendering:** To handle high-density layouts, the fleet heatmap pre-renders 124 asset nodes on the server, bypassing layout shifts and providing a sub-200ms initial client paint.
* **Database:** Amazon DynamoDB using a Single-Table Design. We enforce multi-tenant isolation at the Partition Key level (`PK = TENANT#<TenantId>`), query alerts in milliseconds using a sparse Global Secondary Index (GSI2), and utilize TTL to automatically purge operational records after 90 days.
* **Queueing & Async Workers:** AWS SQS handles telemetry decoupling. A dedicated TypeScript worker pulls and processes events asynchronously.
* **AI Evaluation Pipeline:** Powered by AWS Bedrock (Claude 3 Haiku) as the enterprise-grade primary model, with automated failover handling to Google Gemini and Groq to ensure continuous runtime security.

## Challenges We Ran Into
* **High-Density Render Latency:** Rendering a heatmap of 120+ active hosts on the client can lag. We resolved this by shifting all asset fetching and state preparation to Next.js Server Components, sending flat, ready-to-paint HTML.
* **API Ingestion Quarantine:** Guaranteeing that isolated hosts are blocked instantly without adding query overhead. We solved this by checking the asset's DynamoDB state directly in the Next.js API route before queuing telemetry.

## Accomplishments That We Are Proud Of
* **Clean Single-Table Design:** Fitting multi-tenant hardware assets, real-time alerts, compliance audit logs, and telemetry streams into a single DynamoDB table.
* **Clinical Visual Aesthetic:** Designing an enterprise SOC command center that eschews generic gradients and emojis, opting instead for monospace status badges that evoke professional systems.

## What We Learned
* How to design idempotent state transitions using DynamoDB transaction keys.
* The nuances of local process tracking and low-overhead file access auditing on host systems.

## Deployment and Commercial Model

### Deployment Model
LifecycleZero is distributed as a lightweight, read-only system daemon. It is pushed silently to macOS, Windows, and Linux endpoints via enterprise Mobile Device Management (MDM) platforms such as Jamf, Microsoft Intune, and Kandji. The daemon runs in the background as a privileged service, requiring no end-user interaction or local installation prompts.

### Onboarding Friction
Onboarding is completely frictionless. Once pushed by the MDM, the local daemon performs a secure handshake with the company's Next.js API Gateway using a pre-configured hardware enrollment token. This automatically registers the asset in the DynamoDB table and establishes the telemetry stream without manual IT intervention.

### Pricing Model
LifecycleZero is sold as a standard B2B SaaS subscription starting at $8 per monitored endpoint per month. We offer an Enterprise tier that includes dedicated AWS Bedrock throughput, customizable risk heuristics, and long-term compliance audit logging.

### Customer Acquisition and Target Market
Our initial target segment is 500-5000 employee technology companies with distributed remote workforces and existing Jamf or Intune MDM deployments.
