import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { 
  getPendingProcurementRequests, 
  submitProcurementRequest, 
  resolveProcurementRequest, 
  getActiveAssetsForEmployee, 
  getAuditTrailForAsset, 
  getTenantDashboardData,
  createEmployee
} from "../src/lib/dao";

const testTenantId = "org_test_999";

async function runTests() {
  console.log("🧪 Starting Backend Integration Verification for LifecycleZero...");
  console.log(`Tenant under test: ${testTenantId}\n`);

  try {
    // 0. Seed an employee first
    console.log("1. Seeding mock test employee...");
    await createEmployee(testTenantId, {
      EmployeeId: "emp_test_user",
      EmployeeName: "Testy McTest",
      Email: "testy@sandbox.com",
      Department: "Engineering",
      Role: "QA Architect"
    });
    console.log("✅ Employee created.");

    // 1. Submit Procurement Request
    console.log("\n2. Testing submitProcurementRequest (Access Pattern 2 - Precursor)...");
    const req = await submitProcurementRequest(testTenantId, {
      RequestId: "REQ-TEST-001",
      RequesterId: "emp_test_user",
      RequesterName: "Testy McTest",
      AssetName: "Ultra-wide Test Monitor",
      Type: "MONITOR",
      Department: "Engineering"
    });
    console.log("✅ Request submitted: ", req.RequestId);

    // Verify it is pending
    const pendingReqs = await getPendingProcurementRequests(testTenantId, "Engineering");
    const found = pendingReqs.some(r => r.RequestId === "REQ-TEST-001");
    if (!found) throw new Error("Pattern 2 Fail: Submitted request not found in pending queue.");
    console.log("✅ Pattern 2 (Fetch Pending for Department) passed!");

    // 2. Resolve Procurement Request (Approve)
    console.log("\n3. Testing resolveProcurementRequest (Pattern 5 - Precursor)...");
    const resolution = await resolveProcurementRequest(
      testTenantId, 
      "REQ-TEST-001", 
      "APPROVED", 
      "admin_user", 
      "System Admin"
    );
    console.log(`✅ Request resolved. New Asset ID created: ${resolution.assetId}`);

    // Verify it is no longer pending
    const postPendingReqs = await getPendingProcurementRequests(testTenantId);
    const stillFound = postPendingReqs.some(r => r.RequestId === "REQ-TEST-001");
    if (stillFound) throw new Error("Fail: Resolved request is still in pending queue!");
    console.log("✅ Sparse index eviction passed (Removed from GSI2).");

    // 3. Verify Asset Assignment and Status
    console.log("\n4. Testing getActiveAssetsForEmployee (Access Pattern 1)...");
    const activeAssets = await getActiveAssetsForEmployee(testTenantId, "emp_test_user");
    const hasNewAsset = activeAssets.some(a => a.AssetId === resolution.assetId && a.Status === "PROCURING");
    // Note: When approved, it starts in 'PROCURING' state. To make it 'ACTIVE', we update it.
    console.log(`✅ Assets currently assigned: ${activeAssets.length}`);

    // Let's transition the status to 'ACTIVE'
    console.log("\n5. Testing updateAssetStatusTransaction (Access Pattern 5)...");
    const { updateAssetStatusTransaction } = await import("../src/lib/dao");
    await updateAssetStatusTransaction({
      tenantId: testTenantId,
      assetId: resolution.assetId!,
      newStatus: "ACTIVE",
      assignedEmployeeId: "emp_test_user",
      assignedEmployeeName: "Testy McTest",
      actorId: "admin_user",
      actorName: "System Admin",
      action: "DEPLOY_TO_EMPLOYEE",
      details: "Hardware delivered and marked active by admin."
    });
    console.log("✅ Transaction completed successfully.");

    // Verify it is now ACTIVE in Pattern 1 GSI1
    const activeAssetsAfterUpdate = await getActiveAssetsForEmployee(testTenantId, "emp_test_user");
    const isNowActive = activeAssetsAfterUpdate.some(a => a.AssetId === resolution.assetId && a.Status === "ACTIVE");
    if (!isNowActive) throw new Error("Pattern 1 Fail: Asset status is not ACTIVE in GSI1!");
    console.log("✅ Pattern 1 (Get Active Assets for Employee) passed!");

    // 4. Verify Audit Trail
    console.log("\n6. Testing getAuditTrailForAsset (Access Pattern 3)...");
    const auditLogs = await getAuditTrailForAsset(testTenantId, resolution.assetId!);
    console.log(`✅ Audit Logs retrieved: ${auditLogs.length}`);
    if (auditLogs.length < 2) throw new Error("Pattern 3 Fail: Expected at least 2 audit entries.");
    console.log("Logs timeline:");
    auditLogs.forEach(l => console.log(`  - [${l.Action}] ${l.Details} (Auth: ${l.ActorName})`));
    console.log("✅ Pattern 3 (Chronological Audit Trail) passed!");

    // 5. Verify Dashboard Telemetry
    console.log("\n7. Testing getTenantDashboardData (Access Pattern 4)...");
    const dashboard = await getTenantDashboardData(testTenantId);
    console.log(`✅ Dashboard stats: ${dashboard.assets.length} assets, ${dashboard.employees.length} employees, ${dashboard.pendingRequests.length} pending.`);
    if (dashboard.assets.length !== 1) throw new Error("Pattern 4 Fail: Unexpected asset count in dashboard.");
    console.log("✅ Pattern 4 (Dashboard Aggregation) passed!");

    console.log("\n🎉 ALL 5 ACCESS PATTERNS VERIFIED SUCCESSFULLY!");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Integration Test Failed:", error.message);
    process.exit(1);
  }
}

runTests();
