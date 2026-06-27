import { getTenantContext } from "@/lib/auth";
import { getTenantDashboardData } from "@/lib/dao";
import Link from "next/link";
import { seedActiveTenantAction } from "@/lib/api";
import { redirect } from "next/navigation";
import { 
  Database, 
  ShoppingCart, 
  Laptop, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Play 
} from "lucide-react";

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();
  const data = await getTenantDashboardData(tenantId);

  const { tenant, assets, pendingRequests } = data;

  const totalAssets = assets.length;
  const activeFleet = assets.filter(a => a.Status === "ACTIVE").length;
  const actionRequired = assets.filter(a => ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(a.Status)).length;
  const pendingProcures = pendingRequests.length;

  async function triggerSeed() {
    'use server';
    await seedActiveTenantAction();
    redirect('/dashboard');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono text-zinc-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-900">
        <div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">
            OVERVIEW DASHBOARD
          </h1>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">
            Real-time telemetry and management controls for <span className="text-green-500 font-bold">{tenant?.TenantName || "Sandbox Enterprise"}</span>
          </p>
        </div>
        
        {totalAssets === 0 && (
          <form action={triggerSeed}>
            <button
              type="submit"
              className="px-4 py-2 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold text-xs uppercase tracking-widest transition flex items-center gap-2"
            >
              <Play className="h-3 w-3" />
              SEED SANDBOX DEMO DATA
            </button>
          </form>
        )}
      </div>

      {totalAssets === 0 ? (
        <div className="p-12 border border-dashed border-zinc-800 text-center bg-zinc-950/20 max-w-xl mx-auto">
          <Database className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Assets Found</h3>
          <p className="text-xs text-zinc-500 mt-2 mb-6 leading-relaxed uppercase tracking-wide">
            Your tenant workspace is currently empty. Seed the database with mock employees, devices, procurement requests, and audit logs to continue.
          </p>
          <form action={triggerSeed}>
            <button
              type="submit"
              className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 font-bold text-xs uppercase tracking-widest transition"
            >
              Seed Sandbox Data
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 border border-zinc-900 bg-zinc-950/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">TOTAL FLEET SIZE</p>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-black text-white tracking-tight">{totalAssets}</span>
                <span className="text-zinc-600 text-[10px] uppercase font-bold">devices</span>
              </div>
            </div>
            
            <div className="p-5 border border-zinc-900 bg-zinc-950/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">ACTIVE DEVICES</p>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-black text-green-500 tracking-tight">{activeFleet}</span>
                <span className="text-zinc-600 text-[10px] uppercase font-bold">deployed</span>
              </div>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">PENDING APPROVALS</p>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-black text-amber-500 tracking-tight">{pendingProcures}</span>
                <span className="text-zinc-600 text-[10px] uppercase font-bold">requests</span>
              </div>
            </div>

            <div className="p-5 border border-zinc-900 bg-zinc-950/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">ACTIONS REQUIRED</p>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-black text-rose-500 tracking-tight">{actionRequired}</span>
                <span className="text-zinc-600 text-[10px] uppercase font-bold">in workflow</span>
              </div>
            </div>
          </div>

          {/* Quick Views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Procurement Requests */}
            <div className="p-6 border border-zinc-900 bg-zinc-950/30 flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900 mb-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-widest flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-amber-500" /> PENDING APPROVALS
                </h3>
                <Link href="/dashboard/procurement" className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider transition">
                  View Queue &rarr;
                </Link>
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-xs text-zinc-600 my-auto py-8 text-center uppercase tracking-wider">No pending approvals.</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.slice(0, 5).map(req => (
                    <div key={req.RequestId} className="flex justify-between items-center p-3 bg-[#0a0a0a] border border-zinc-900/60 rounded">
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wide">{req.AssetName}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">Requested by {req.RequesterName} ({req.Department})</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hardware Inventory Status */}
            <div className="p-6 border border-zinc-900 bg-zinc-950/30 flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900 mb-4">
                <h3 className="font-bold text-white text-sm uppercase tracking-widest flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-indigo-400" /> ACTION REQUIRED
                </h3>
                <Link href="/dashboard/assets" className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider transition">
                  Manage Fleet &rarr;
                </Link>
              </div>

              {assets.filter(a => ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(a.Status)).length === 0 ? (
                <p className="text-xs text-zinc-600 my-auto py-8 text-center uppercase tracking-wider">All systems operational. No active workflows.</p>
              ) : (
                <div className="space-y-4">
                  {assets.filter(a => ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(a.Status)).slice(0, 5).map(asset => (
                    <div key={asset.AssetId} className="flex justify-between items-center p-3 bg-[#0a0a0a] border border-zinc-900/60 rounded">
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wide">{asset.AssetName}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">Assigned to {asset.EmployeeName} | {asset.SerialNo}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-widest ${
                        asset.Status === "OFFBOARDING" 
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      }`}>
                        {asset.Status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
