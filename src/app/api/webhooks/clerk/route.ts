import { NextResponse } from 'next/server';
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from '@/lib/dynamodb';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const eventType = payload.type;
    const tableName = process.env.DYNAMODB_TABLE || "IT_Asset_Management";

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
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Clerk Webhook Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
