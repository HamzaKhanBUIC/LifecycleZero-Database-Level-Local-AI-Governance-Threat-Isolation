import { NextResponse } from 'next/server';
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from '@/lib/dynamodb';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
