import { SignUp } from "@clerk/nextjs";
import { Shield } from "lucide-react";

export default function SignUpPage() {
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
        <div className="w-full border border-zinc-800 bg-[#050505]/95 p-1 rounded-sm shadow-[0_0_30px_rgba(99,102,241,0.01)]">
          <SignUp 
            routing="path" 
            path="/sign-up" 
            signInUrl="/sign-in"
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
                card: 'bg-transparent shadow-none border-none p-4',
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
        </div>
      </div>
    </main>
  );
}
