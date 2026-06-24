'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/auth';
import { docClient } from '@/lib/dynamodb';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Tenant, Employee, HardwareAsset, ProcurementRequest, AuditLog } from '@/lib/types';

const TABLE_NAME = process.env.DYNAMODB_TABLE || "IT_Asset_Management";

export async function seedActiveTenantAction() {
  try {
    const { tenantId } = await getTenantContext();
    const timestamp = new Date().toISOString();

    console.log(`🌱 Seeding active tenant: ${tenantId}`);

    // 1. Create/Update Tenant metadata (just in case)
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: "METADATA",
        TenantName: "Sandbox Enterprise",
        TenantSlug: "sandbox-ent",
        CreatedAt: timestamp,
        Status: "ACTIVE",
        Plan: "FREE_TIER"
      } as Tenant
    }));

    // 2. Seed Employees
    const employees: Employee[] = [
      {
        PK: `TENANT#${tenantId}`,
        SK: "EMP#emp_john",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        Email: "john@sandbox.com",
        Department: "Engineering",
        Role: "Principal Architect",
        GSI1PK: "DEPT#Engineering",
        GSI1SK: "EMP#emp_john"
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "EMP#emp_sarah",
        EmployeeId: "emp_sarah",
        EmployeeName: "Sarah Connor",
        Email: "sarah@sandbox.com",
        Department: "Operations",
        Role: "Security Operations Manager",
        GSI1PK: "DEPT#Operations",
        GSI1SK: "EMP#emp_sarah"
      }
    ];

    for (const emp of employees) {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: emp }));
    }

    // 3. Seed Assets
    const assets: HardwareAsset[] = [
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-M3MAX-777",
        AssetId: "AST-M3MAX-777",
        AssetName: "MacBook Pro 16\" M3 Max",
        SerialNo: "SN-M3MAX777",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        GSI1PK: "EMP#emp_john",
        GSI1SK: "STATE#ACTIVE",
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-THINK-888",
        AssetId: "AST-THINK-888",
        AssetName: "Lenovo ThinkPad X1 Carbon",
        SerialNo: "SN-THINK888",
        Type: "LAPTOP",
        Status: "ACTIVE",
        EmployeeId: "emp_sarah",
        EmployeeName: "Sarah Connor",
        GSI1PK: "EMP#emp_sarah",
        GSI1SK: "STATE#ACTIVE",
        UpdatedAt: timestamp
      },
      {
        PK: `TENANT#${tenantId}`,
        SK: "ASSET#AST-WIPE-999",
        AssetId: "AST-WIPE-999",
        AssetName: "iPad Pro 12.9\"",
        SerialNo: "SN-IPAD999",
        Type: "MOBILE",
        Status: "OFFBOARDING",
        EmployeeId: "emp_john",
        EmployeeName: "John Doe",
        GSI1PK: "EMP#emp_john",
        GSI1SK: "STATE#OFFBOARDING",
        GSI2PK: `TENANT#${tenantId}#ACTION_REQ`,
        GSI2SK: `DATE#${timestamp}`,
        UpdatedAt: timestamp
      }
    ];

    for (const asset of assets) {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: asset }));
    }

    // 4. Seed Procurement Requests
    const request: ProcurementRequest = {
      PK: `TENANT#${tenantId}`,
      SK: "PROCURE#REQ-SANDBOX-101",
      RequestId: "REQ-SANDBOX-101",
      RequesterId: "emp_sarah",
      RequesterName: "Sarah Connor",
      AssetName: "Dell UltraSharp 38\" Curved Monitor",
      Type: "MONITOR",
      Department: "Operations",
      Status: "PENDING",
      CreatedAt: timestamp,
      GSI1PK: "DEPT#Operations",
      GSI1SK: `DATE#${timestamp}`,
      GSI2PK: `TENANT#${tenantId}#PENDING_PROCURE`,
      GSI2SK: `DEPT#Operations#DATE#${timestamp}`
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: request }));

    // 5. Seed Audit Logs
    const audit: AuditLog = {
      PK: `TENANT#${tenantId}`,
      SK: `AUDIT#AST-M3MAX-777#${timestamp}`,
      AssetId: "AST-M3MAX-777",
      ActorId: "SYSTEM",
      ActorName: "System Provisioner",
      Action: "ASSET_ASSIGNED",
      Timestamp: timestamp,
      Details: "Hardware assigned to John Doe upon tenant onboarding."
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: audit }));

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/assets');
    revalidatePath('/dashboard/procurement');

    return { success: true };
  } catch (error: any) {
    console.error("❌ seedActiveTenantAction Error:", error);
    return { success: false, error: error.message };
  }
}
