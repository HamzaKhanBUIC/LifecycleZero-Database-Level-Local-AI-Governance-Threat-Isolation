import dotenv from "dotenv";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

dotenv.config({ path: ".env.local" });

const isLocal = process.env.DB_LOCAL === "true";
const tableName = process.env.DYNAMODB_TABLE || "LifecycleZero_Assets";
const demoTenantId = "org_3FlCIAyLsUAbJaMCxXpsgPxeGQa";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: isLocal ? "http://localhost:8000" : undefined,
  credentials: isLocal ? { accessKeyId: "local", secretAccessKey: "local" } : undefined
});

const docClient = DynamoDBDocumentClient.from(client);

async function seed() {
  console.log(`🌱 Seeding DynamoDB table "${tableName}" for tenant "${demoTenantId}"...`);

  const timestamp = new Date().toISOString();

  const items = [
    // 1. Tenant Metadata
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "METADATA",
      TenantName: "Acme Corp Remote",
      TenantSlug: "acme-corp",
      CreatedAt: timestamp,
      Status: "ACTIVE",
      Plan: "FREE_TIER",
      MaxAllowedEndpoints: 150
    },

    // 2. Employees
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "EMP#emp_alice",
      EmployeeId: "emp_alice",
      EmployeeName: "Alice Chen",
      Email: "alice@acme.com",
      Department: "Engineering",
      Role: "Senior Frontend Engineer",
      GSI1PK: "DEPT#Engineering",
      GSI1SK: "EMP#emp_alice"
    },
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "EMP#emp_bob",
      EmployeeId: "emp_bob",
      EmployeeName: "Bob Smith",
      Email: "bob@acme.com",
      Department: "Product",
      Role: "Product Manager",
      GSI1PK: "DEPT#Product",
      GSI1SK: "EMP#emp_bob"
    },

    // 3. Hardware Assets
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "ASSET#AST-M3PRO-001",
      AssetId: "AST-M3PRO-001",
      AssetName: "MacBook Pro 16\" M3 Max",
      SerialNo: "SN-C02F12345678",
      Type: "LAPTOP",
      Status: "ACTIVE",
      EmployeeId: "emp_alice",
      EmployeeName: "Alice Chen",
      GSI1PK: "EMP#emp_alice",
      GSI1SK: "STATE#ACTIVE",
      LastHeartbeat: timestamp,
      UpdatedAt: timestamp
    },
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "ASSET#AST-DELL-002",
      AssetId: "AST-DELL-002",
      AssetName: "Dell UltraSharp 32\" 4K Monitor",
      SerialNo: "SN-DELL9876543",
      Type: "MONITOR",
      Status: "ACTIVE",
      EmployeeId: "emp_alice",
      EmployeeName: "Alice Chen",
      GSI1PK: "EMP#emp_alice",
      GSI1SK: "STATE#ACTIVE",
      UpdatedAt: timestamp
    },
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "ASSET#AST-M3AIR-003",
      AssetId: "AST-M3AIR-003",
      AssetName: "MacBook Air 13\" M3",
      SerialNo: "SN-C02G87654321",
      Type: "LAPTOP",
      Status: "IN_TRANSIT",
      EmployeeId: "emp_bob",
      EmployeeName: "Bob Smith",
      GSI1PK: "EMP#emp_bob",
      GSI1SK: "STATE#IN_TRANSIT",
      GSI2PK: `TENANT#${demoTenantId}#ACTION_REQ`,
      GSI2SK: `DATE#${timestamp}`,
      UpdatedAt: timestamp
    },

    // 4. Procurement Requests
    {
      PK: `TENANT#${demoTenantId}`,
      SK: "PROCURE#REQ-998877",
      RequestId: "REQ-998877",
      RequesterId: "emp_bob",
      RequesterName: "Bob Smith",
      AssetName: "Apple Studio Display 27\"",
      Type: "MONITOR",
      Department: "Product",
      Status: "PENDING",
      CreatedAt: timestamp,
      GSI1PK: "DEPT#Product",
      GSI1SK: `DATE#${timestamp}`,
      GSI2PK: `TENANT#${demoTenantId}#PENDING_PROCURE`,
      GSI2SK: `DEPT#Product#DATE#${timestamp}`
    },

    // 5. Audit Logs
    {
      PK: `TENANT#${demoTenantId}`,
      SK: `AUDIT#AST-M3PRO-001#${timestamp}`,
      AssetId: "AST-M3PRO-001",
      ActorId: "SYSTEM",
      ActorName: "System Provisioner",
      Action: "ASSET_ASSIGNED",
      Timestamp: timestamp,
      Details: "Hardware assigned to Alice Chen upon onboarding."
    }
  ];

  // Generate an additional 121 assets to reach 124 total
  const generatedItems: any[] = [];
  for(let i = 4; i <= 124; i++) {
    const assetId = `AST-MAC-${i.toString().padStart(3, '0')}`;
    const empId = `emp_gen_${i}`;
    
    generatedItems.push({
      PK: `TENANT#${demoTenantId}`,
      SK: `EMP#${empId}`,
      EmployeeId: empId,
      EmployeeName: `Test Employee ${i}`,
      Email: `employee${i}@acme.com`,
      Department: "Engineering",
      Role: "Software Engineer",
      GSI1PK: "DEPT#Engineering",
      GSI1SK: `EMP#${empId}`
    });

    const lastHeartbeat = i === 4 
      ? new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago (Unreachable)
      : i === 5 
        ? timestamp // Active
        : undefined;

    generatedItems.push({
      PK: `TENANT#${demoTenantId}`,
      SK: `ASSET#${assetId}`,
      AssetId: assetId,
      AssetName: "MacBook Pro 14\" M3",
      SerialNo: `SN-GEN${i.toString().padStart(5, '0')}`,
      Type: "LAPTOP",
      Status: "ACTIVE",
      EmployeeId: empId,
      EmployeeName: `Test Employee ${i}`,
      GSI1PK: `EMP#${empId}`,
      GSI1SK: "STATE#ACTIVE",
      LastHeartbeat: lastHeartbeat,
      UpdatedAt: timestamp
    });
  }

  const allItems = [...items, ...generatedItems];

  // Batch insert into DynamoDB
  for (let i = 0; i < allItems.length; i += 25) {
    const batch = allItems.slice(i, i + 25);
    try {
      await Promise.all(batch.map(item => 
        docClient.send(new PutCommand({
          TableName: tableName,
          Item: item
        }))
      ));
      console.log(`✅ Seeded batch ${i/25 + 1} (${batch.length} items)`);
    } catch (err) {
      console.error(`❌ Failed to seed batch:`, err);
    }
  }

  console.log("🌱 Database seeding completed successfully!");
}

seed();
