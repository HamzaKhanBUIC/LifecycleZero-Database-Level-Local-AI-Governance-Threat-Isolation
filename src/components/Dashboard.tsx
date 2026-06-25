"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { getAssets, getCrossAssetAlerts, isolateAsset } from "../app/actions/telemetry";
import { simulateSilentHost } from "../app/actions/simulate";
import { Shield, Server, Activity, AlertTriangle, ShieldAlert, Cpu, Lock, CheckSquare, TerminalSquare, Clock, Bot, User, Download } from "lucide-react";
// Clerk components are loaded dynamically only when Clerk is active (NEXT_PUBLIC_SKIP_CLERK !== "true")
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TENANT_ID = "org_demo_123";

const generateChartData = (alerts: any[]) => {
  const chartData = [];
  const now = Date.now();
  for (let i = 15; i >= 0; i--) {
    const time = new Date(now - i * 60000);
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const alertsInMinute = alerts.filter((a: any) => {
      const aTime = new Date(a.Timestamp).getTime();
      return aTime >= time.getTime() && aTime < time.getTime() + 60000;
    });
    
    const hasCritical = alertsInMinute.some((a: any) => a.RiskLevel === 'CRITICAL');
    const baseEgress = Math.floor(Math.random() * 40) + 10;
    const egressVal = hasCritical ? baseEgress + Math.floor(Math.random() * 800) + 400 : baseEgress;

    chartData.push({
      time: timeString,
      egress: egressVal
    });
  }
  return chartData;
};

const fetchDashboardData = async () => {
  const [fetchedAssets, fetchedAlerts] = await Promise.all([
    getAssets(TENANT_ID),
    getCrossAssetAlerts(TENANT_ID)
  ]);
  const sortedAlerts = fetchedAlerts.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
  const chartData = generateChartData(sortedAlerts);
  return { assets: fetchedAssets, alerts: sortedAlerts, chartData };
};

interface DashboardProps {
  initialAssets: any[];
  initialAlerts: any[];
}

const isUnreachable = (asset: any) => {
  if (asset.Status === 'ISOLATED') return false;
  if (!asset.LastHeartbeat) return false;
  const lastHeartbeatTime = new Date(asset.LastHeartbeat).getTime();
  return (Date.now() - lastHeartbeatTime > 5 * 60 * 1000); // 5 minutes threshold
};

const SCENARIOS = {
  scenario1: {
    name: "llama.cpp Accessing auth_tokens.json (Critical)",
    payload: {
      tenantId: TENANT_ID,
      assetId: "AST-M3PRO-001",
      processName: "llama.cpp",
      filesAccessed: ["auth_tokens.json"],
      cpuUsage: 85,
      ramUsage: 12,
      networkEgress: 500
    }
  },
  scenario2: {
    name: "ollama Accessing payroll_2026.xlsx (Critical)",
    payload: {
      tenantId: TENANT_ID,
      assetId: "AST-M3AIR-003",
      processName: "ollama",
      filesAccessed: ["payroll_2026.xlsx"],
      cpuUsage: 72,
      ramUsage: 16,
      networkEgress: 328
    }
  },
  scenario3: {
    name: "cursor.exe Accessing index.css (Clean)",
    payload: {
      tenantId: TENANT_ID,
      assetId: "AST-M3PRO-001",
      processName: "cursor.exe",
      filesAccessed: ["index.css"],
      cpuUsage: 5,
      ramUsage: 2,
      networkEgress: 1
    }
  },
  scenario4: {
    name: "Simulate Agent Going Silent (Heartbeat Timeout)",
    payload: {
      tenantId: TENANT_ID,
      assetId: "AST-MAC-004",
      processName: "HEARTBEAT_TIMEOUT",
      filesAccessed: [],
      cpuUsage: 0,
      ramUsage: 0,
      networkEgress: 0
    }
  }
};

export default function Dashboard({ initialAssets, initialAlerts }: DashboardProps) {
  console.log("--- DASHBOARD MOUNTED ---", initialAssets?.length, initialAlerts?.length);
  const sortedInitialAlerts = (initialAlerts || []).sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

  const { data, isLoading } = useSWR('dashboardData', fetchDashboardData, { 
    refreshInterval: 2000,
    fallbackData: {
      assets: initialAssets || [],
      alerts: sortedInitialAlerts,
      chartData: generateChartData(sortedInitialAlerts)
    }
  });
  const [isolatingId, setIsolatingId] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).hydrated = true;
      console.log("--- CLIENT HYDRATED ---");
    }
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedScenario, setSelectedScenario] = useState<keyof typeof SCENARIOS>("scenario1");
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([
    "System ready. Select a scenario to inject threat telemetry."
  ]);

  const assets = data?.assets || [];
  const alerts = data?.alerts || [];
  const chartData = data?.chartData || [];
  const isReallyLoading = isLoading && (!data || !data.assets || data.assets.length === 0);

  const handleInjectTelemetry = async () => {
    console.log("[DASHBOARD] handleInjectTelemetry called! Selected scenario:", selectedScenario);
    setSimulating(true);
    const scenario = SCENARIOS[selectedScenario];

    if (selectedScenario === "scenario4") {
      setSimulationLog(prev => [
        ...prev,
        `[SIMULATION] Triggering Agent silence on ${scenario.payload.assetId}...`,
        `[ACTION] Setting LastHeartbeat to 10 minutes ago in DB...`
      ]);
      try {
        const res = await simulateSilentHost(TENANT_ID, scenario.payload.assetId);
        if (res.success) {
          setSimulationLog(prev => [
            ...prev,
            `[RESPONSE] SUCCESS: ${res.message}`,
            `[DASHBOARD] Fleet Heatmap will reflect the unreachable status in 2-4 seconds.`
          ]);
          mutate('dashboardData');
        } else {
          setSimulationLog(prev => [
            ...prev,
            `[RESPONSE] FAILED: ${res.error}`
          ]);
        }
      } catch (err: any) {
        setSimulationLog(prev => [
          ...prev,
          `[ERROR] Simulation failed: ${err.message || err}`
        ]);
      } finally {
        setSimulating(false);
      }
      return;
    }

    setSimulationLog(prev => [
      ...prev,
      `[SIMULATION] Injecting telemetry for ${scenario.payload.assetId}...`,
      `[POST /api/ingest] Payload: ${JSON.stringify(scenario.payload)}`
    ]);

    try {
      console.log("[DASHBOARD] Fetching /api/ingest with payload:", scenario.payload);
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Agent-Key": "demo_agent_key_99"
        },
        body: JSON.stringify(scenario.payload)
      });
      
      const resData = await res.json();
      console.log("[DASHBOARD] Fetch response received:", res.status, resData);
      if (res.ok) {
        setSimulationLog(prev => [
          ...prev,
          `[RESPONSE ${res.status}] SUCCESS: ${resData.message || "Queued."}`,
          `[QUEUE] Fallback SQS queue worker will process in 2-4 seconds.`
        ]);
        mutate('dashboardData');
      } else {
        setSimulationLog(prev => [
          ...prev,
          `[RESPONSE ${res.status}] FAILED: ${resData.error || "Unknown error"} - ${resData.message || ""}`
        ]);
      }
    } catch (err: any) {
      console.error("[DASHBOARD] Fetch error:", err);
      setSimulationLog(prev => [
        ...prev,
        `[ERROR] Injection failed: ${err.message || err}`
      ]);
    } finally {
      setSimulating(false);
    }
  };

  const handleIsolate = async (assetId: string) => {
    setIsolatingId(assetId);
    setError(null);
    try {
      // Optimistic update
      mutate('dashboardData', {
        ...data,
        assets: assets.map((a: any) => a.AssetId === assetId ? { ...a, Status: "ISOLATED" } : a)
      }, false);
      
      const res = await isolateAsset(TENANT_ID, assetId);
      if (res && !res.success) {
        setError(res.error || "Failed to isolate host.");
        // Rollback optimistic update
        mutate('dashboardData');
      } else {
        mutate('dashboardData'); 
      }
    } catch (err: any) {
      console.error("Failed to isolate:", err);
      setError(err.message || "An unexpected error occurred.");
      mutate('dashboardData');
    } finally {
      setIsolatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-300 font-sans selection:bg-blue-900">
      
      {/* Top Navigation Bar */}
      <nav className="border-b border-zinc-800 bg-[#09090b] sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TerminalSquare className="w-5 h-5 text-blue-500" />
            <span className="font-mono font-bold text-sm text-gray-100 tracking-tight">LIFECYCLE_ZERO</span>
            <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono uppercase tracking-widest ml-2">Enterprise</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="/dashboard"
              className="text-[10px] font-mono px-3 py-1.5 border border-indigo-700 bg-indigo-950/20 text-indigo-400 hover:text-white hover:border-indigo-500 transition-colors flex items-center gap-1.5"
            >
              📊 FLEET DASHBOARD
            </a>
            <a 
              href="/api/export/audit"
              target="_blank"
              className="text-[10px] font-mono px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              EXPORT JSON
            </a>
            <a 
              href="/api/export/audit/csv"
              target="_blank"
              className="text-[10px] font-mono px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              EXPORT CSV
            </a>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-none shadow-[0_0_4px_#22c55e]" />
              <span className="font-mono text-xs text-green-500">SYS_ONLINE</span>
            </div>
            <div className="w-px h-4 bg-zinc-800 mx-2" />
            <div className="w-6 h-6 rounded-sm bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-400 select-none" title="Admin">
                ADM
              </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-950/20 border border-red-500/50 text-red-400 p-3 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>[ALERT_COMMAND_FAILED] ERROR: {error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-500 hover:text-white cursor-pointer">[DISMISS]</button>
          </div>
        )}
        
        {/* Telemetry Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <MetricCard icon={<Server />} title="ASSETS_TRACKED" value={assets.length} loading={isReallyLoading} />
          <MetricCard icon={<Cpu />} title="ROGUE_MODELS" value={Math.floor(assets.length * 0.4)} loading={isReallyLoading} />
          <MetricCard icon={<Activity />} title="INGEST_RATE" value="1.2k/s" loading={false} />
          <MetricCard icon={<ShieldAlert />} title="ACTIVE_THREATS" value={alerts.filter((a: any) => a.RiskLevel === 'CRITICAL').length} loading={isReallyLoading} alert />
        </div>

        {/* Network Egress Chart */}
        <div className="mb-4 bg-[#09090b] border border-zinc-800 p-4 relative">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
            <h2 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Global Telemetry Egress (MB/s)
            </h2>
            <div className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20">
              LIVE STREAM
            </div>
          </div>
          <div className="h-48 w-full">
            {isReallyLoading ? (
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-zinc-600">
                [AWAITING_TELEMETRY...]
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#3f3f46" fontSize={10} tickMargin={10} minTickGap={20} tickFormatter={(val) => val} />
                  <YAxis stroke="#3f3f46" fontSize={10} tickFormatter={(val) => val} orientation="right" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0px', fontFamily: 'monospace', fontSize: '12px' }}
                    itemStyle={{ color: '#60a5fa' }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Area type="step" dataKey="egress" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEgress)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Main Feed: Alerts */}
          <div className="lg:col-span-3">
            <div className="bg-[#09090b] border border-zinc-800 flex flex-col h-[600px]">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h2 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Security Incident Feed
                </h2>
                <span className="text-[10px] font-mono text-zinc-500">SORT: DESC</span>
              </div>
              
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {isReallyLoading ? (
                  <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">[SYNCING_DATABASE...]</div>
                ) : alerts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">[NO_INCIDENTS_FOUND]</div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert: any, i: number) => {
                      const isIsolated = assets.find((a: any) => a.AssetId === alert.AssetId)?.Status === 'ISOLATED';
                      const isCritical = alert.RiskLevel === 'CRITICAL';
                      
                      return (
                        <div key={i} className={`p-4 border bg-zinc-900/30 ${isIsolated ? 'border-zinc-800 opacity-60' : isCritical ? 'border-red-900/50 bg-red-950/10' : 'border-amber-900/30'} flex flex-col gap-3 relative`}>
                        {/* Status Bar */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${isIsolated ? 'bg-zinc-700' : isCritical ? 'bg-red-500' : 'bg-amber-500'}`} />
                        
                        <div className="flex justify-between items-start pl-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${isIsolated ? 'text-zinc-500 border-zinc-800' : isCritical ? 'text-red-400 border-red-900/50 bg-red-950/30' : 'text-amber-400 border-amber-900/50 bg-amber-950/30'}`}>
                                {isIsolated ? 'NEUTRALIZED' : `SEV_${alert.RiskLevel}`}
                              </span>
                              <span className="font-mono text-xs text-gray-300 font-bold">{alert.AssetId}</span>
                            </div>
                            <div className="font-mono text-xs text-gray-500 mt-1">
                              PROCESS: <span className="text-blue-400">{alert.ProcessName}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(alert.Timestamp).toISOString()}
                          </span>
                        </div>
                        
                        {/* Vertical Stepper Timeline */}
                        <div className="mt-3 space-y-3">
                          
                          {/* Step 1: Flagged */}
                          <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 bg-amber-950/20 border border-amber-900/30 text-amber-400 font-bold uppercase tracking-wider">[FLAGGED]</span>
                            <span className="font-mono text-[10px] text-zinc-500">{new Date(alert.Timestamp).toLocaleTimeString()}</span>
                            <span className="font-mono text-[10px] text-zinc-400">System anomaly detected</span>
                          </div>

                          {/* Step 2: AI Evaluated */}
                          <div className="flex flex-col gap-1.5 border-b border-zinc-900 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-950/20 border border-blue-900/30 text-blue-400 font-bold uppercase tracking-wider">[AI_EVALUATION]</span>
                              <span className="font-mono text-[10px] text-zinc-500">Autonomous risk analysis completed</span>
                            </div>
                            <p className="font-mono text-xs text-gray-400 bg-zinc-950 p-2 border border-zinc-800">
                              &gt; {alert.AiAnalysis || alert.Reasoning || "AI Evaluation detected anomalous behavior."}
                            </p>
                          </div>

                          {/* Step 3: Action */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] px-1.5 py-0.5 bg-red-950/20 border border-red-900/30 text-red-400 font-bold uppercase tracking-wider">[RESOLVED]</span>
                              <span className="font-mono text-[10px] text-zinc-400">{isIsolated ? "Host network traffic blocked" : "Awaiting manual command execution"}</span>
                            </div>
                            {isIsolated ? (
                              <div className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-3 py-1 border border-zinc-800">
                                [HOST_ISOLATED]
                              </div>
                            ) : isCritical ? (
                              <button 
                                onClick={() => handleIsolate(alert.AssetId)}
                                disabled={isolatingId === alert.AssetId}
                                className={`font-mono text-[10px] px-4 py-1.5 border ${isolatingId === alert.AssetId ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-red-950 border-red-800 text-red-400 hover:bg-red-800 hover:text-white cursor-pointer'}`}
                              >
                                {isolatingId === alert.AssetId ? 'ISOLATING...' : 'ISOLATE HOST'}
                              </button>
                            ) : (
                              <div className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-3 py-1 border border-zinc-800">[AWAITING_REVIEW]</div>
                            )}
                          </div>

                        </div>
                      </div>
                      )})}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Fleet Heatmap & Simulation Console */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            
            {/* Heatmap Card */}
            <div className="bg-[#09090b] border border-zinc-800 flex flex-col h-[250px]">
              <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h2 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Fleet Heatmap
                </h2>
                <span className="text-[10px] font-mono text-zinc-500">TOTAL: {assets.length}</span>
              </div>
              
              <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex flex-wrap gap-[3px]">
                  {assets.map((asset: any, idx: number) => {
                    const hasCriticalAlert = alerts.some((a: any) => a.AssetId === asset.AssetId && a.RiskLevel === 'CRITICAL');
                    const isIsolated = asset.Status === 'ISOLATED';
                    const isSilent = isUnreachable(asset);
                    
                    let bgColor = 'bg-green-500/80 hover:bg-green-400';
                    if (isIsolated) bgColor = 'bg-zinc-700 hover:bg-zinc-600';
                    else if (hasCriticalAlert) bgColor = 'bg-red-500 hover:bg-red-400 animate-pulse';
                    else if (isSilent) bgColor = 'bg-amber-500 hover:bg-amber-400';

                    const lastSeenText = asset.LastHeartbeat 
                      ? `${Math.floor((Date.now() - new Date(asset.LastHeartbeat).getTime()) / 60000)}m ago`
                      : "Never";

                    return (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedAsset(asset)}
                        title={`${asset.AssetId} - ${isIsolated ? 'ISOLATED' : isSilent ? `UNREACHABLE (Silent ${lastSeenText})` : hasCriticalAlert ? 'CRITICAL' : 'CLEAN'}`}
                        className={`w-[13px] h-[13px] ${bgColor} rounded-[2px] cursor-crosshair transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-800 pt-2.5">
                  <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-green-500/80 rounded-[2px]"></div> CLEAN / ACTIVE</div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-amber-500 rounded-[2px]"></div> UNREACHABLE / AGENT SILENT</div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-red-500 rounded-[2px]"></div> CRITICAL RISK</div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-zinc-700 rounded-[2px]"></div> ISOLATED / OFFLINE</div>
                </div>
              </div>
            </div>

            {/* Simulation Console Card */}
            <div className="bg-[#09090b] border border-zinc-800 flex flex-col h-[336px]">
              <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h2 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  Threat Simulation Sandbox
                </h2>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-none animate-ping" />
              </div>
              
              <div className="p-3 flex flex-col flex-1 gap-2.5 justify-between">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Select Threat Vector</label>
                  <select 
                    value={selectedScenario}
                    onChange={(e) => setSelectedScenario(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-xs font-mono text-gray-300 focus:outline-none focus:border-blue-800 rounded-none cursor-pointer"
                  >
                    {Object.entries(SCENARIOS).map(([key, val]) => (
                      <option key={key} value={key} className="bg-[#09090b] text-gray-300 font-mono">
                        {val.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simulation Output Console */}
                <div className="flex-1 bg-zinc-950 border border-zinc-900 p-2 font-mono text-[9px] text-zinc-400 overflow-y-auto custom-scrollbar flex flex-col gap-1 max-h-[140px] select-text">
                  {simulationLog.map((logLine, idx) => (
                    <div key={idx} className={logLine.includes("SUCCESS") ? "text-green-500" : logLine.includes("FAILED") || logLine.includes("ERROR") ? "text-red-500" : logLine.includes("SIMULATION") ? "text-blue-400" : "text-zinc-500"}>
                      &gt; {logLine}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { console.log("--- BUTTON CLICKED ---"); handleInjectTelemetry(); }}
                  disabled={simulating}
                  className={`w-full font-mono text-xs py-2 border text-center transition-colors font-bold ${
                    simulating 
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed' 
                      : 'bg-blue-950/40 border-blue-900 text-blue-400 hover:bg-blue-900 hover:text-white cursor-pointer'
                  }`}
                >
                  {simulating ? "INJECTING TELEMETRY..." : "RUN THREAT SIMULATION"}
                </button>
              </div>
            </div>

          </div>

      </div>
      </div>
      
      {/* Host Details Drawer Overlay */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end transition-opacity">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col justify-between h-full shadow-2xl relative">
            <button 
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white font-mono text-xs cursor-pointer"
            >
              [CLOSE_x]
            </button>
            
            <div className="flex-1 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-blue-500" />
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">HOST_METADATA_DRAWER</span>
              </div>
              
              <h3 className="text-lg font-mono font-bold text-gray-100 mb-6">{selectedAsset.AssetId}</h3>
              
              <div className="space-y-4 border-t border-zinc-900 pt-4">
                <DetailRow label="HOSTNAME" value={selectedAsset.AssetName} />
                <DetailRow label="SERIAL_NO" value={selectedAsset.SerialNo} />
                <DetailRow label="DEVICE_TYPE" value={selectedAsset.Type} />
                <DetailRow label="ASSIGNED_TO" value={selectedAsset.EmployeeName} />
                
                <DetailRow 
                  label="STATUS" 
                  value={
                    selectedAsset.Status === "ISOLATED" 
                      ? "ISOLATED (CONTAINED)" 
                      : isUnreachable(selectedAsset) 
                        ? "UNREACHABLE (SILENT)" 
                        : "ACTIVE / COMPLIANT"
                  } 
                  badgeColor={
                    selectedAsset.Status === "ISOLATED" 
                      ? "text-red-500 bg-red-950/20 border-red-900/50" 
                      : isUnreachable(selectedAsset) 
                        ? "text-amber-500 bg-amber-950/20 border-amber-900/50" 
                        : "text-green-500 bg-green-950/20 border-green-900/50"
                  }
                />
                
                <DetailRow 
                  label="LAST_HEARTBEAT" 
                  value={
                    selectedAsset.LastHeartbeat 
                      ? `${new Date(selectedAsset.LastHeartbeat).toLocaleString()} (${Math.floor((Date.now() - new Date(selectedAsset.LastHeartbeat).getTime()) / 60000)}m ago)`
                      : "Never Reported"
                  } 
                />
              </div>
              
              {isUnreachable(selectedAsset) && (
                <div className="mt-6 p-3 bg-amber-950/10 border border-amber-900/30 text-amber-500 font-mono text-[10px] flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div>
                    <strong>[WARNING_AGENT_SILENT]</strong>
                    <p className="mt-1 text-zinc-400">This asset's local governance daemon has stopped reporting telemetry heartbeats. Tampering or offline state suspected.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-zinc-900 pt-4 flex flex-col gap-3">
              {selectedAsset.Status !== "ISOLATED" ? (
                <button
                  onClick={async () => {
                    await handleIsolate(selectedAsset.AssetId);
                    setSelectedAsset((prev: any) => prev ? { ...prev, Status: "ISOLATED" } : null);
                  }}
                  disabled={isolatingId === selectedAsset.AssetId}
                  className="w-full bg-red-950 border border-red-800 hover:bg-red-800 text-red-400 hover:text-white py-2 font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  {isolatingId === selectedAsset.AssetId ? "ISOLATING..." : "FORCE ISOLATE HOST"}
                </button>
              ) : (
                <div className="w-full bg-zinc-900 text-zinc-500 border border-zinc-800 py-2 text-center font-mono text-xs">
                  [HOST_ISOLATION_LOCKED]
                </div>
              )}
              <button 
                onClick={() => setSelectedAsset(null)}
                className="w-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 py-2 font-mono text-xs cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, badgeColor }: { label: string, value: string, badgeColor?: string }) {
  return (
    <div className="flex justify-between items-center text-xs font-mono py-1">
      <span className="text-zinc-500">{label}:</span>
      {badgeColor ? (
        <span className={`px-2 py-0.5 border ${badgeColor}`}>
          {value}
        </span>
      ) : (
        <span className="text-zinc-300">{value}</span>
      )}
    </div>
  );
}

function MetricCard({ icon, title, value, loading, alert = false }: { icon: React.ReactNode, title: string, value: any, loading: boolean, alert?: boolean }) {
  return (
    <div className={`p-4 bg-[#09090b] border relative ${alert ? 'border-red-900/50 bg-red-950/5' : 'border-zinc-800'}`}>
      {alert && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500" />}
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-mono text-zinc-500">{title}</div>
        <div className={`w-4 h-4 ${alert ? 'text-red-500' : 'text-zinc-600'}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-mono text-gray-200">
        {loading ? <span className="animate-pulse text-zinc-800">000</span> : value}
      </div>
    </div>
  );
}
