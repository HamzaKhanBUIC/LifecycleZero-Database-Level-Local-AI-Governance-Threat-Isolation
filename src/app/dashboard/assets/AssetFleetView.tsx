'use client';

import { useState } from "react";
import Link from "next/link";
import { HardwareAsset, Employee } from "@/lib/types";
import { updateAssetStatusAction } from "@/app/actions/assets";

interface AssetFleetViewProps {
  initialAssets: HardwareAsset[];
  employees: Employee[];
}

export default function AssetFleetView({ initialAssets, employees }: AssetFleetViewProps) {
  const [assets, setAssets] = useState<HardwareAsset[]>(initialAssets);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");

  // Filtering logic
  const filteredAssets = assets.filter(asset => {
    const matchesStatus = statusFilter === "ALL" || asset.Status === statusFilter;
    const matchesEmployee = employeeFilter === "ALL" || asset.EmployeeId === employeeFilter;
    return matchesStatus && matchesEmployee;
  });

  // Action to change status
  async function handleStatusChange(assetId: string, newStatus: HardwareAsset['Status'], empId: string, empName: string) {
    const actionDesc = `STATUS_UPDATED_${newStatus}`;
    const detailsDesc = `Asset status moved to ${newStatus} by IT Administrator.`;
    
    // Optimistic UI update
    setAssets(prev => prev.map(a => a.AssetId === assetId ? { ...a, Status: newStatus, EmployeeId: empId, EmployeeName: empName } : a));

    const result = await updateAssetStatusAction({
      assetId,
      newStatus,
      assignedEmployeeId: empId,
      assignedEmployeeName: empName,
      action: actionDesc,
      details: detailsDesc
    });

    if (!result.success) {
      alert(`Error updating asset: ${result.error}`);
      // Revert if error
      setAssets(initialAssets);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-[#0a0a0a] border border-[#262626] rounded-sm">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold font-mono text-zinc-500 mb-1 tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#050505] border border-[#262626] text-xs font-mono rounded-sm px-3 py-1.5 focus:outline-none focus:border-zinc-500 text-zinc-300 cursor-pointer"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PROCURING">PROCURING</option>
              <option value="IN_TRANSIT">IN TRANSIT</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="OFFBOARDING">OFFBOARDING</option>
              <option value="RETIRED">RETIRED</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold font-mono text-zinc-500 mb-1 tracking-wider">Assigned Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-[#050505] border border-[#262626] text-xs font-mono rounded-sm px-3 py-1.5 focus:outline-none focus:border-zinc-500 text-zinc-300 cursor-pointer"
            >
              <option value="ALL">ALL EMPLOYEES</option>
              <option value="UNASSIGNED">UNASSIGNED</option>
              {employees.map(emp => (
                <option key={emp.EmployeeId} value={emp.EmployeeId}>{emp.EmployeeName.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-zinc-500">
          SHOWING <span className="text-white font-semibold">{filteredAssets.length}</span> OF {assets.length} ASSETS
        </div>
      </div>

      {/* Assets Table */}
      <div className="border border-[#262626] rounded-sm bg-[#050505] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#262626] text-zinc-500 text-xs uppercase font-bold bg-[#0a0a0a]">
                <th className="p-4 font-mono text-[10px] tracking-wider">Asset Details</th>
                <th className="p-4 font-mono text-[10px] tracking-wider">Serial Number</th>
                <th className="p-4 font-mono text-[10px] tracking-wider">Assigned To</th>
                <th className="p-4 font-mono text-[10px] tracking-wider">Status</th>
                <th className="p-4 font-mono text-[10px] tracking-wider text-right">Quick Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-sm text-zinc-300">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-600 font-mono text-xs">[NO_ASSETS_FOUND_MATCHING_FILTERS]</td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const statusStyles = {
                    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.03)]",
                    OFFBOARDING: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.03)]",
                    PROCURING: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.03)]",
                    IN_TRANSIT: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.03)]",
                    MAINTENANCE: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.03)]",
                    RETIRED: "bg-zinc-800/40 text-zinc-500 border-zinc-800 shadow-[0_0_10px_rgba(113,113,122,0.03)]",
                    ISOLATED: "bg-rose-950/40 text-rose-400 border border-rose-900/40 shadow-[0_0_10px_rgba(220,38,38,0.03)]"
                  }[asset.Status] || "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

                  return (
                    <tr key={asset.AssetId} className="hover:bg-[#131313]/40 transition duration-150">
                      <td className="p-4 font-mono text-xs">
                        <Link href={`/dashboard/assets/${asset.AssetId}`} className="hover:underline">
                          <p className="font-bold text-white uppercase">{asset.AssetName}</p>
                          <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{asset.Type}</p>
                        </Link>
                      </td>
                      <td className="p-4 font-mono text-xs text-zinc-400">{asset.SerialNo}</td>
                      <td className="p-4 font-mono text-xs">
                        <p className="text-white uppercase">{asset.EmployeeName}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{asset.EmployeeId === "UNASSIGNED" ? "OPEN STOCK" : asset.EmployeeId}</p>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${statusStyles}`}>
                          {asset.Status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          {asset.Status === "IN_TRANSIT" && (
                            <button
                              onClick={() => handleStatusChange(asset.AssetId, "ACTIVE", asset.EmployeeId, asset.EmployeeName)}
                              className="px-2.5 py-1 bg-[#0f172a] hover:bg-slate-900 text-blue-400 border border-blue-900/60 rounded-sm text-xs font-mono font-bold uppercase transition"
                            >
                              Deliver
                            </button>
                          )}
                          {asset.Status === "ACTIVE" && (
                            <button
                              onClick={() => handleStatusChange(asset.AssetId, "OFFBOARDING", asset.EmployeeId, asset.EmployeeName)}
                              className="px-2.5 py-1 bg-[#1c0d0d] hover:bg-rose-950/60 text-rose-400 border border-rose-900/60 rounded-sm text-xs font-mono font-bold uppercase transition"
                            >
                              Retrieve
                            </button>
                          )}
                          {asset.Status === "OFFBOARDING" && (
                            <button
                              onClick={() => handleStatusChange(asset.AssetId, "RETIRED", "UNASSIGNED", "Unassigned")}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 rounded-sm text-xs font-mono font-bold uppercase transition"
                            >
                              Retire / Wipe
                            </button>
                          )}
                          <Link
                            href={`/dashboard/assets/${asset.AssetId}`}
                            className="px-2.5 py-1 border border-[#262626] bg-[#0a0a0a] hover:bg-[#131313] text-zinc-300 rounded-sm text-xs font-mono font-bold uppercase transition"
                          >
                            History
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
