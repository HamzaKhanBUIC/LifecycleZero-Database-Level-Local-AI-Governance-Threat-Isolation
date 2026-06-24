import { SignedIn, SignedOut, SignIn } from "@clerk/nextjs";
import Dashboard from "../components/Dashboard";
import { getAssets, getCrossAssetAlerts } from "./actions/telemetry";

export default async function Home() {
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
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black grid-bg">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <Dashboard initialAssets={initialAssets} initialAlerts={initialAlerts} />
      </SignedIn>
    </main>
  );
}
