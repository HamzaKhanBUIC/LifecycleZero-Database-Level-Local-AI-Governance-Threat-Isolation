import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const skipClerk = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";
  let userId: string | null = "user_mock_admin";
  let orgId: string | null = "org_demo_123";

  // Only call Clerk auth when Clerk is active and a valid key exists
  if (!skipClerk && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_")) {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    userId = authResult.userId || null;
    orgId = authResult.orgId || null;
  }

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#262626] bg-[#050505] flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            LifecycleZero
          </span>
        </div>

        {/* Org Display */}
        <div className="mb-6 pb-6 border-b border-[#262626]">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Organization</p>
          <div className="w-full bg-[#0a0a0a] border border-[#262626] text-zinc-300 px-3 py-2 rounded-lg font-mono text-xs flex justify-between items-center select-none">
            <span>Demo Org (org_demo_123)</span>
            <span className="text-[10px] text-zinc-500 font-semibold">[LIVE]</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-3 mb-2">Workspace</p>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#131313] transition"
          >
            📊 Overview
          </Link>
          <Link
            href="/dashboard/assets"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#131313] transition"
          >
            💻 Hardware Fleet
          </Link>
          <Link
            href="/dashboard/procurement"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#131313] transition"
          >
            🛒 Procurement Queue
          </Link>
          <div className="pt-4 mt-4 border-t border-[#262626]">
            <Link
              href="/security"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20 transition border border-dashed border-red-900/50"
            >
              🛡️ AI Threat Console
            </Link>
          </div>
        </nav>

        {/* User profile section */}
        <div className="pt-6 border-t border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#0a0a0a] border border-[#262626] flex items-center justify-center text-[10px] font-mono text-zinc-400 select-none">
              ADM
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-zinc-200">Management Panel</p>
              <p className="text-[10px] text-zinc-500">B2B Admin Role</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto bg-black/40 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
