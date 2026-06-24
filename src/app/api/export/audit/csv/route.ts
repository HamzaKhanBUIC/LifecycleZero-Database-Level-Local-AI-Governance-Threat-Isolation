import { NextResponse } from 'next/server';
import { getAssets, getCrossAssetAlerts } from '@/app/actions/telemetry';

export async function GET() {
  const TENANT_ID = "org_demo_123";

  try {
    const [assets, alerts] = await Promise.all([
      getAssets(TENANT_ID),
      getCrossAssetAlerts(TENANT_ID)
    ]);

    const criticalIncidents = alerts.filter((a: any) => a.RiskLevel === 'CRITICAL');

    const csvHeader = "Event_Timestamp,Asset_ID,Device_Model,Device_Type,Current_Status,Assigned_Employee,Trigger_Process,Risk_Severity,AI_Analysis,Action_Taken\n";
    
    const csvRows = criticalIncidents.map((a: any) => {
      const asset = assets.find((assetObj: any) => assetObj.AssetId === a.AssetId);
      const isIsolated = asset?.Status === 'ISOLATED';
      
      const escape = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;
      
      return [
        a.Timestamp,
        a.AssetId,
        escape(asset?.AssetName || "N/A"),
        asset?.Type || "N/A",
        asset?.Status || "ACTIVE",
        escape(asset?.EmployeeName || "Unassigned"),
        escape(a.ProcessName),
        a.RiskLevel,
        escape(a.AiAnalysis || a.Reasoning),
        isIsolated ? "ISOLATED_BY_POLICY" : "PENDING_REVIEW"
      ].join(",");
    });

    const csvContent = csvHeader + csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="soc2_audit_export.csv"'
      }
    });

  } catch (error) {
    console.error("CSV Export failed", error);
    return NextResponse.json({ error: "Failed to generate SOC 2 CSV Export" }, { status: 500 });
  }
}
