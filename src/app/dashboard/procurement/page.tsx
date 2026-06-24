import { getTenantContext } from "@/lib/auth";
import { getPendingProcurementRequests } from "@/lib/dao";
import ProcurementQueueView from "./ProcurementQueueView";

export default async function ProcurementPage() {
  const { tenantId } = await getTenantContext();
  const pendingRequests = await getPendingProcurementRequests(tenantId);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Procurement Pipeline
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Review, approve, or reject employee equipment requests. Approved items automatically spawn active provisioning logs.
        </p>
      </div>

      <ProcurementQueueView pendingRequests={pendingRequests} />
    </div>
  );
}
