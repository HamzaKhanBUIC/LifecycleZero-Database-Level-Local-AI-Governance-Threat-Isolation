"use client";

import { Shield, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("judge_tester@lifecyclezero.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isClerkEnabled = process.env.NEXT_PUBLIC_SKIP_CLERK !== "true" && 
                         !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
                         process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_");

  const handleMockLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      router.push("/security?demo=true");
    }, 1500);
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-black flex flex-col justify-center items-center font-mono text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
        <span>INITIALIZING COMPLIANCE HANDSHAKE...</span>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-black text-gray-300 font-mono flex flex-col justify-center items-center p-6 select-none">
      {/* Background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-10"></div>
      
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>

      <div className="relative z-20 flex flex-col items-center gap-6 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-white" />
          <span className="font-bold text-lg text-white tracking-widest">LIFECYCLEZERO</span>
        </div>

        {/* Card */}
        <div className="w-full border border-zinc-800 bg-[#050505]/95 p-6 rounded-sm shadow-[0_0_50px_rgba(99,102,241,0.02)]">
          {isClerkEnabled ? (
            <SignIn 
              routing="path" 
              path="/sign-in" 
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
              appearance={{
                variables: {
                  colorPrimary: '#ffffff',
                  colorBackground: '#050505',
                  colorInputBackground: '#0a0a0a',
                  colorInputText: '#d4d4d8',
                  colorTextOnPrimaryBackground: '#000000',
                  colorTextSecondary: '#71717a',
                  colorText: '#ffffff',
                  fontFamily: 'monospace'
                },
                elements: {
                  cardBox: 'shadow-none border-none bg-transparent',
                  card: 'bg-transparent shadow-none border-none p-0',
                  headerTitle: 'text-white font-bold font-mono tracking-tight text-lg uppercase',
                  headerSubtitle: 'text-zinc-500 font-mono text-xs uppercase',
                  socialButtonsBlockButton: 'bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 rounded-sm font-mono text-xs uppercase',
                  socialButtonsBlockButtonText: 'text-zinc-300 font-bold',
                  formButtonPrimary: 'bg-white hover:bg-zinc-200 text-black font-bold font-mono text-xs rounded-sm uppercase tracking-wider py-2.5',
                  formFieldInput: 'bg-zinc-950 border border-zinc-850 focus:border-zinc-500 rounded-sm text-zinc-300 font-mono py-2 text-xs',
                  formFieldLabel: 'text-zinc-400 font-mono text-[9px] uppercase tracking-wider font-bold mb-1',
                  footerActionText: 'text-zinc-500 font-mono text-xs uppercase',
                  footerActionLink: 'text-white hover:text-zinc-300 font-mono text-xs font-bold uppercase underline-offset-4',
                  dividerText: 'text-zinc-600 font-mono text-[10px] uppercase',
                  dividerLine: 'bg-zinc-900',
                  formResendCodeLink: 'text-white hover:text-zinc-300 font-mono text-xs font-bold uppercase'
                }
              }}
            />
          ) : (
            <form onSubmit={handleMockLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs text-yellow-500 font-bold tracking-wider uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sandbox Auth Active</span>
                </div>
                <h1 className="text-white text-base font-bold uppercase tracking-tight">Access Enterprise Console</h1>
                <p className="text-zinc-500 text-[10px] uppercase leading-relaxed">
                  Real authentication is bypassed on this deployment. Use the pre-filled credentials to launch client-side simulation frames.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-[9px] uppercase tracking-wider font-bold">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-950 border border-zinc-850 focus:border-zinc-500 rounded-sm text-zinc-300 font-mono p-2.5 text-xs outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-[9px] uppercase tracking-wider font-bold">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-950 border border-zinc-855 focus:border-zinc-500 rounded-sm text-zinc-300 font-mono p-2.5 text-xs outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-white hover:bg-zinc-200 text-black font-bold text-xs py-3 rounded-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span>Log In to Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="text-center mt-3 pt-3 border-t border-zinc-900">
                <span className="text-zinc-500 text-[10px] uppercase">
                  Don't have an account?{" "}
                  <Link href="/sign-up" className="text-white hover:underline underline-offset-4 font-bold">
                    Sign Up
                  </Link>
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
