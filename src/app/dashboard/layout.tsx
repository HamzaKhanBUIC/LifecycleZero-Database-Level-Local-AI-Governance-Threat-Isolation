import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Laptop, ShoppingCart, ShieldAlert, Shield } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { getTenantContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const skipClerk = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !skipClerk && publishableKey && publishableKey.startsWith("pk_");
  let userId: string | null = "user_mock_admin";
  let tenantId = "org_demo_123";

  try {
    const context = await getTenantContext();
    tenantId = context.tenantId;
    userId = context.userId || (skipClerk ? "user_mock_admin" : null);
  } catch (err) {
    console.warn("Failed to retrieve tenant context in layout:", err);
  }

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-mono">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1f1f1f] bg-[#050505] flex flex-col p-6 shrink-0 select-none">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-6 w-6 text-white shrink-0" />
          <span className="font-bold text-base tracking-widest text-white uppercase">
            LifecycleZero
          </span>
        </div>

        {/* Org Display */}
        <div className="mb-6 pb-6 border-b border-zinc-900">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Organization</p>
          <div className="w-full bg-[#0a0a0a] border border-zinc-900 text-zinc-400 px-3 py-2 rounded font-mono text-xs flex justify-between items-center">
            <span>{tenantId}</span>
            <span className="text-[10px] text-green-500 font-semibold">[LIVE]</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold px-3 mb-2">Workspace</p>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition border border-transparent hover:border-zinc-800"
          >
            <LayoutDashboard className="h-4 w-4" />
            OVERVIEW
          </Link>
          <Link
            href="/dashboard/assets"
            className="flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition border border-transparent hover:border-zinc-800"
          >
            <Laptop className="h-4 w-4" />
            HARDWARE FLEET
          </Link>
          <Link
            href="/dashboard/procurement"
            className="flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition border border-transparent hover:border-zinc-800"
          >
            <ShoppingCart className="h-4 w-4" />
            PROCUREMENT QUEUE
          </Link>
          <div className="pt-4 mt-4 border-t border-zinc-900">
            <Link
              href="/security"
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-bold text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 transition border border-dashed border-rose-900/40"
            >
              <ShieldAlert className="h-4 w-4" />
              AI THREAT CONSOLE
            </Link>
          </div>
        </nav>

        {/* User profile section */}
        <div className="pt-6 border-t border-zinc-900 flex items-center justify-between">
          {hasClerk ? (
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                <UserButton afterSignOutUrl="/" appearance={{
                  variables: {
                    colorPrimary: '#ffffff',
                    colorBackground: '#050505',
                    colorText: '#ffffff'
                  }
                }} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-200 truncate">Active User</p>
                <p className="text-[10px] text-zinc-500 font-semibold uppercase">Enterprise B2B</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#0a0a0a] border border-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                ADM
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-200">Management Panel</p>
                <p className="text-[10px] text-zinc-500 font-semibold">B2B Admin Role</p>
              </div>
            </div>
          )}
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
