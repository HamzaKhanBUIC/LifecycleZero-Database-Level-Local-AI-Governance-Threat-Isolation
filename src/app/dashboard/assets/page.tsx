import { getTenantContext } from "@/lib/auth";
import { getTenantDashboardData } from "@/lib/dao";
import AssetFleetView from "./AssetFleetView";

export default async function AssetsPage() {
  const { tenantId } = await getTenantContext();
  const data = await getTenantDashboardData(tenantId);

  const { assets, employees } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-black min-h-screen">
      {/* Page Header */}
      <div className="border-b border-[#262626] pb-4">
        <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
          <span className="text-[#00FF41]">&gt;</span> IT_HARDWARE_FLEET
        </h1>
        <p className="text-zinc-500 font-mono text-[10px] mt-1.5 uppercase tracking-wider">
          Monitor physical endpoints, verify Jamf enrollment, and execute lifecycle commands.
        </p>
      </div>

      <AssetFleetView initialAssets={assets} employees={employees} />
    </div>
  );
}
