import { getTenantContext } from "@/lib/auth";
import { getTenantDashboardData } from "@/lib/dao";
import Link from "next/link";
import { seedActiveTenantAction } from "../actions/seed";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();
  const data = await getTenantDashboardData(tenantId);

  const { tenant, employees, assets, pendingRequests } = data;

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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-zinc-900">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Overview Dashboard
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time telemetry and management controls for <span className="text-indigo-400 font-semibold">{tenant?.TenantName || "Sandbox Enterprise"}</span>.
          </p>
        </div>
        
        {totalAssets === 0 && (
          <form action={triggerSeed}>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-lg transition shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2"
            >
              🌱 Seed Sandbox Demo Data
            </button>
          </form>
        )}
      </div>

      {totalAssets === 0 ? (
        <div className="p-12 border border-dashed border-zinc-800 rounded-2xl text-center bg-zinc-950/20 backdrop-blur max-w-xl mx-auto">
          <div className="h-12 w-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl mx-auto mb-4">
            🔋
          </div>
          <h3 className="text-lg font-bold text-white">No Assets Found</h3>
          <p className="text-sm text-zinc-400 mt-2 mb-6 leading-relaxed">
            Your tenant workspace is currently empty. Click the button below to seed the database with mock employees, devices, procurement requests, and audit logs.
          </p>
          <form action={triggerSeed}>
            <button
              type="submit"
              className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-lg transition shadow text-sm"
            >
              Seed Sandbox Data
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Fleet Size</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-white tracking-tight">{totalAssets}</span>
                <span className="text-zinc-500 text-xs">devices</span>
              </div>
            </div>
            
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Devices</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-emerald-400 tracking-tight">{activeFleet}</span>
                <span className="text-zinc-500 text-xs">deployed</span>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pending Approvals</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-amber-400 tracking-tight">{pendingProcures}</span>
                <span className="text-zinc-500 text-xs">requests</span>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Actions Required</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-indigo-400 tracking-tight">{actionRequired}</span>
                <span className="text-zinc-500 text-xs">in workflow</span>
              </div>
            </div>
          </div>

          {/* Quick Views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Procurement Requests */}
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900 mb-4">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  🛒 Pending Approvals
                </h3>
                <Link href="/dashboard/procurement" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                  View Queue &rarr;
                </Link>
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-sm text-zinc-500 my-auto py-8 text-center">No pending approvals.</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.slice(0, 5).map(req => (
                    <div key={req.RequestId} className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                      <div>
                        <p className="text-sm font-semibold text-white">{req.AssetName}</p>
                        <p className="text-xs text-zinc-500">Requested by {req.RequesterName} ({req.Department})</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hardware Inventory Status */}
            <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur flex flex-col">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900 mb-4">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  💻 Action Required
                </h3>
                <Link href="/dashboard/assets" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                  Manage Fleet &rarr;
                </Link>
              </div>

              {assets.filter(a => ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(a.Status)).length === 0 ? (
                <p className="text-sm text-zinc-500 my-auto py-8 text-center">All systems operational. No active workflows.</p>
              ) : (
                <div className="space-y-4">
                  {assets.filter(a => ["PROCURING", "IN_TRANSIT", "OFFBOARDING"].includes(a.Status)).slice(0, 5).map(asset => (
                    <div key={asset.AssetId} className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                      <div>
                        <p className="text-sm font-semibold text-white">{asset.AssetName}</p>
                        <p className="text-xs text-zinc-500">Assigned to {asset.EmployeeName} | {asset.SerialNo}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
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
