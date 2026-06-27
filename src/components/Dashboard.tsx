"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { getAssets, getCrossAssetAlerts, isolateAsset, bulkIsolateAssets, restoreAsset, simulateSilentHost } from "@/lib/api";
import { Shield, Server, Activity, AlertTriangle, ShieldAlert, Cpu, TerminalSquare, Bot, Download } from "lucide-react";
// Clerk components are loaded dynamically only when Clerk is active (NEXT_PUBLIC_SKIP_CLERK !== "true")
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Tactical3DGrid from "./Tactical3DGrid";
import { audio } from "@/lib/audio";


const TENANTS = [
  { id: "org_demo_123",      name: "Acme Corp (Demo)" },
  { id: "org_fintech_456",  name: "FinTech Inc" },
  { id: "org_healthco_789", name: "HealthCo Ltd" },
];
const DEFAULT_TENANT_ID = "org_demo_123";

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

const fetchDashboardData = async (tenantId: string) => {
  const [fetchedAssets, fetchedAlerts] = await Promise.all([
    getAssets(tenantId),
    getCrossAssetAlerts(tenantId)
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
      tenantId: DEFAULT_TENANT_ID,
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
      tenantId: DEFAULT_TENANT_ID,
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
      tenantId: DEFAULT_TENANT_ID,
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
      tenantId: DEFAULT_TENANT_ID,
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
  const [activeTenantId, setActiveTenantId] = useState(DEFAULT_TENANT_ID);
  const sortedInitialAlerts = (initialAlerts || []).sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

  const { data, isLoading } = useSWR(['dashboardData', activeTenantId], ([, tenantId]) => fetchDashboardData(tenantId as string), { 
    refreshInterval: 2000,
    fallbackData: {
      assets: initialAssets || [],
      alerts: sortedInitialAlerts,
      chartData: generateChartData(sortedInitialAlerts)
    }
  });
  const [isolatingId, setIsolatingId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [view3d, setView3d] = useState(true); // Default to true (3D) to wow the user on first load!
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkIsolating, setBulkIsolating] = useState(false);


  
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).hydrated = true;
    }
  }, []);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [confirmIsolate, setConfirmIsolate] = useState<any | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio and CLI states
  const [isMuted, setIsMuted] = useState(true);
  const [cliInput, setCliInput] = useState("");
  const [cliHistory, setCliHistory] = useState<string[]>([
    "LIFECYCLEZERO SECURITY INTERACTIVE COMMAND LINE v9.0.0",
    "ENTER 'help' TO VIEW ALL CONSOLE OPERATIONS.",
    ""
  ]);
  const cliEndRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(1782531600000);

  useEffect(() => {
    setIsMuted(audio.isMuted());
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    cliEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cliHistory]);

  const [selectedScenario, setSelectedScenario] = useState<keyof typeof SCENARIOS>("scenario1");
  const [simulating, setSimulating] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);
  const [simulationLog, setSimulationLog] = useState<string[]>([
    "System ready. Select a scenario to inject threat telemetry."
  ]);

  const assets = data?.assets || [];
  const alerts = data?.alerts || [];
  const chartData = data?.chartData || [];
  const isReallyLoading = isLoading && (!data || !data.assets || data.assets.length === 0);

  const handleInjectTelemetry = async () => {
    setSimulating(true);
    setSimulationCount(prev => prev + 1);
    setSimulationLog([]); // Clear terminal log
    
    const scenario = SCENARIOS[selectedScenario];
    const appendLog = (line: string, delay: number) => {
      setTimeout(() => {
        setSimulationLog(prev => [...prev, line]);
      }, delay);
    };

    if (selectedScenario === "scenario4") {
      appendLog(`[SIMULATION] Triggering Agent silence on ${scenario.payload.assetId}...`, 0);
      appendLog(`[ACTION] Setting LastHeartbeat to 10 minutes ago in DB...`, 600);

      setTimeout(async () => {
        try {
          const res = await simulateSilentHost(activeTenantId, scenario.payload.assetId);
          if (res.success) {
            setSimulationLog(prev => [
              ...prev,
              `[RESPONSE] SUCCESS: ${res.message}`,
              `[DASHBOARD] Fleet Heatmap will reflect the unreachable status in 2-4 seconds.`
            ]);
            audio.playAlarm();
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
      }, 1200);
      return;
    }

    appendLog(`[SIMULATION] Injecting telemetry for ${scenario.payload.assetId}...`, 0);
    appendLog(`[POST /api/ingest] Payload: ${JSON.stringify(scenario.payload)}`, 600);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Agent-Key": "demo_agent_key_99"
          },
          body: JSON.stringify(scenario.payload)
        });
        
        const resData = await res.json();
        if (res.ok) {
          setSimulationLog(prev => [
            ...prev,
            `[RESPONSE ${res.status}] SUCCESS: ${resData.message || "Queued."}`,
            `[QUEUE] Fallback SQS queue worker will process in 2-4 seconds.`
          ]);
          if (scenario.payload.processName !== "cursor.exe") {
            audio.playAlarm();
          } else {
            audio.playClick();
          }
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
    }, 1200);
  };

  const handleIsolate = async (assetId: string, reason?: string) => {
    setIsolatingId(assetId);
    setError(null);
    try {
      // Optimistic update
      mutate('dashboardData', {
        ...data,
        assets: assets.map((a: any) => a.AssetId === assetId ? { ...a, Status: "ISOLATED" } : a)
      }, false);
      
      const res = await isolateAsset(activeTenantId, assetId, reason);
      if (res && !res.success) {
        setError(res.error || "Failed to isolate host.");
        // Rollback optimistic update
        mutate('dashboardData');
      } else {
        audio.playSeverance();
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

  const handleCliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmdStr = cliInput.trim();
    if (!cmdStr) return;

    if (!isMuted) audio.playClick();
    setCliHistory(prev => [...prev, `ADM@LIFECYCLEZERO:~$ ${cmdStr}`]);
    setCliInput("");

    const parts = cmdStr.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case "help":
        setCliHistory(prev => [
          ...prev,
          "AVAILABLE OPERATIONS:",
          "  help                - Display this instructions sheet",
          "  clear               - Clear terminal screen log",
          "  fleet / assets      - List all tracked hosts and health status",
          "  isolate <AssetId>   - Trigger network isolation on host node",
          "  restore <AssetId>   - Restore host network connection",
          "  simulate <1-4>      - Trigger threat simulation scenario (1-4)",
          "  audit               - Print host compliance isolation metrics",
          "  mute / unmute       - Toggle tactile sound console",
          ""
        ]);
        break;
      case "clear":
        setCliHistory([]);
        break;
      case "fleet":
      case "assets":
        if (assets.length === 0) {
          setCliHistory(prev => [...prev, "  NO ENDPOINTS TRACKED IN FLEET.", ""]);
        } else {
          setCliHistory(prev => [
            ...prev,
            "CURRENT FLEET DIRECTORY:",
            ...assets.map((a: any) => {
              const hasCritical = alerts.some((al: any) => al.AssetId === a.AssetId && al.RiskLevel === "CRITICAL");
              const isSilent = isUnreachable(a);
              const statusStr = a.Status === "ISOLATED" ? "ISOLATED" : hasCritical ? "CRITICAL" : isSilent ? "UNREACHABLE" : "CLEAN";
              return `  ${a.AssetId.padEnd(16)} | ${a.AssetName.padEnd(16)} | USER: ${a.EmployeeName.padEnd(12)} | STATUS: ${statusStr}`;
            }),
            ""
          ]);
        }
        break;
      case "isolate": {
        const id = args[0]?.toUpperCase();
        if (!id) {
          setCliHistory(prev => [...prev, "  ERROR: Specify target asset ID (e.g., isolate AST-M3PRO-001)", ""]);
          break;
        }
        const target = assets.find((a: any) => a.AssetId === id);
        if (!target) {
          setCliHistory(prev => [...prev, `  ERROR: Host '${id}' not found in registered tenant fleet.`, ""]);
          break;
        }
        if (target.Status === "ISOLATED") {
          setCliHistory(prev => [...prev, `  NOTICE: Host '${id}' is already network isolated.`, ""]);
          break;
        }
        setConfirmIsolate(target);
        setModalReason("Emergency command-line operation");
        setCliHistory(prev => [...prev, `  [ACTION] Triggering compliance confirmation modal for host '${id}'...`, ""]);
        break;
      }
      case "restore": {
        const id = args[0]?.toUpperCase();
        if (!id) {
          setCliHistory(prev => [...prev, "  ERROR: Specify target asset ID (e.g., restore AST-M3PRO-001)", ""]);
          break;
        }
        const target = assets.find((a: any) => a.AssetId === id);
        if (!target) {
          setCliHistory(prev => [...prev, `  ERROR: Host '${id}' not found in registered tenant fleet.`, ""]);
          break;
        }
        if (target.Status !== "ISOLATED") {
          setCliHistory(prev => [...prev, `  NOTICE: Host '${id}' is currently active and clean.`, ""]);
          break;
        }

        setCliHistory(prev => [...prev, `  [ACTION] Restoring connectivity for host '${id}'...`, ""]);
        try {
          const res = await restoreAsset(activeTenantId, id);
          if (res.success) {
            setCliHistory(prev => [...prev, `  [SUCCESS] Host network link re-established for '${id}'.`, ""]);
            if (!isMuted) audio.playClick();
            mutate('dashboardData');
          } else {
            setCliHistory(prev => [...prev, `  [FAILED] API returned error: ${res.error}`, ""]);
          }
        } catch (err: any) {
          setCliHistory(prev => [...prev, `  [ERROR] Network fault: ${err.message || err}`, ""]);
        }
        break;
      }
      case "simulate": {
        const indexStr = args[0];
        if (!indexStr || !["1", "2", "3", "4"].includes(indexStr)) {
          setCliHistory(prev => [...prev, "  ERROR: Specify simulation scenario index (1-4).", ""]);
          break;
        }
        const scMap = { "1": "scenario1", "2": "scenario2", "3": "scenario3", "4": "scenario4" } as const;
        const selectedSc = scMap[indexStr as "1"|"2"|"3"|"4"];
        setSelectedScenario(selectedSc);
        setCliHistory(prev => [...prev, `  [ACTION] Running ${SCENARIOS[selectedSc].name}...`, ""]);
        
        // Trigger telemetry injection
        setTimeout(() => {
          handleInjectTelemetry();
        }, 100);
        break;
      }
      case "audit": {
        const total = assets.length;
        const clean = assets.filter((a: any) => a.Status === "ACTIVE" && !isUnreachable(a)).length;
        const isolated = assets.filter((a: any) => a.Status === "ISOLATED").length;
        const silent = assets.filter((a: any) => isUnreachable(a)).length;
        const critical = alerts.filter((al: any) => al.RiskLevel === "CRITICAL").length;

        setCliHistory(prev => [
          ...prev,
          "ISOLATION COMPLIANCE STATUS SUMMARY:",
          `  TOTAL REGISTRATION NODE COUNT : ${total}`,
          `  CLEAN COMPLIANT FLEET SIZE    : ${clean}`,
          `  ACTIVE SECURITY THREATS       : ${critical}`,
          `  ISOLATED NEUTRALIZED AGENTS    : ${isolated}`,
          `  SILENT OR UNREACHABLE ASSETS  : ${silent}`,
          ""
        ]);
        break;
      }
      case "mute":
        setIsMuted(true);
        audio.setMuted(true);
        setCliHistory(prev => [...prev, "  [AUDIO] Audio muted.", ""]);
        break;
      case "unmute":
        setIsMuted(false);
        audio.setMuted(false);
        audio.playClick();
        setCliHistory(prev => [...prev, "  [AUDIO] Audio activated.", ""]);
        break;
      default:
        setCliHistory(prev => [
          ...prev,
          `  ERROR: Command '${cmd}' unrecognized. Type 'help' to review supported operational verbs.`,
          ""
        ]);
        break;
    }
  };

  const handleBulkIsolate = async () => {
    if (selectedAssetIds.size === 0) return;
    setBulkIsolating(true);
    try {
      const ids = Array.from(selectedAssetIds);
      await bulkIsolateAssets(activeTenantId, ids);
      setSelectedAssetIds(new Set());
      setSelectionMode(false);
      mutate('dashboardData');
    } catch (err: any) {
      console.error("Bulk isolation failed:", err);
    } finally {
      setBulkIsolating(false);
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
            {/* Multi-tenant switcher */}
            <select
              value={activeTenantId}
              onChange={(e) => {
                setActiveTenantId(e.target.value);
                setSelectedAssetIds(new Set());
                setSelectionMode(false);
                mutate('dashboardData');
              }}
              className="ml-4 bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px] px-2 py-1 focus:outline-none focus:border-blue-700 cursor-pointer"
              title="Switch tenant workspace"
            >
              {TENANTS.map(t => (
                <option key={t.id} value={t.id} className="bg-zinc-900 font-mono">{t.name}</option>
              ))}
            </select>
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
            <button
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                audio.setMuted(nextMute);
                if (!nextMute) {
                  audio.playClick();
                }
              }}
              className="font-mono text-[9px] border border-zinc-850 bg-[#0a0a0a]/70 px-2 py-0.5 text-zinc-500 hover:text-white cursor-pointer hover:border-zinc-700 transition-colors uppercase tracking-wider"
            >
              {isMuted ? "🔊 AUDIO OFF" : "🔊 AUDIO ON"}
            </button>
            <div className="w-px h-4 bg-zinc-850 mx-1" />
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

      {/* T09: Live Stats Ticker */}
      <div className="w-full bg-red-950/80 border-b border-red-900 text-red-500 font-mono text-[10px] uppercase tracking-widest overflow-hidden py-1.5 flex items-center shadow-[0_0_15px_rgba(220,38,38,0.15)] relative z-25">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee-scroll {
            display: flex;
            width: max-content;
            animation: marquee 35s linear infinite;
          }
        `}} />
        <div className="animate-marquee-scroll flex gap-12 whitespace-nowrap">
          {Array(2).fill(null).map((_, i) => (
            <div key={i} className="flex gap-12 items-center">
              <span className="text-red-400 font-bold">⚡ LIVE TELEMETRY STREAM</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
              <span>ASSETS TRACKED: {assets.length} ENDPOINTS</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
              <span className="font-bold text-red-400">ACTIVE COMPROMISED NODES: {alerts.filter((a: any) => a.RiskLevel === 'CRITICAL').length}</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
              <span>ESTIMATED SHADOW AI BREACH COST PREVENTED: $670K</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
              <span className="text-amber-400 font-bold">EU AI ACT TIER 2 ENFORCEMENT COUNTDOWN: {Math.max(0, Math.ceil((new Date('2026-08-02').getTime() - now) / 86400000))} DAYS</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
              <span className="text-green-500 font-bold">SOC 2 AUDIT EXPORT STATUS: READIED</span>
              <span className="w-1 h-1 bg-red-500 rounded-none"></span>
            </div>
          ))}
        </div>
      </div>

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
          <MetricCard icon={<Cpu />} title="ROGUE_MODELS" value={alerts.filter((a: any) => a.RiskLevel === 'CRITICAL' || a.RiskLevel === 'WARNING').length} loading={isReallyLoading} />
          <MetricCard icon={<Activity />} title="SIMULATION_EVENTS" value={simulationCount} loading={false} />
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
          
          {/* Main Feed: Alerts + CLI Terminal */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* Security Incident Feed */}
            <div className="bg-[#09090b] border border-zinc-800 flex flex-col h-[410px]">
              <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
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

            {/* CLI Cockpit Terminal Console */}
            <div className="bg-[#09090b] border border-zinc-800 h-[176px] flex flex-col justify-between overflow-hidden">
              <div className="px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/30 flex justify-between items-center text-[9px] font-mono text-zinc-500 select-none">
                <span className="flex items-center gap-1.5"><TerminalSquare className="w-3.5 h-3.5 text-blue-500" /> COCKPIT OPERATIONAL CONSOLE</span>
                <span>ADM@LIFECYCLEZERO:~</span>
              </div>
              
              {/* Output log */}
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] text-[#00FF41] bg-[#050505]/95 custom-scrollbar space-y-1 select-text relative">
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] opacity-10"></div>
                {cliHistory.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                ))}
                <div ref={cliEndRef} />
              </div>

              {/* Form Input */}
              <form onSubmit={handleCliSubmit} className="border-t border-zinc-800 bg-[#070708] flex items-center px-4 py-1.5">
                <span className="font-mono text-[9px] text-blue-500 font-bold select-none mr-2">ADM@LIFECYCLEZERO:~$</span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  className="flex-1 bg-transparent text-[#00FF41] font-mono text-xs focus:outline-none placeholder-zinc-800"
                  placeholder="Type 'help' to see active command catalog..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </form>
            </div>

          </div>

          {/* Sidebar: Fleet Heatmap & Simulation Console */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            
            {/* Architecture Info Panel (T10b) */}
            <div className="bg-[#09090b] border border-blue-900/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <h3 className="text-[10px] font-mono text-blue-400 font-bold tracking-widest uppercase">Zero Stack Architecture</h3>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono leading-relaxed mb-3">
                Built on Next.js App Router and AWS DynamoDB with single-table design. Uses <span className="text-white">GSI2 Sparse Indexes</span> for O(1) retrieval of active threats, bypassing full table scans.
              </p>
              <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 border-t border-zinc-800 pt-2">
                <span>Latency: ~45ms</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> SQS Worker Active</span>
              </div>
            </div>

            {/* Heatmap Card */}
            <div className={`bg-[#09090b] border border-zinc-800 flex flex-col relative transition-all duration-300 ${view3d ? 'h-[360px]' : 'h-[250px]'}`}>
              <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h2 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Fleet Heatmap
                  {selectionMode && selectedAssetIds.size > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-950/30 border border-red-900/50 text-red-400 text-[9px] font-bold">
                      {selectedAssetIds.size} SELECTED
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 mr-2">TOTAL: {assets.length}</span>
                  <button
                    onClick={() => setView3d(v => !v)}
                    className={`font-mono text-[9px] px-2 py-0.5 border mr-1 transition-colors cursor-pointer ${
                      view3d
                        ? 'border-blue-700 text-blue-400 bg-blue-950/20'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                    }`}
                  >
                    {view3d ? '2D VIEW' : '3D VIEW'}
                  </button>
                  <button
                    onClick={() => { setSelectionMode(m => !m); setSelectedAssetIds(new Set()); }}
                    className={`font-mono text-[9px] px-2 py-0.5 border transition-colors ${
                      selectionMode
                        ? 'border-blue-700 text-blue-400 bg-blue-950/20'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                    }`}
                  >
                    {selectionMode ? 'CANCEL' : 'SELECT'}
                  </button>
                  {selectionMode && selectedAssetIds.size > 0 && (
                    <button
                      onClick={handleBulkIsolate}
                      disabled={bulkIsolating}
                      className="font-mono text-[9px] px-2 py-0.5 border border-red-800 text-red-400 bg-red-950/20 hover:bg-red-800 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {bulkIsolating ? 'ISOLATING...' : `ISOLATE ${selectedAssetIds.size}`}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 relative min-h-0">
                {view3d ? (
                  <Tactical3DGrid
                    assets={assets}
                    alerts={alerts}
                    isUnreachable={isUnreachable}
                    selectionMode={selectionMode}
                    selectedAssetIds={selectedAssetIds}
                    setSelectedAssetIds={setSelectedAssetIds}
                    setSelectedAsset={setSelectedAsset}
                  />
                ) : (
                  <div className="p-3 overflow-y-auto custom-scrollbar h-full flex flex-col justify-between">
                    <div>
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
                            ? `${Math.floor((now - new Date(asset.LastHeartbeat).getTime()) / 60000)}m ago`
                            : "Never";

                          const isSelected = selectedAssetIds.has(asset.AssetId);

                          return (
                            <div key={idx} className="relative group">
                              <button 
                                onClick={() => {
                                  if (selectionMode) {
                                    setSelectedAssetIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(asset.AssetId)) next.delete(asset.AssetId);
                                      else next.add(asset.AssetId);
                                      return next;
                                    });
                                  } else {
                                    setSelectedAsset(asset);
                                  }
                                }}
                                className={`w-[13px] h-[13px] ${bgColor} rounded-[2px] transition-colors focus:outline-none block ${
                                  isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950' : 'cursor-crosshair focus:ring-1 focus:ring-zinc-400'
                                }`}
                              />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover:block z-[99] bg-[#050505] border border-zinc-800 p-2 font-mono text-[9px] text-zinc-400 w-48 rounded-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none">
                                <div className="text-white font-bold mb-1 pb-1 border-b border-zinc-900 flex justify-between">
                                  <span>{asset.AssetId}</span>
                                  <span className={
                                    isIsolated ? 'text-zinc-500 font-bold' : hasCriticalAlert ? 'text-red-500 font-bold' : isSilent ? 'text-amber-500 font-bold' : 'text-green-500 font-bold'
                                  }>
                                    {isIsolated ? 'ISOLATED' : hasCriticalAlert ? 'CRITICAL' : isSilent ? 'UNREACHABLE' : 'CLEAN'}
                                  </span>
                                </div>
                                <div>HOST: {asset.AssetName}</div>
                                <div>TYPE: {asset.Type}</div>
                                <div>USER: {asset.EmployeeName}</div>
                                <div className="text-zinc-600 mt-1">LAST SEEN: {lastSeenText}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-800 pt-2.5">
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-green-500/80 rounded-[2px]"></div> CLEAN / ACTIVE</div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-amber-500 rounded-[2px]"></div> UNREACHABLE / AGENT SILENT</div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-red-500 rounded-[2px]"></div> CRITICAL RISK</div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-500"><div className="w-2.5 h-2.5 bg-zinc-700 rounded-[2px]"></div> ISOLATED / OFFLINE</div>
                    </div>
                  </div>
                )}
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
                <div className="flex-1 bg-[#050505] border border-green-900/30 p-3 font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 max-h-[140px] select-text relative shadow-[inset_0_0_20px_rgba(0,255,0,0.02)]">
                  {simulationLog.map((logLine, idx) => (
                    <div key={idx} className="text-green-500/90 leading-tight">
                      <span className="text-green-800/70 mr-2">[{new Date().toISOString().split('T')[1].slice(0,12)}]</span>
                      <span className={logLine.includes("FAILED") || logLine.includes("ERROR") ? "text-red-400" : ""}>{logLine}</span>
                    </div>
                  ))}
                  <div className="w-1.5 h-3 bg-green-500 mt-1 animate-pulse"></div>
                  {/* Scanline overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
                </div>

                <button
                  onClick={() => { handleInjectTelemetry(); }}
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
      
      {/* T07: Isolation Confirmation Modal */}
      {confirmIsolate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#0a0505] border border-red-900/50 shadow-[0_0_50px_-12px_rgba(220,38,38,0.2)] flex flex-col">
            <div className="bg-red-950/40 border-b border-red-900/50 p-4 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
              <h2 className="text-red-500 font-mono font-bold text-sm tracking-widest uppercase">Emergency Isolation Protocol</h2>
            </div>
            <div className="p-6 space-y-5 font-mono">
              <div className="text-gray-400 text-xs leading-relaxed">
                You are about to sever all network connectivity for the following asset. 
                This action is immediate and will disrupt active sessions.
              </div>
              <div className="bg-[#0f0a0a] border border-red-900/20 p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-red-500/50">ASSET_ID:</span> <span className="text-red-100">{confirmIsolate.AssetId}</span></div>
                <div className="flex justify-between"><span className="text-red-500/50">ASSIGNED_TO:</span> <span className="text-red-100">{confirmIsolate.EmployeeName}</span></div>
                <div className="flex justify-between mt-2 pt-2 border-t border-red-900/20">
                  <span className="text-red-500/50">CURRENT_STATE:</span> 
                  <span className="text-red-500 font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                    COMPROMISED
                  </span>
                </div>
              </div>

              {/* [REQUIRED] Operator Audit Reason field */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-wider block">
                  [REQUIRED] OPERATOR AUDIT REASON
                </label>
                <textarea
                  value={modalReason}
                  onChange={(e) => {
                    setModalReason(e.target.value);
                    if (e.target.value.trim() !== "") setReasonError(false);
                  }}
                  placeholder="Enter justification for network severance (e.g., Rogue local process ollama accessing payroll backup)..."
                  className={`w-full bg-[#050505] border text-xs font-mono p-3 focus:outline-none h-20 text-red-100 rounded-sm transition-colors ${
                    reasonError ? 'border-red-500 focus:border-red-400' : 'border-red-900/40 focus:border-red-600'
                  }`}
                />
                {reasonError && (
                  <span className="text-[9px] text-red-400 font-mono block">
                    ⚠ ERROR: Operator justification is required to execute isolation protocol.
                  </span>
                )}
              </div>
              
              <div className="bg-red-950/20 border-l border-red-500/50 p-3 text-[10px] text-red-400/80 leading-relaxed">
                <strong className="text-red-400">COMPLIANCE NOTICE:</strong> Immediate isolation fulfills EU AI Act Art. 14 (Human Oversight) requirements for neutralizing rogue autonomous agents.
              </div>
            </div>
            <div className="p-4 border-t border-red-900/30 flex gap-3 bg-[#050202]">
              <button 
                onClick={() => {
                  setConfirmIsolate(null);
                  setModalReason("");
                  setReasonError(false);
                }}
                className="flex-1 py-2 font-mono text-xs border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button 
                onClick={async () => {
                  if (modalReason.trim() === "") {
                    setReasonError(true);
                    return;
                  }
                  const assetToIsolate = confirmIsolate;
                  const reasonToSend = modalReason;
                  setConfirmIsolate(null);
                  setModalReason("");
                  setReasonError(false);
                  await handleIsolate(assetToIsolate.AssetId, reasonToSend);
                  setSelectedAsset((prev: any) => prev ? { ...prev, Status: "ISOLATED" } : null);
                }}
                className="flex-1 py-2 font-mono text-xs font-bold bg-red-950/50 text-red-500 hover:bg-red-900 hover:text-white transition-colors border border-red-900/50 hover:border-red-500 cursor-pointer"
              >
                CONFIRM ISOLATION
              </button>
            </div>
          </div>
        </div>
      )}

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
                      ? `${new Date(selectedAsset.LastHeartbeat).toLocaleString()} (${Math.floor((now - new Date(selectedAsset.LastHeartbeat).getTime()) / 60000)}m ago)`
                      : "Never Reported"
                  } 
                />
              </div>
              
              {isUnreachable(selectedAsset) && (
                <div className="mt-6 p-3 bg-amber-950/10 border border-amber-900/30 text-amber-500 font-mono text-[10px] flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div>
                    <strong>[WARNING_AGENT_SILENT]</strong>
                    <p className="mt-1 text-zinc-400">This asset&apos;s local governance daemon has stopped reporting telemetry heartbeats. Tampering or offline state suspected.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-zinc-900 pt-4 flex flex-col gap-3">
              {selectedAsset.Status !== "ISOLATED" ? (
                <button
                  onClick={() => setConfirmIsolate(selectedAsset)}
                  disabled={isolatingId === selectedAsset.AssetId}
                  className="w-full bg-red-950 border border-red-800 hover:bg-red-800 text-red-400 hover:text-white py-2 font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  {isolatingId === selectedAsset.AssetId ? "ISOLATING..." : "FORCE ISOLATE HOST"}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const res = await restoreAsset(activeTenantId, selectedAsset.AssetId);
                    if (res.success) {
                      setSelectedAsset((prev: any) => prev ? { ...prev, Status: "ACTIVE" } : null);
                      mutate('dashboardData');
                    } else {
                      setError(res.error || "Failed to restore asset.");
                    }
                  }}
                  className="w-full bg-green-950 border border-green-800 hover:bg-green-800 text-green-400 hover:text-white py-2 font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  RESTORE HOST (RE-ENABLE NETWORK)
                </button>
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
