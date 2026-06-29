# ADR-003: Production Scale Architecture — DynamoDB Global Tables & IAM Fine-Grained Access Control

## Status
Accepted

## Context
As a high-velocity B2B SaaS platform governing endpoint threat intelligence, LifecycleZero processes high-frequency telemetry heartbeats. To transition the current single-region prototype to production scale, the architecture must address two primary scalability and security vectors:
1.  **Global Edge Latency:** Minimizing round-trip times for endpoint agents located globally (e.g., outsourced developer nodes streaming telemetry from EU/APAC regions).
2.  **AWS-Level Multi-Tenant Isolation:** Enforcing tenant isolation boundaries directly at the AWS IAM layer rather than relying solely on user-space Next.js application logic.

---

## 1. Multi-Region Replication (Terraform Blueprint)

To deliver sub-10ms response times globally, we configure DynamoDB Global Tables (version 2019.11.21) with replicas in `us-east-1`, `eu-west-1`, and `ap-southeast-1`. This guarantees local write speed and automated cross-region conflict resolution using Last-Writer-Wins (LWW).

Below is the production-ready Terraform blueprint for `LifecycleZero_Assets`:

```hcl
resource "aws_dynamodb_table" "lifecycle_zero" {
  name             = "LifecycleZero_Assets"
  billing_mode     = "PAY_PER_REQUEST" # On-demand billing scales to zero when idle
  hash_key         = "PK"
  range_key        = "SK"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES" # Required for Global Table replication

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Local secondary and global overload indexes
  global_secondary_index {
    name            = "GSI1-OverloadIndex"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # Sparse Index for Alerts
  global_secondary_index {
    name            = "GSI2-SparseWorkflow"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  # Multi-region replication replicas configuration
  replica {
    region_name = "us-east-1"
  }

  replica {
    region_name = "eu-west-1"
  }

  replica {
    region_name = "ap-southeast-1"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = "production"
    Product     = "LifecycleZero"
  }
}
```

---

## 2. Fine-Grained Access Control (IAM Policy)

To satisfy strict regulatory audits (SOC 2, ISO 27001) and prevent cross-tenant security breaches, the Next.js API gateway nodes do not use unrestricted credentials. Instead, they authenticate using temporary IAM session keys scoped strictly to the tenant's partition space.

We implement **Fine-Grained Access Control (FGAC)** using the `dynamodb:LeadingKeys` condition key. This ensures a process can only write or read items where the Partition Key (`PK`) prefix matches the tenant's unique identifier.

Below is the IAM Policy template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBTenantIsolation",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/LifecycleZero_Assets",
      "Condition": {
        "ForAnyValue:StringLike": {
          "dynamodb:LeadingKeys": [
            "TENANT#${aws:PrincipalTag/TenantId}*"
          ]
        }
      }
    }
  ]
}
```

### Rationale
*   `${aws:PrincipalTag/TenantId}`: When the client authenticates via Clerk / OpenID Connect, the identity provider tags the federated AWS IAM session with the tenant ID tag.
*   DynamoDB intercepts the API requests and automatically rejects any transaction where the partition key prefix diverges from the tag, enforcing absolute isolation at the AWS kernel level.
