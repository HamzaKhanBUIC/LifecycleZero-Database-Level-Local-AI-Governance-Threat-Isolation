import { getTenantContext } from "@/lib/auth";
import { getTenantDashboardData } from "@/lib/dao";
import AssetFleetView from "./AssetFleetView";

export default async function AssetsPage() {
  const { tenantId } = await getTenantContext();
  const data = await getTenantDashboardData(tenantId);

  const { assets, employees } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          IT Hardware Fleet
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Monitor your organization's physical devices, track lifecycles, and perform administrative overrides.
        </p>
      </div>

      <AssetFleetView initialAssets={assets} employees={employees} />
    </div>
  );
}
