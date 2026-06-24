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
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-zinc-900/40 border border-zinc-900 rounded-xl">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-zinc-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROCURING">Procuring</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OFFBOARDING">Offboarding</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Assigned Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-zinc-300"
            >
              <option value="ALL">All Employees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {employees.map(emp => (
                <option key={emp.EmployeeId} value={emp.EmployeeId}>{emp.EmployeeName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-zinc-500 font-medium">
          Showing <span className="text-white font-semibold">{filteredAssets.length}</span> of {assets.length} assets
        </div>
      </div>

      {/* Assets Table */}
      <div className="border border-zinc-900 rounded-xl bg-zinc-950/40 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-zinc-500 text-xs uppercase font-bold">
                <th className="p-4">Asset Details</th>
                <th className="p-4">Serial Number</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4">Status</th>
                <th className="p-4">Quick Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-sm text-zinc-300">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">No assets found matching filters.</td>
                </tr>
              ) : (
                filteredAssets.map(asset => (
                  <tr key={asset.AssetId} className="hover:bg-zinc-900/20 transition">
                    <td className="p-4">
                      <Link href={`/dashboard/assets/${asset.AssetId}`} className="hover:underline">
                        <p className="font-semibold text-white">{asset.AssetName}</p>
                        <p className="text-xs text-zinc-500">{asset.Type}</p>
                      </Link>
                    </td>
                    <td className="p-4 font-mono text-xs text-zinc-400">{asset.SerialNo}</td>
                    <td className="p-4">
                      <p className="text-white">{asset.EmployeeName}</p>
                      <p className="text-xs text-zinc-500">{asset.EmployeeId === "UNASSIGNED" ? "Open Stock" : asset.EmployeeId}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        asset.Status === "ACTIVE" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : asset.Status === "OFFBOARDING"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      }`}>
                        {asset.Status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {asset.Status === "IN_TRANSIT" && (
                          <button
                            onClick={() => handleStatusChange(asset.AssetId, "ACTIVE", asset.EmployeeId, asset.EmployeeName)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {asset.Status === "ACTIVE" && (
                          <button
                            onClick={() => handleStatusChange(asset.AssetId, "OFFBOARDING", asset.EmployeeId, asset.EmployeeName)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition"
                          >
                            Retrieve Asset
                          </button>
                        )}
                        {asset.Status === "OFFBOARDING" && (
                          <button
                            onClick={() => handleStatusChange(asset.AssetId, "RETIRED", "UNASSIGNED", "Unassigned")}
                            className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-semibold transition"
                          >
                            Retire / Wipe
                          </button>
                        )}
                        <Link
                          href={`/dashboard/assets/${asset.AssetId}`}
                          className="px-2.5 py-1 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 rounded text-xs font-semibold transition"
                        >
                          History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
