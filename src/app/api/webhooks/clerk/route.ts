import { NextResponse, type NextRequest } from 'next/server';
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { docClient } from '@/lib/dynamodb';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  // Fail closed: without the signing secret we cannot tell Clerk (Svix) events from forgeries.
  // CLERK_WEBHOOK_SIGNING_SECRET is accepted as an alias (the name used in Clerk's docs).
  const signingSecret = env("CLERK_WEBHOOK_SECRET") || env("CLERK_WEBHOOK_SIGNING_SECRET");
  if (!signingSecret) {
    console.error("❌ CLERK_WEBHOOK_SECRET is not configured. Rejecting Clerk webhook.");
    return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 500 });
  }

  // Verifies the svix-id / svix-timestamp / svix-signature headers against the raw body.
  let payload: any;
  try {
    payload = await verifyWebhook(req, { signingSecret });
  } catch (err: any) {
    console.warn("⚠️ Clerk webhook signature verification failed:", err?.message);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const eventType = payload.type;
    const tableName = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";

    console.log(`📥 Received Clerk Webhook: ${eventType}`);

    if (eventType === "organization.created" || eventType === "organization.updated") {
      const { id, name, slug } = payload.data;

      const command = new PutCommand({
        TableName: tableName,
        Item: {
          PK: `TENANT#${id}`,
          SK: `METADATA`,
          TenantName: name,
          TenantSlug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          CreatedAt: new Date().toISOString(),
          Status: "ACTIVE",
          Plan: "FREE_TIER"
        }
      });

      await docClient.send(command);
      console.log(`✅ Synced Tenant metadata for org ${id} (${name})`);
    } else if (eventType === "organizationMembership.created" || eventType === "organizationMembership.updated") {
      const { organization, public_user_data, role } = payload.data;
      const tenantId = organization.id;
      const empId = public_user_data.user_id;
      const firstName = public_user_data.first_name || "";
      const lastName = public_user_data.last_name || "";
      const empName = `${firstName} ${lastName}`.trim() || "Unknown Employee";
      const email = public_user_data.identifier || "";
      const dept = public_user_data.public_metadata?.department || "Engineering";

      const command = new PutCommand({
        TableName: tableName,
        Item: {
          PK: `TENANT#${tenantId}`,
          SK: `EMP#${empId}`,
          EmployeeId: empId,
          EmployeeName: empName,
          Email: email,
          Department: dept,
          Role: role || "member",
          GSI1PK: `DEPT#${dept}`,
          GSI1SK: `EMP#${empId}`,
          UpdatedAt: new Date().toISOString()
        }
      });

      await docClient.send(command);
      console.log(`✅ Synced Employee profile for ${empName} (${empId}) in tenant ${tenantId}`);
    } else if (eventType === "organizationMembership.deleted") {
      const { organization, public_user_data } = payload.data;
      const tenantId = organization.id;
      const empId = public_user_data.user_id;

      const command = new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `EMP#${empId}`
        }
      });

      await docClient.send(command);
      console.log(`❌ Removed Employee profile for ${empId} in tenant ${tenantId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Clerk Webhook Sync Error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
