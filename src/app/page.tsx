"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SplashShader from "@/components/SplashShader";
import { Database, MessageSquare, Triangle, Shield } from "lucide-react";
import { audio } from "@/lib/audio";

const BOOT_LOGS = [
  "INITIALIZING LIFECYCLEZERO SECURITY CONSOLE...",
  "ESTABLISHING SECURE TLS v1.3 CONNECTION...",
  "RESOLVING DB SCHEMA FOR org_demo_123...",
  "CONNECTING DYNAMODB ENGINE... [OK]",
  "VERIFYING KMS KEY ENCRYPTION AT REST... [OK]",
  "STREAMING SQS TELEMETRY QUEUE... [ONLINE]",
  "COMPILING WEBGL FRAGMENT DUST SHADER... [OK]",
  "SPAWNING ASYNC WORKER TELEMETRY DAEMON... [OK]",
  "COMPILING HEURISTIC THREAT SCANNERS...",
  "FOUND 14 ACTIVE CONTAINER GOVERNANCE LAWS...",
  "SCANNING FLEET METADATA FOR ROGUE AGENTS...",
  "SYNCHRONIZING ZERO-TRUST LEDGER TRAIL... [OK]",
  "CORE SYSTEM INITIALIZATION COMPLETE.",
  "READY FOR OPERATOR HANDSHAKE."
];

export default function WelcomePage() {
  const router = useRouter();
  const fullText = "Zero Trust. Zero Delays. Zero Rogue Agents.";
  const [typedText, setTypedText] = useState("");
  const [showStats, setShowStats] = useState(false);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMuted(audio.isMuted());
  }, []);

  // Diagnostic Logs state
  const [logIndex, setLogIndex] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Typewriter effect
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index + 1));
      index++;
      if (index >= fullText.length) {
        clearInterval(interval);
        setTimeout(() => setShowStats(true), 300);
      }
    }, 35);
    return () => clearInterval(interval);
  }, []);

  // Diagnostic logs streaming
  useEffect(() => {
    if (logIndex < BOOT_LOGS.length) {
      const delay = Math.random() * 200 + 80;
      const timeout = setTimeout(() => {
        setVisibleLogs((prev) => [...prev, BOOT_LOGS[logIndex]]);
        setLogIndex((prev) => prev + 1);
        if (!isMuted) {
          audio.playClick();
        }
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [logIndex, isMuted]);

  // Scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleLogs]);



  const handlePortalButton = () => {
    if (!isMuted) audio.playClick();
    document.cookie = "lifecycle_tenant_id=org_real_impl; path=/;";
    router.push("/security");
  };

  const handleSandboxButton = () => {
    if (!isMuted) audio.playClick();
    document.cookie = "lifecycle_tenant_id=org_demo_123; path=/;";
    router.push("/security?demo=true");
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audio.setMuted(nextMute);
    if (!nextMute) {
      audio.playClick();
    }
  };

  return (
    <main className="relative min-h-screen bg-[#000000] text-gray-300 font-sans overflow-hidden flex flex-col justify-between p-6 md:p-12 select-none">
      
      {/* WebGL Background Shader */}
      <SplashShader />

      {/* Grid overlay for technical scan aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10"></div>
      
      {/* Top Header */}
      <header className="relative z-20 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-white" />
          <span className="font-mono font-bold text-sm text-white tracking-widest">LIFECYCLEZERO</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMute}
            className="font-mono text-[9px] border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-zinc-500 hover:text-white cursor-pointer hover:border-zinc-700 transition-colors uppercase tracking-wider"
          >
            {isMuted ? "🔊 AUDIO OFF" : "🔊 AUDIO ON"}
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00FF41] rounded-full animate-ping"></span>
            <span className="w-2 h-2 bg-[#00FF41] rounded-full absolute"></span>
            <span className="font-mono text-[10px] text-[#00FF41] tracking-widest uppercase">SYSTEM SECURE</span>
          </div>
        </div>
      </header>

      {/* Main Content Area: Split layout on desktop */}
      <div className="relative z-20 flex-1 flex flex-col lg:flex-row justify-center items-center gap-12 max-w-6xl mx-auto w-full py-8">
        
        {/* Left Side: Typewriter and Core CTAs */}
        <div className="flex-1 flex flex-col justify-center items-center lg:items-start text-center lg:text-left">
          {/* Typewriter headline */}
          <h1 className="text-2xl md:text-4xl font-mono font-bold text-white tracking-tight leading-tight mb-4 min-h-[60px] lg:min-h-[90px]">
            {typedText}
            <span className="inline-block w-[3px] h-[24px] md:h-[36px] bg-[#00FF41] ml-2 animate-[ping_0.8s_infinite] align-middle"></span>
          </h1>

          {/* Status subtext */}
          <p className="font-mono text-[10px] md:text-xs text-zinc-500 tracking-wider mb-12 opacity-80 uppercase">
            &gt; INITIALIZING GLOBAL DEFENSE GRID. ENCRYPTED CONNECTION ESTABLISHED.
          </p>

          {/* Stats Cards */}
          <div className={`grid grid-cols-3 gap-4 w-full max-w-lg mb-12 transition-all duration-1000 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="p-4 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-none text-center lg:text-left">
              <div className="text-xl md:text-2xl font-mono font-bold text-white mb-1">45ms</div>
              <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest leading-normal">ISOLATION LATENCY</div>
            </div>
            
            <div className="p-4 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-none text-center lg:text-left shadow-[0_0_20px_rgba(255,49,49,0.02)]">
              <div className="text-xl md:text-2xl font-mono font-bold text-white mb-1">$670K</div>
              <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest leading-normal">BREACH SAVED</div>
            </div>

            <div className="p-4 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-none text-center lg:text-left">
              <div className="text-xl md:text-2xl font-mono font-bold text-white mb-1">100%</div>
              <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest leading-normal">AI COMPLIANCE</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`flex flex-col sm:flex-row gap-4 w-full max-w-lg transition-all duration-1000 delay-500 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button 
              onClick={handlePortalButton}
              onMouseEnter={() => !isMuted && audio.playClick()}
              className="flex-1 px-5 py-3 border border-zinc-700 bg-transparent text-zinc-300 hover:text-white hover:border-white font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-pointer text-center"
            >
              &gt; ENTERPRISE PORTAL
            </button>
            <button 
              onClick={handleSandboxButton}
              onMouseEnter={() => !isMuted && audio.playClick()}
              className="flex-1 px-5 py-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-widest border border-white hover:bg-zinc-200 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.15)] cursor-pointer text-center animate-pulse"
            >
              &gt; LAUNCH SANDBOX DEMO
            </button>
          </div>
        </div>

        {/* Right Side: Active Boot Log Terminal */}
        <div className="w-full lg:w-96 h-64 lg:h-80 bg-[#050505]/80 border border-zinc-800 p-4 font-mono text-[9px] flex flex-col justify-between relative shadow-[0_0_30px_rgba(0,255,65,0.02)] rounded-none">
          <div className="absolute top-2 right-4 flex items-center gap-1.5 text-zinc-600">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse"></span>
            <span>LOG_STREAM</span>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1.5 max-h-[190px] lg:max-h-[250px] pr-2">
            {visibleLogs.map((log, index) => {
              const isLast = index === visibleLogs.length - 1;
              return (
                <div key={index} className="flex gap-2 items-start text-zinc-400">
                  <span className="text-[#00FF41]/40 select-none">[{index < 10 ? `0${index}` : index}]</span>
                  <span className={isLast ? "text-[#00FF41] font-bold" : ""}>
                    {log}
                  </span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
          
          <div className="border-t border-zinc-900 pt-2.5 flex justify-between items-center text-[8px] text-zinc-600 select-none">
            <span>SECURE HOST LINK</span>
            <span>DIAGNOSTICS: RUNNING</span>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <footer className="relative z-20 w-full flex flex-col gap-4 border-t border-[#262626]/80 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500 font-mono text-[9px] tracking-wider uppercase">
          
          {/* Tech list */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <span className="text-zinc-600">POWERED BY ZERO-TRUST INFRASTRUCTURE:</span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Database className="w-3.5 h-3.5" /> AWS DYNAMODB
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <MessageSquare className="w-3.5 h-3.5" /> AWS SQS
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Triangle className="w-3.5 h-3.5 rotate-180" /> VERCEL v0
            </span>
          </div>

          <div className="flex items-center gap-6 text-center">
            <span>© 2026 LIFECYCLEZERO SECURITY OPERATIONS CENTER</span>
            <span className="hidden md:inline text-zinc-600">|</span>
            <a href="/privacy" className="hover:text-white transition-all underline underline-offset-4">PRIVACY POLICY</a>
            <span className="hidden md:inline text-zinc-600">|</span>
            <span className="hidden md:inline">Protocol: V9</span>
            <span className="hidden md:inline">Kernel: Stable</span>
          </div>

        </div>
      </footer>

    </main>
  );
}

