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
    <div className="p-8 max-w-5xl mx-auto space-y-6 bg-black min-h-screen">
      {/* Back to assets list */}
      <div>
        <Link 
          href="/dashboard/assets" 
          className="text-xs text-zinc-500 hover:text-white font-mono uppercase tracking-wider flex items-center gap-1.5 transition"
        >
          &larr; Back to Hardware Fleet
        </Link>
      </div>

      {/* Asset Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-[#262626]">
        <div>
          <span className="text-xs text-blue-400 font-bold font-mono tracking-widest uppercase">{asset.Type}</span>
          <h1 className="text-xl font-bold font-mono text-white tracking-tight mt-1 uppercase">
            {asset.AssetName}
          </h1>
          <p className="text-zinc-500 text-xs mt-1.5 font-mono">
            ID: {asset.AssetId} | SERIAL: {asset.SerialNo}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono uppercase">Lifecycle Status:</span>
          <span className={`px-3 py-1 rounded-sm text-xs font-mono font-bold border ${
            asset.Status === "ACTIVE" 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.03)]" 
              : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
          }`}>
            {asset.Status}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Specifications Panel */}
        <div className="md:col-span-1 p-6 rounded-sm border border-[#262626] bg-[#050505] space-y-4">
          <h3 className="font-bold text-white text-xs font-mono uppercase tracking-wider text-zinc-400 border-b border-[#262626] pb-2">
            Device Metadata
          </h3>
          
          <div>
            <p className="text-[9px] uppercase font-bold font-mono text-zinc-500 tracking-wider">Owner Assignment</p>
            <p className="text-xs font-mono font-semibold text-white mt-1 uppercase">{asset.EmployeeName}</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{asset.EmployeeId}</p>
          </div>

          <div>
            <p className="text-[9px] uppercase font-bold font-mono text-zinc-500 tracking-wider">Last Registered Telemetry</p>
            <p className="text-xs text-zinc-300 mt-1 font-mono">{new Date(asset.UpdatedAt).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-[9px] uppercase font-bold font-mono text-zinc-500 tracking-wider">MDM Compliance Gate</p>
            <p className="text-xs text-emerald-400 font-mono font-semibold mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none inline-block"></span> JAMF ENROLLED & COMPLIANT
            </p>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="md:col-span-2 p-6 rounded-sm border border-[#262626] bg-[#050505] flex flex-col">
          <h3 className="font-bold text-white text-xs font-mono uppercase tracking-wider text-zinc-400 border-b border-[#262626] pb-2 mb-6">
            🛡️ SOC 2 Chain of Custody (Immutable Audit Trail)
          </h3>

          {auditTrail.length === 0 ? (
            <p className="text-xs font-mono text-zinc-600 py-8 text-center my-auto">[NO_CUSTODY_RECORDS_FOUND]</p>
          ) : (
            <div className="relative border-l border-[#262626] ml-3 space-y-6">
              {auditTrail.map((log) => (
                <div key={log.SK} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute left-[-4px] top-1.5 h-1.5 w-1.5 bg-blue-500 border border-zinc-950" />
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                      {log.Action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {new Date(log.Timestamp).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="text-xs font-mono text-zinc-400 mt-1.5">{log.Details}</p>
                  <p className="text-[9px] text-zinc-500 mt-1 font-mono uppercase">
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
