import { NextResponse } from 'next/server';
import { docClient } from '@/lib/dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { env } from '@/lib/env';

const TABLE_NAME = env("DYNAMODB_TABLE", "LifecycleZero_Assets");

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const eventType = payload.type;
    const dataObject = payload.data.object;

    console.log(`[STRIPE WEBHOOK] Received event: ${eventType}`);

    // If Stripe webhook metadata contains the tenant ID, use it, otherwise fall back to sandbox tenant
    const tenantId = dataObject.metadata?.tenantId || "org_demo_123";

    if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
      const status = dataObject.status;
      const stripeSubId = dataObject.id;
      const stripeCustomerId = dataObject.customer;
      
      // Determine limits based on metadata plan value or default to Enterprise
      const planName = dataObject.metadata?.planType === "growth" ? "FREE_TIER" : "ENTERPRISE"; 
      const maxAllowed = dataObject.metadata?.planType === "growth" ? 25 : 150;
      
      const isSuspended = ["canceled", "incomplete_expired", "unpaid"].includes(status);
      const tenantStatus = isSuspended ? "SUSPENDED" : "ACTIVE";

      console.log(`[STRIPE WEBHOOK] Updating tenant ${tenantId} state. Status: ${tenantStatus}, Plan: ${planName}, Limit: ${maxAllowed}`);

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: "METADATA" },
        UpdateExpression: "SET #status = :status, Plan = :plan, MaxAllowedEndpoints = :max, StripeCustomerId = :cust, StripeSubscriptionId = :sub",
        ExpressionAttributeNames: {
          "#status": "Status"
        },
        ExpressionAttributeValues: {
          ":status": tenantStatus,
          ":plan": planName,
          ":max": maxAllowed,
          ":cust": stripeCustomerId,
          ":sub": stripeSubId
        }
      }));

    } else if (eventType === "customer.subscription.deleted") {
      console.log(`[STRIPE WEBHOOK] Suspending tenant ${tenantId} due to subscription deletion.`);

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `TENANT#${tenantId}`, SK: "METADATA" },
        UpdateExpression: "SET #status = :status, MaxAllowedEndpoints = :max",
        ExpressionAttributeNames: {
          "#status": "Status"
        },
        ExpressionAttributeValues: {
          ":status": "SUSPENDED",
          ":max": 0
        }
      }));
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
