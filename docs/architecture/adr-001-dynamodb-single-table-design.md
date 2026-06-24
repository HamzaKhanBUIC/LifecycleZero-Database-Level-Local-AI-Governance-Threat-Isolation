# ADR-001: DynamoDB Single-Table Design for Multi-Tenant Fleet Telemetry

## Status
Accepted

## Context
We are building a multi-tenant enterprise security platform ("LifecycleZero") that tracks asset telemetry and dynamically detects anomalies across a massive fleet. The system needs to support extremely high-throughput ingest (telemetry from thousands of agents per tenant) while maintaining strict tenant isolation and sub-millisecond query performance for dashboard metrics.
Our constraints for the MVP (hackathon) are speed of delivery, zero-ops infrastructure, and impressing AWS product managers with a scalable architecture.

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|-----------|
| PostgreSQL (RDS) | Strong consistency, JOINs, familiar SQL syntax | Harder to scale horizontally for high-throughput time-series ingest; requires managing connections. | Medium | Complex relational data modeling |
| DynamoDB (Multi-Table) | Easy to conceptualize (one table per entity) | Cross-entity queries are impossible without multiple round trips; higher cost. | Low | Simple microservices |
| **DynamoDB (Single-Table)** | Extreme scale, single request to fetch an asset and its audit log, cost-efficient, forces access-pattern driven design. | Steep learning curve, hard to ad-hoc query, inflexible if access patterns change. | High | High scale, well-defined access patterns |

## Decision
**Chosen**: DynamoDB (Single-Table Design)

We implemented a single-table design with the following key patterns:
- **Tenant Isolation**: `PK = TENANT#<TenantId>`, enforcing physical isolation at the partition key level.
- **Sparse Indexing (GSI2)**: We only write `GSI2PK` and `GSI2SK` when an alert is `CRITICAL` or `WARNING`. This allows us to fetch all critical incidents across a tenant's fleet instantly without scanning benign telemetry.
- **Time-To-Live (TTL)**: Telemetry records are tagged with an expiration epoch (90 days). DynamoDB automatically purges them, preventing storage bloat.

## Rationale
1. We needed to prove enterprise-grade scalability to AWS judges. A well-architected Single-Table design with TTL and Sparse Indexing demonstrates deep operational maturity.
2. The dashboard requires real-time polling. Fetching cross-asset alerts using a Sparse Index (`GSI2`) is exponentially faster and cheaper than scanning a massive time-series table.

## Trade-offs
- We are giving up ad-hoc querying flexibility. If the business suddenly needs to query "all assets with exactly 16GB of RAM across all tenants," it requires a full table scan.
- This is acceptable because our dashboard access patterns are well-defined and strictly scoped by Tenant.

## Consequences
- **Positive**: Blazing fast reads for the dashboard, extremely low storage costs for the index, zero maintenance for data purging.
- **Negative**: High initial cognitive load for developers onboarding to the data access layer (`dao.ts`).
- **Mitigation**: We explicitly documented every access pattern in `architecture_diagram.md` to serve as a reference for developers.
