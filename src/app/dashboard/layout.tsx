import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950 flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            LifecycleZero
          </span>
        </div>

        {/* Clerk Org Switcher */}
        <div className="mb-6 pb-6 border-b border-zinc-900">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Organization</p>
          <OrganizationSwitcher 
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-between bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800 px-3 py-2 rounded-lg font-medium",
                organizationPreviewTextContainer: "text-zinc-100",
                organizationSwitcherTriggerIcon: "text-zinc-400"
              }
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-3 mb-2">Workspace</p>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          >
            📊 Overview
          </Link>
          <Link
            href="/dashboard/assets"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          >
            💻 Hardware Fleet
          </Link>
          <Link
            href="/dashboard/procurement"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          >
            🛒 Procurement Queue
          </Link>
        </nav>

        {/* User profile section */}
        <div className="pt-6 border-t border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="text-left">
              <p className="text-xs font-semibold text-zinc-200">Management Panel</p>
              <p className="text-[10px] text-zinc-500">B2B Admin Role</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!orgId ? (
          // UX Gate if they haven't selected or created an organization
          <main className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
            <div className="max-w-md p-8 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl">
                🏢
              </div>
              <h2 className="text-xl font-bold text-white mt-4">Select an Organization</h2>
              <p className="text-sm text-zinc-400 mt-2 mb-6 leading-relaxed">
                LifecycleZero manages physical assets scoped strictly to organizations. Please select or create an organization to proceed.
              </p>
              <OrganizationSwitcher 
                hidePersonal={true}
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    organizationSwitcherTrigger: "w-full justify-between bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/20",
                    organizationPreviewTextContainer: "text-white",
                    organizationSwitcherTriggerIcon: "text-white"
                  }
                }}
              />
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto bg-zinc-950/20 relative z-10">
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
