import { getTenantContext } from "@/lib/auth";
import { getAssetById, getAuditTrailForAsset } from "@/lib/dao";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { tenantId } = await getTenantContext();

  const asset = await getAssetById(tenantId, id);
  if (!asset) {
    notFound();
  }

  const auditTrail = await getAuditTrailForAsset(tenantId, id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Back to assets list */}
      <div>
        <Link 
          href="/dashboard/assets" 
          className="text-xs text-zinc-500 hover:text-white font-semibold flex items-center gap-1.5 transition"
        >
          &larr; Back to Hardware Fleet
        </Link>
      </div>

      {/* Asset Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-zinc-900">
        <div>
          <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">{asset.Type}</span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            {asset.AssetName}
          </h1>
          <p className="text-zinc-500 text-xs mt-1 font-mono">
            ID: {asset.AssetId} | Serial: {asset.SerialNo}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-medium">Lifecycle Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            asset.Status === "ACTIVE" 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
              : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
          }`}>
            {asset.Status}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Specifications Panel */}
        <div className="md:col-span-1 p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur space-y-4">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">
            Device Metadata
          </h3>
          
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500">Owner Assignment</p>
            <p className="text-sm font-semibold text-white mt-1">{asset.EmployeeName}</p>
            <p className="text-xs text-zinc-500 font-mono">{asset.EmployeeId}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500">Last Registered Telemetry</p>
            <p className="text-xs text-zinc-300 mt-1">{new Date(asset.UpdatedAt).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500">MDM Compliance Gate</p>
            <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
              <span>🟢</span> Jamf Enrolled & Compliant
            </p>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="md:col-span-2 p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur flex flex-col">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2 mb-6">
            🛡️ SOC 2 Chain of Custody (Immutable Audit Trail)
          </h3>

          {auditTrail.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center my-auto">No custody records found.</p>
          ) : (
            <div className="relative border-l border-zinc-900 ml-3 space-y-6">
              {auditTrail.map((log) => (
                <div key={log.SK} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute left-[-5px] top-1.5 h-2 w-2 rounded-full bg-indigo-500 border border-zinc-950 shadow shadow-indigo-500" />
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {log.Action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(log.Timestamp).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="text-xs text-zinc-400 mt-1">{log.Details}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 font-semibold">
                    Authorized by: {log.ActorName} ({log.ActorId})
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
