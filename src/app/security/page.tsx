import Dashboard from "../../components/Dashboard";
import { getAssets, getCrossAssetAlerts } from "@/lib/api";
import { getTenantContext } from "@/lib/auth";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const resolvedParams = await searchParams;
  const isDemoMode = resolvedParams.demo === "true";
  
  let tenantId = "org_demo_123";
  if (!isDemoMode) {
    try {
      const context = await getTenantContext();
      if (context.tenantId) {
        tenantId = context.tenantId;
      }
    } catch (err) {
      console.warn("Failed to get tenant context, falling back to org_demo_123:", err);
    }
  }
  
  // Pre-fetch data on the server for instant page load and zero client-side layout shift
  let initialAssets: any[] = [];
  let initialAlerts: any[] = [];
  try {
    const [assets, alerts] = await Promise.all([
      getAssets(tenantId),
      getCrossAssetAlerts(tenantId)
    ]);
    initialAssets = assets;
    initialAlerts = alerts;
  } catch (e) {
    console.error("Failed to pre-fetch server data:", e);
  }

  return (
    <main className="min-h-screen bg-[#09090b]">
      <Dashboard initialAssets={initialAssets} initialAlerts={initialAlerts} tenantId={tenantId} isForcedDemo={isDemoMode} />
    </main>
  );
}
