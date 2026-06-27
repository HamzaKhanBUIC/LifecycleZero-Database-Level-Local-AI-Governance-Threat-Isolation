"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProcurementRequest } from "@/lib/types";
import { resolveRequestAction } from "@/lib/api";
import { Inbox, AlertCircle, ShoppingCart, Check, X } from "lucide-react";

interface ProcurementQueueViewProps {
  pendingRequests: ProcurementRequest[];
}

export default function ProcurementQueueView({ pendingRequests }: ProcurementQueueViewProps) {
  const router = useRouter();
  const [isResolvePending, startResolveTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  // Optimistic local state — remove resolved items instantly without a hard refresh
  const [localRequests, setLocalRequests] = useState<ProcurementRequest[]>(pendingRequests);

  async function handleResolve(requestId: string, decision: "APPROVED" | "REJECTED") {
    setErrorMsg("");
    setLocalRequests((prev) => prev.filter((r) => r.RequestId !== requestId));
    startResolveTransition(async () => {
      const res = await resolveRequestAction(requestId, decision);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to resolve request.");
        setLocalRequests(pendingRequests);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">

      {/* ── Left: Manager Approval Queue ── */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2 mb-4">
          <Inbox className="h-4 w-4 text-indigo-400" /> MANAGER APPROVAL QUEUE
        </h3>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>ERROR: {errorMsg.toUpperCase()}</span>
          </div>
        )}

        {localRequests.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-800 text-center text-zinc-500 bg-zinc-950/20 text-xs">
            [NO_PENDING_PROCUREMENT_REQUESTS_IN_QUEUE]
          </div>
        ) : (
          <div className="space-y-4">
            {localRequests.map((req) => (
              <div
                key={req.RequestId}
                className="p-5 bg-zinc-950/30 border border-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wide">
                      {req.AssetName}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase tracking-widest">
                      {req.Type}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1.5 uppercase tracking-wide">
                    Requested by{" "}
                    <span className="text-indigo-400 font-bold">{req.RequesterName}</span>{" "}
                    for{" "}
                    <span className="text-purple-400 font-bold">{req.Department}</span>
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-1">
                    TIMESTAMP: {new Date(req.CreatedAt).toLocaleString().toUpperCase()}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    disabled={isResolvePending}
                    onClick={() => handleResolve(req.RequestId, "APPROVED")}
                    className="flex-grow sm:flex-grow-0 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    disabled={isResolvePending}
                    onClick={() => handleResolve(req.RequestId, "REJECTED")}
                    className="flex-grow sm:flex-grow-0 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Admin Info Panel (replaces employee request form) ── */}
      <div className="lg:col-span-1 p-6 border border-zinc-900 bg-zinc-950/30 space-y-5 h-fit">
        <h3 className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
          <ShoppingCart className="h-4 w-4 text-zinc-500" /> HOW REQUESTS ARRIVE
        </h3>

        <div className="space-y-5 text-[10px] text-zinc-400 leading-relaxed">

          {/* Step 1 */}
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 w-5 h-5 rounded-sm bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-[9px] flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <p className="text-zinc-300 font-bold uppercase tracking-wider text-[9px] mb-1">
                Employee Submits
              </p>
              <p>
                An employee submits a hardware request via the{" "}
                <span className="text-indigo-400">MDM self-service portal</span> or{" "}
                <span className="text-indigo-400">IT helpdesk ticket</span>. Requests are
                routed here automatically.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 w-5 h-5 rounded-sm bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-[9px] flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <p className="text-zinc-300 font-bold uppercase tracking-wider text-[9px] mb-1">
                Admin Reviews Here
              </p>
              <p>
                You <span className="text-yellow-400">approve or reject</span> each request
                in the queue. Approved items are immediately provisioned as active assets in
                your Hardware Fleet.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 w-5 h-5 rounded-sm bg-green-500/10 border border-green-500/30 text-green-400 font-bold text-[9px] flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <p className="text-zinc-300 font-bold uppercase tracking-wider text-[9px] mb-1">
                Asset Auto-Provisioned
              </p>
              <p>
                On approval, the asset appears in{" "}
                <span className="text-green-400">Hardware Fleet</span> with status{" "}
                <span className="text-green-400 font-bold">PROCURING</span>, and a SOC 2
                audit log entry is written automatically.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-900 text-[9px] text-zinc-600 uppercase tracking-wider">
            Admin role: Approve · Reject · Audit
          </div>
        </div>
      </div>

    </div>
  );
}
