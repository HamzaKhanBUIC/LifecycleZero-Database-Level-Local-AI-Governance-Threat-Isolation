'use client';

import { useState, useTransition } from "react";
import { ProcurementRequest } from "@/lib/types";
import { createRequestAction, resolveRequestAction } from "@/lib/api";

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Pending Requests List */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2 mb-4">
          📥 Manager Approval Queue
        </h3>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium">
            ⚠️ {errorMsg}
          </div>
        )}

        {pendingRequests.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 bg-zinc-950/20">
            No procurement requests require review.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(req => (
              <div 
                key={req.RequestId} 
                className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-xl backdrop-blur flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">{req.AssetName}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                      {req.Type}
                    </span>
                  </div>
                  
                  <p className="text-xs text-zinc-400 mt-1">
                    Requested by <span className="text-indigo-400 font-semibold">{req.RequesterName}</span> for <span className="text-purple-400 font-semibold">{req.Department}</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Created: {new Date(req.CreatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    disabled={isPending}
                    onClick={() => handleResolve(req.RequestId, "APPROVED")}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/10"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleResolve(req.RequestId, "REJECTED")}
                    className="flex-1 sm:flex-none px-4 py-2 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 disabled:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Request Form */}
      <div className="lg:col-span-1 p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur space-y-4 h-fit">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">
          🛒 Request New Hardware
        </h3>

        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Equipment Name</label>
            <input
              type="text"
              required
              placeholder="e.g. MacBook Pro 14 inch"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-600"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Equipment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProcurementRequest['Type'])}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-300"
            >
              <option value="LAPTOP">Laptop</option>
              <option value="MOBILE">Mobile / Tablet</option>
              <option value="MONITOR">Monitor</option>
              <option value="PERIPHERAL">Peripheral</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-300"
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
            className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold rounded-lg transition shadow text-xs uppercase tracking-wider"
          >
            {isPending ? "Submitting..." : "Submit Procurement Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
