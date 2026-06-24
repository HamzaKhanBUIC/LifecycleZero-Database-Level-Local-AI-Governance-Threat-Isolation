# ADR-002: Next.js API Routes for SOC 2 Audit Exports

## Status
Accepted

## Context
Enterprise security products (like CrowdStrike or Wiz) require the ability to export audit logs and compliance reports on demand. For our MVP, we need a "SOC 2 Audit Export" feature that downloads isolated asset history and critical incident logs as a JSON/CSV file.
We needed a way to securely aggregate this data and deliver it to the client without adding significant architectural overhead to our 72-hour hackathon timeline.

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|-----------|
| Background Worker (AWS SQS + Lambda + S3) | Highly scalable for massive exports, non-blocking, robust | Overkill for the MVP, requires complex infrastructure provisioning (S3 buckets, presigned URLs, SQS queues). | High | Exporting millions of rows or generating heavy PDFs |
| Client-Side Generation (Blob URL) | Zero server load, instant, easy to build | Security risk if client fetches too much raw data; cannot securely sign the audit log payload. | Low | Small dataset, purely internal tools |
| **Next.js App Router API Route** | Secure, server-side data fetching, leverages existing DynamoDB connection, easy to stream to client. | Can timeout on Vercel if the export takes >10s (Serverless function limits). | Low/Medium | Standard SaaS exports, MVP timelines |

## Decision
**Chosen**: Next.js App Router API Route

We implemented a simple API route at `src/app/api/export/audit/route.ts`. When the user clicks the SOC 2 Export button, the browser makes a GET request. The server securely fetches `assets` and `cross-asset-alerts` directly from DynamoDB using the IAM credentials, aggregates them into a structured JSON payload, and returns a `Content-Disposition: attachment` response to trigger a file download.

## Rationale
1. **Speed of Execution**: We are operating under a strict 72-hour constraint. Building out an asynchronous S3-based export pipeline would consume hours of dev time.
2. **Security & Legitimacy**: A pure client-side export isn't viewed as a true "system of record" audit log. Generating the payload on the server proves we can handle secure backend data orchestration.

## Trade-offs
- We are giving up the ability to export massive, multi-gigabyte audit logs without hitting Serverless function timeouts.
- This is acceptable because for the context of this hackathon and the MVP demo, the dataset is scoped to 124 assets and 90 days of TTL'd alerts. It will comfortably resolve in milliseconds.

## Consequences
- **Positive**: We immediately gain a high-value enterprise feature that CISOs love, with virtually zero infrastructure footprint.
- **Negative**: If the product scales beyond thousands of concurrent critical alerts, the synchronous API route will fail.
- **Mitigation**: Once we reach scale, we will deprecate this synchronous route and transition to an event-driven architecture (EventBridge &rarr; Step Functions &rarr; S3 Presigned URL).
