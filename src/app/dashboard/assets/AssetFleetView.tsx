'use client';

import { useState, useTransition } from "react";
import Link from "next/link";
import { HardwareAsset, Employee } from "@/lib/types";
import { updateAssetStatusAction, registerAssetAction } from "@/lib/api";
import Sparkline from "@/components/Sparkline";
import { Plus, X, Server } from "lucide-react";

interface AssetFleetViewProps {
  initialAssets: HardwareAsset[];
  employees: Employee[];
}

export default function AssetFleetView({ initialAssets, employees }: AssetFleetViewProps) {
  const [assets, setAssets] = useState<HardwareAsset[]>(initialAssets);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState<HardwareAsset['Type']>("LAPTOP");
  const [newSerialNo, setNewSerialNo] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("UNASSIGNED");
  const [isPending, startTransition] = useTransition();

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
    
    // Snapshot for rollback
    const previousAssets = assets;
    
    // Optimistic UI update
    setAssets(prev => prev.map(a => a.AssetId === assetId ? { ...a, Status: newStatus, EmployeeId: empId, EmployeeName: empName } : a));
    setActionError(null);

    const result = await updateAssetStatusAction({
      assetId,
      newStatus,
      assignedEmployeeId: empId,
      assignedEmployeeName: empName,
      action: actionDesc,
      details: detailsDesc
    });

    if (!result.success) {
      setActionError(`Failed to update asset: ${result.error || "Unknown error"}`);
      // Rollback to last known good state
      setAssets(previousAssets);
    }
  }

  // Handle register form submit
  async function handleRegisterDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!newAssetId.trim() || !newAssetName.trim()) return;

    const matchedEmp = employees.find(emp => emp.EmployeeId === newEmployeeId);
    const empName = matchedEmp ? matchedEmp.EmployeeName : "Unassigned";

    setActionError(null);
    startTransition(async () => {
      const res = await registerAssetAction({
        assetId: newAssetId.trim().toUpperCase(),
        assetName: newAssetName.trim(),
        type: newAssetType,
        serialNo: newSerialNo.trim(),
        status: "ACTIVE",
        employeeId: newEmployeeId,
        employeeName: empName
      });

      if (res.success) {
        // Local state append
        const newAsset: HardwareAsset = {
          PK: `TENANT#NEW`,
          SK: `ASSET#${newAssetId.trim().toUpperCase()}`,
          AssetId: newAssetId.trim().toUpperCase(),
          AssetName: newAssetName.trim(),
          SerialNo: newSerialNo.trim() || `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          Type: newAssetType,
          Status: "ACTIVE",
          EmployeeId: newEmployeeId,
          EmployeeName: empName,
          GSI1PK: `EMP#${newEmployeeId}`,
          GSI1SK: `STATE#ACTIVE`,
          UpdatedAt: new Date().toISOString()
        };
        setAssets(prev => [newAsset, ...prev]);
        setShowRegisterModal(false);
        
        // Reset inputs
        setNewAssetId("");
        setNewAssetName("");
        setNewSerialNo("");
        setNewEmployeeId("UNASSIGNED");
      } else {
        setActionError(res.error || "Failed to register asset.");
      }
    });
  }

  return (
    <div className="space-y-6 font-mono">
      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-sm flex items-center justify-between gap-2">
          <span>ERROR: {actionError.toUpperCase()}</span>
          <button onClick={() => setActionError(null)} className="text-zinc-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-[#0a0a0a] border border-[#262626] rounded-sm">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex flex-col">
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#050505] border border-[#262626] text-xs rounded-sm px-3 py-1.5 focus:outline-none focus:border-zinc-500 text-zinc-300 cursor-pointer"
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
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Assigned Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-[#050505] border border-[#262626] text-xs rounded-sm px-3 py-1.5 focus:outline-none focus:border-zinc-500 text-zinc-300 cursor-pointer"
            >
              <option value="ALL">ALL EMPLOYEES</option>
              <option value="UNASSIGNED">UNASSIGNED</option>
              {employees.map(emp => (
                <option key={emp.EmployeeId} value={emp.EmployeeId}>{emp.EmployeeName.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info & Action Button */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-xs text-zinc-500">
            SHOWING <span className="text-white font-semibold">{filteredAssets.length}</span> OF {assets.length} ASSETS
          </div>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-3.5 py-1.5 bg-[#00FF41]/10 hover:bg-[#00FF41]/25 text-[#00FF41] border border-[#00FF41]/30 hover:border-[#00FF41]/50 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer rounded-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Device
          </button>
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
                <th className="p-4 font-mono text-[10px] tracking-wider">Live Telemetry</th>
                <th className="p-4 font-mono text-[10px] tracking-wider text-right">Quick Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-sm text-zinc-300">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-600 font-mono text-xs">[NO_ASSETS_FOUND_MATCHING_FILTERS]</td>
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
                      <td className="p-4 font-mono text-xs">
                        <Sparkline assetId={asset.AssetId} status={asset.Status} />
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

      {/* ── Register Device Modal Overlay ── */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 rounded-sm overflow-hidden font-mono shadow-[0_0_50px_rgba(0,255,65,0.04)]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-[#0c0c0e] flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00FF41]" />
                Register New Device
              </h3>
              <button 
                onClick={() => setShowRegisterModal(false)}
                className="text-zinc-500 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleRegisterDevice} className="p-6 space-y-4">
              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Asset ID * (Unique Name)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AST-PHONE-HAMZA"
                  value={newAssetId}
                  onChange={(e) => setNewAssetId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-white placeholder-zinc-700 uppercase"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Device Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hamza's Phone"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-white placeholder-zinc-700"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Device Type</label>
                <select
                  value={newAssetType}
                  onChange={(e) => setNewAssetType(e.target.value as HardwareAsset['Type'])}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-zinc-300 cursor-pointer"
                >
                  <option value="LAPTOP">Laptop</option>
                  <option value="MOBILE">Mobile / Phone</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="PERIPHERAL">Peripheral</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Serial Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for auto-generated SN"
                  value={newSerialNo}
                  onChange={(e) => setNewSerialNo(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-white placeholder-zinc-700"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">Assign to Employee</label>
                <select
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs focus:outline-none focus:border-zinc-700 text-zinc-300 cursor-pointer font-mono"
                >
                  <option value="UNASSIGNED">UNASSIGNED (OPEN STOCK)</option>
                  {employees.map(emp => (
                    <option key={emp.EmployeeId} value={emp.EmployeeId}>{emp.EmployeeName.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="w-1/2 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold border border-zinc-800 hover:border-zinc-700 rounded-sm text-xs uppercase tracking-widest transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newAssetId.trim() || !newAssetName.trim()}
                  className="w-1/2 py-2 bg-[#00FF41] hover:bg-[#00E53A] text-black font-bold disabled:bg-zinc-900 disabled:text-zinc-600 rounded-sm text-xs uppercase tracking-widest transition flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {isPending ? "Registering..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
