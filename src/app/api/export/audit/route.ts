import { NextResponse } from 'next/server';
import { getAssets, getCrossAssetAlerts } from '@/app/actions/telemetry';

export async function GET() {
  const TENANT_ID = "org_demo_123";

  try {
    const [assets, alerts] = await Promise.all([
      getAssets(TENANT_ID),
      getCrossAssetAlerts(TENANT_ID)
    ]);

    // For a SOC 2 audit, an auditor wants to see:
    // 1. Assets currently in an ISOLATED state.
    // 2. The incident alerts that triggered the isolation.
    
    const isolatedAssets = assets.filter((a: any) => a.Status === 'ISOLATED');
    const criticalIncidents = alerts.filter((a: any) => a.RiskLevel === 'CRITICAL');

    const auditPayload = {
      Timestamp: new Date().toISOString(),
      TenantId: TENANT_ID,
      ReportType: "SOC2_INCIDENT_ISOLATION_AUDIT",
      Summary: {
        TotalMonitoredAssets: assets.length,
        CurrentlyIsolatedAssets: isolatedAssets.length,
        RecentCriticalIncidents: criticalIncidents.length
      },
      IsolatedAssets: isolatedAssets.map((a: any) => ({
        AssetId: a.AssetId,
        EmployeeId: a.EmployeeId,
        EmployeeName: a.EmployeeName,
        IsolationTime: a.UpdatedAt,
        DeviceModel: a.Model
      })),
      IncidentLog: criticalIncidents.map((a: any) => ({
        AssetId: a.AssetId,
        Timestamp: a.Timestamp,
        Process: a.ProcessName,
        AiAnalysis: a.AiAnalysis || a.Reasoning,
        ActionTaken: isolatedAssets.some((iso: any) => iso.AssetId === a.AssetId) ? "ISOLATED" : "PENDING_REVIEW"
      }))
    };

    const jsonString = JSON.stringify(auditPayload, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="soc2_audit_export.json"'
      }
    });

  } catch (error) {
    console.error("Export failed", error);
    return NextResponse.json({ error: "Failed to generate SOC 2 Export" }, { status: 500 });
  }
}
