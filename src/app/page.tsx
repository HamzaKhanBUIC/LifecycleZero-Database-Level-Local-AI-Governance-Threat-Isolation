"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SplashShader from "@/components/SplashShader";
import { Database, MessageSquare, Triangle, Shield } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const fullText = "Zero Trust. Zero Delays. Zero Rogue Agents.";
  const [typedText, setTypedText] = useState("");
  const [showStats, setShowStats] = useState(false);

  // Typewriter effect
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index + 1));
      index++;
      if (index >= fullText.length) {
        clearInterval(interval);
        // Show cards after text finishes typing
        setTimeout(() => setShowStats(true), 300);
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  // 4.5s auto-redirect
  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push("/security");
    }, 4800);
    return () => clearTimeout(timeout);
  }, [router]);

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
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#00FF41] rounded-full animate-ping"></span>
          <span className="w-2 h-2 bg-[#00FF41] rounded-full absolute"></span>
          <span className="font-mono text-[10px] text-[#00FF41] tracking-widest uppercase">SYSTEM SECURE</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-20 flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto w-full text-center">
        
        {/* Typewriter headline */}
        <h1 className="text-3xl md:text-5xl font-mono font-bold text-white tracking-tight leading-tight mb-4 min-h-[60px]">
          {typedText}
          <span className="inline-block w-[3px] h-[30px] md:h-[45px] bg-[#00FF41] ml-2 animate-[ping_0.8s_infinite] align-middle"></span>
        </h1>

        {/* Status subtext */}
        <p className="font-mono text-[10px] md:text-xs text-zinc-500 tracking-wider mb-12 opacity-80 uppercase">
          &gt; INITIALIZING GLOBAL DEFENSE GRID. ENCRYPTED CONNECTION ESTABLISHED.
        </p>

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl mb-12 transition-all duration-1000 ${showStats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="p-6 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-sm text-center">
            <div className="text-3xl md:text-4xl font-mono font-bold text-white mb-2">45ms</div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">THREAT ISOLATION LATENCY</div>
          </div>
          
          <div className="p-6 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-sm text-center shadow-[0_0_20px_rgba(255,49,49,0.02)]">
            <div className="text-3xl md:text-4xl font-mono font-bold text-white mb-2">$670K</div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">AVG BREACH PREMIUM SAVED</div>
          </div>

          <div className="p-6 bg-[#0a0a0a]/60 border border-[#262626] backdrop-blur-md rounded-sm text-center">
            <div className="text-3xl md:text-4xl font-mono font-bold text-white mb-2">100%</div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">EU AI ACT COMPLIANCE</div>
          </div>
        </div>

        {/* Action Button */}
        <div className={`transition-all duration-1000 delay-500 ${showStats ? 'opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={() => router.push("/security")}
            className="px-8 py-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-widest border border-white hover:bg-transparent hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.15)] cursor-pointer"
          >
            &gt; INITIALIZE SOC TERMINAL
          </button>
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

          {/* Legal / version info */}
          <div className="flex items-center gap-6 text-center">
            <span>© 2026 LIFECYCLEZERO SECURITY OPERATIONS CENTER</span>
            <span className="hidden md:inline text-zinc-600">|</span>
            <span className="hidden md:inline">Protocol: V9</span>
            <span className="hidden md:inline">Kernel: Stable</span>
          </div>

        </div>
      </footer>

    </main>
  );
}
