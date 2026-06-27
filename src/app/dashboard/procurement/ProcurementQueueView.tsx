"use client";

import { useState, useTransition } from "react";
import { ProcurementRequest } from "@/lib/types";
import { createRequestAction, resolveRequestAction } from "@/lib/api";
import { Inbox, AlertCircle, ShoppingCart, Plus, Check, X } from "lucide-react";

interface ProcurementQueueViewProps {
  pendingRequests: ProcurementRequest[];
}

export default function ProcurementQueueView({ pendingRequests }: ProcurementQueueViewProps) {
  const [isPending, startTransition] = useTransition();
  const [assetName, setAssetName] = useState("");
  const [type, setType] = useState<ProcurementRequest['Type']>("LAPTOP");
  const [department, setDepartment] = useState("Engineering");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!assetName) return;

    setErrorMsg("");
    startTransition(async () => {
      const res = await createRequestAction({ assetName, type, department });
      if (res.success) {
        setAssetName("");
      } else {
        setErrorMsg(res.error || "Failed to create request.");
      }
    });
  }

  async function handleResolve(requestId: string, decision: 'APPROVED' | 'REJECTED') {
    setErrorMsg("");
    startTransition(async () => {
      const res = await resolveRequestAction(requestId, decision);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to resolve request.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
      {/* Pending Requests List */}
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

        {pendingRequests.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-800 text-center text-zinc-500 bg-zinc-950/20">
            [NO_PENDING_PROCUREMENT_REQUESTS_IN_QUEUE]
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(req => (
              <div 
                key={req.RequestId} 
                className="p-5 bg-zinc-950/30 border border-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm uppercase tracking-wide">{req.AssetName}</h4>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase tracking-widest">
                      {req.Type}
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-zinc-400 mt-1.5 uppercase tracking-wide">
                    Requested by <span className="text-indigo-400 font-bold">{req.RequesterName}</span> for <span className="text-purple-400 font-bold">{req.Department}</span>
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-1">
                    TIMESTAMP: {new Date(req.CreatedAt).toLocaleString().toUpperCase()}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    disabled={isPending}
                    onClick={() => handleResolve(req.RequestId, "APPROVED")}
                    className="flex-grow sm:flex-grow-0 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3 w-3" />
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleResolve(req.RequestId, "REJECTED")}
                    className="flex-grow sm:flex-grow-0 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Request Form */}
      <div className="lg:col-span-1 p-6 border border-zinc-900 bg-zinc-950/30 space-y-4 h-fit">
        <h3 className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-2">
          <ShoppingCart className="h-4 w-4 text-green-400" /> REQUEST HARDWARE
        </h3>

        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Equipment Name</label>
            <input
              type="text"
              required
              placeholder="e.g. MACBOOK PRO 14 INCH"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-white placeholder-zinc-700 font-mono"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Equipment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProcurementRequest['Type'])}
              className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-zinc-300 font-mono cursor-pointer"
            >
              <option value="LAPTOP">Laptop</option>
              <option value="MOBILE">Mobile / Tablet</option>
              <option value="MONITOR">Monitor</option>
              <option value="PERIPHERAL">Peripheral</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-zinc-300 font-mono cursor-pointer"
            >
              <option value="Engineering">Engineering</option>
              <option value="Product">Product Management</option>
              <option value="Operations">Operations</option>
              <option value="Sales">Sales & Marketing</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending || !assetName}
            className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-600 font-bold rounded text-xs uppercase tracking-widest transition flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {isPending ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
