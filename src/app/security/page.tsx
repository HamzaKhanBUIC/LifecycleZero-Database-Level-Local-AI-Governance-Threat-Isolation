import Dashboard from "../../components/Dashboard";
import { getAssets, getCrossAssetAlerts } from "@/lib/api";

export default async function SecurityPage() {
  const TENANT_ID = "org_demo_123";
  
  // Pre-fetch data on the server for instant page load and zero client-side layout shift
  let initialAssets: any[] = [];
  let initialAlerts: any[] = [];
  try {
    const [assets, alerts] = await Promise.all([
      getAssets(TENANT_ID),
      getCrossAssetAlerts(TENANT_ID)
    ]);
    initialAssets = assets;
    initialAlerts = alerts;
  } catch (e) {
    console.error("Failed to pre-fetch server data:", e);
  }

  return (
    <main className="min-h-screen bg-[#09090b]">
      <Dashboard initialAssets={initialAssets} initialAlerts={initialAlerts} />
    </main>
  );
}
