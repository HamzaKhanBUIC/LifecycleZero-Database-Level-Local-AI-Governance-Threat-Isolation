import { getTenantContext } from "@/lib/auth";
import { getPendingProcurementRequests } from "@/lib/dao";
import ProcurementQueueView from "./ProcurementQueueView";

export default async function ProcurementPage() {
  const { tenantId } = await getTenantContext();
  const pendingRequests = await getPendingProcurementRequests(tenantId);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-mono text-zinc-300">
      {/* Page Header */}
      <div className="border-b border-zinc-900 pb-4">
        <h1 className="text-2xl font-black text-white tracking-widest uppercase">
          PROCUREMENT PIPELINE
        </h1>
        <p className="text-zinc-500 text-[10px] mt-1.5 uppercase tracking-wider">
          Review, approve, or reject employee equipment requests. Approved items automatically spawn active provisioning logs.
        </p>
      </div>

      <ProcurementQueueView pendingRequests={pendingRequests} />
    </div>
  );
}
