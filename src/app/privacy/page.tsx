import Link from "next/link";
import { Shield, ArrowLeft, Lock, Database, EyeOff } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen bg-black text-gray-300 font-mono p-8 select-none">
      {/* Scanline / Grid Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-10"></div>
      
      {/* Neon Glow backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-20 space-y-12 py-12">
        
        {/* Navigation / Header */}
        <header className="flex justify-between items-center border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-lg text-white tracking-widest uppercase">LIFECYCLEZERO</span>
          </div>
          <Link 
            href="/" 
            className="flex items-center gap-2 border border-zinc-800 hover:border-white px-4 py-2 text-xs text-zinc-400 hover:text-white uppercase transition-all duration-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Terminal
          </Link>
        </header>

        {/* Title */}
        <section className="space-y-4">
          <div className="inline-block border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 uppercase tracking-wider">
            Protocol: Privacy & Data Custody
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Privacy & Data Governance Policy</h1>
          <p className="text-zinc-500 text-xs uppercase">Last Updated: June 28, 2026 | Revision: 1.0.4</p>
        </section>

        {/* Core Pillars Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-zinc-850 bg-[#050505]/90 p-5 space-y-3">
            <EyeOff className="w-8 h-8 text-emerald-400" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">Local Threats, Local Inference</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed uppercase">
              No files, prompt text, or workspace contexts are ever sent to external cloud AI engines. Threat analysis runs strictly offline using our managed local Ollama infrastructure.
            </p>
          </div>
          
          <div className="border border-zinc-850 bg-[#050505]/90 p-5 space-y-3">
            <Lock className="w-8 h-8 text-emerald-400" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">HMAC-SHA256 Signing</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed uppercase">
              Every packet is cryptographically signed at the agent level using SHA256 hashes. Spoofing device telemetry or impersonating corporate hardware tokens is blocked at the gateway level.
            </p>
          </div>

          <div className="border border-zinc-850 bg-[#050505]/90 p-5 space-y-3">
            <Database className="w-8 h-8 text-emerald-400" />
            <h3 className="text-white text-xs font-bold uppercase tracking-wider">DynamoDB Encrypted Storage</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed uppercase">
              Compliance-oriented telemetry storage utilizing AWS KMS encryption-at-rest. Automatic data pruning removes all telemetry items within 90 days via Time-to-Live (TTL).
            </p>
          </div>
        </section>

        {/* Technical Deep Dive Details */}
        <section className="space-y-8 border-t border-zinc-850 pt-10 text-xs">
          
          <div className="space-y-3">
            <h2 className="text-white font-bold uppercase tracking-wider">1. Scope & Telemetry Collection</h2>
            <p className="text-zinc-400 leading-relaxed uppercase">
              The LifecycleZero lightweight workstation agent monitors system-level telemetry. This telemetry strictly includes hardware configuration, active process names (e.g., `ollama.exe`), and access actions for sensitive directories. File contents, code snippets, or user prompt histories are never monitored, read, or stored.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-bold uppercase tracking-wider">2. Zero-Trust Access Isolation</h2>
            <p className="text-zinc-400 leading-relaxed uppercase">
              Admin-initiated containment actions (Device Isolation) execute using DynamoDB atomic `TransactWriteItems` operations. This ensures an absolute state lock and generates an immutable audit custody trail for SOC 2 Type II, ISO 27001, and NIST compliance audits.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-bold uppercase tracking-wider">3. Third-Party Disclosures</h2>
            <p className="text-zinc-400 leading-relaxed uppercase">
              We enforce a strict zero-disclosure policy. No telemetry data, usage metrics, or endpoint reports are shared, sold, or distributed. Since we do not route requests to external cloud model providers (such as OpenAI or AWS Bedrock endpoints), your proprietary information remains inside our private compliance boundary.
            </p>
          </div>

        </section>

        {/* Footer info */}
        <footer className="border-t border-zinc-850 pt-8 flex justify-between items-center text-[10px] text-zinc-500">
          <span>© 2026 LIFECYCLEZERO SOC</span>
          <span>COMPLIANCE STATUS: SECURED</span>
        </footer>

      </div>
    </main>
  );
}
