# LifecycleZero: B2B Cost, Revenue, & Margin Analysis

This report outlines the infrastructure cost calculations, SaaS pricing models, profit margins, and target customer sizing for LifecycleZero.

---

## 💵 1. Serverless Infrastructure Cost Calculations
LifecycleZero operates on an event-driven, pay-per-use serverless model. If there is no telemetry traffic (e.g., weekends, holidays), the infrastructure costs drop to **nearly $0**. 

Below is the cost breakdown for a mid-market customer with **200 monitored endpoints** sending heartbeats every 5 seconds (generating ~103 million telemetry logs per month):

### 1. Telemetry Ingestion Buffer (AWS SQS)
*   **Pricing**: $0.40 per million requests (first 1 million free).
*   **Monthly Volume**: 103.68 million pings.
*   **Cost**: `(103.68 - 1) * $0.40` = **$41.07 / month**

### 2. Multi-Tenant Database Storage (AWS DynamoDB)
*   **Pricing**: $1.25 per million write units (WRU), $0.25 per million read units (RRU) on-demand.
*   **Coalesced Heartbeats**: To optimize database costs, the ingestion worker aggregates heartbeats, updating the database status once every 60 seconds for active assets rather than every 5 seconds.
*   **Database Writes**: 200 endpoints * 1,440 pings/day * 30 days = 8.64 million writes.
*   **Cost**: `8.64 * $1.25` = **$10.80 / month**

### 3. Risk AI Heuristics Evaluation (Local Ollama Container Hosting)
*   **Hosting**: We run dedicated container instances of Ollama (Llama 3) inside AWS ECS Fargate or local hypervisors.
*   **Data Privacy**: All telemetry and file-access evaluations run 100% locally. Zero tokens are sent to external cloud APIs, eliminating external API charges and ensuring absolute employee data privacy.
*   **Cost**: Fixed hosting runtime cost of **$15.00 / month** per 200 endpoints.

### ⚠️ Total monthly Infrastructure Cost: ~$66.87 / month

---

## 📈 2. Revenue, Pricing, & Profit Margin
LifecycleZero's pricing model is a simple, predictable endpoint subscription:

*   **SaaS List Price**: $8.00 per monitored workstation endpoint per month.
*   **Total Monthly Revenue (200 Endpoints)**: 200 * $8.00 = **$1,600.00 / month**
*   **Monthly Infrastructure Cost**: **$66.87 / month**
*   **Gross Profit Margin**: **95.8%**!

This massive profit margin is the primary business advantage of our SQS-decoupled, sparse-indexed serverless architecture.

---

## 🏢 3. Target Customer Sizing & Admin Ratios

### Target Customer Sizing (The Mid-Market Sweet Spot)
*   **Target Segment**: Companies with **100 to 1,000 employees**.
*   **Why?**
    *   **Under 50 employees**: Companies lack dedicated IT security budgets or MDM control systems (like Jamf or Intune).
    *   **Over 5,000 employees**: Large enterprises require long procurement cycles (12+ months) and are locked into legacy DLP/EDR vendor contracts.
    *   **Mid-Market (100 - 1,000 employees)**: They have distributed remote development teams running local AI models (high Shadow AI risk) and active MDM control, but need a lightweight, self-serve compliance platform that does not require a $50,000/year annual minimum contract.

### IT Security Admin Ratios
*   In the target mid-market range, the typical ratio of IT/Security administrators to employee endpoints is **1:100** to **1:200**.
*   **Admin Capacity**:
    *   A **200-employee company** typically has **1 or 2 IT administrators** managing the LifecycleZero dashboard.
    *   A **1,000-employee company** typically has **5 to 8 admins**.
*   Clerk B2B organization memberships allow the purchasing administrator to easily invite additional IT staff to collaborate on the Threat Console, export audit trails, and approve hardware procurement requests from the same unified cockpit.
