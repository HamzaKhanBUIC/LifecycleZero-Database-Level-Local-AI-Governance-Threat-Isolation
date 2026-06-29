import { 
  getAssets, 
  getCrossAssetAlerts, 
  isolateAsset, 
  restoreAsset, 
  bulkIsolateAssets, 
  simulateSilentHost, 
  updateAssetStatusAction, 
  createRequestAction, 
  resolveRequestAction, 
  seedActiveTenantAction,
  registerAssetAction,
  getTenantOllamaConfigAction,
  updateTenantOllamaConfigAction,
  getTenantTelemetryAction,
  getTenantMetadataAction,
  upgradeTenantPlanAction
} from "@/app/actions/api";

export { 
  getAssets, 
  getCrossAssetAlerts, 
  isolateAsset, 
  restoreAsset, 
  bulkIsolateAssets, 
  simulateSilentHost, 
  updateAssetStatusAction, 
  createRequestAction, 
  resolveRequestAction, 
  seedActiveTenantAction, 
  registerAssetAction,
  getTenantOllamaConfigAction,
  updateTenantOllamaConfigAction,
  getTenantTelemetryAction,
  getTenantMetadataAction,
  upgradeTenantPlanAction
};

/**
 * Unified API class exposing all system operational functions
 */
export class LifecycleZeroAPI {
  static getAssets = getAssets;
  static getCrossAssetAlerts = getCrossAssetAlerts;
  static isolateAsset = isolateAsset;
  static bulkIsolateAssets = bulkIsolateAssets;
  static restoreAsset = restoreAsset;
  static simulateSilentHost = simulateSilentHost;
  static updateAssetStatusAction = updateAssetStatusAction;
  static createRequestAction = createRequestAction;
  static resolveRequestAction = resolveRequestAction;
  static seedActiveTenantAction = seedActiveTenantAction;
  static registerAssetAction = registerAssetAction;
  static getTenantOllamaConfigAction = getTenantOllamaConfigAction;
  static updateTenantOllamaConfigAction = updateTenantOllamaConfigAction;
  static getTenantTelemetryAction = getTenantTelemetryAction;
  static getTenantMetadataAction = getTenantMetadataAction;
  static upgradeTenantPlanAction = upgradeTenantPlanAction;

  /**
   * Performs client-side REST call to check local on-premises Ollama connectivity
   */
  static async testOllamaConnection(endpoint: string): Promise<any> {
    const cleanedHost = endpoint.replace(/\/$/, "");
    const tagsRes = await fetch(`${cleanedHost}/api/tags`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (!tagsRes.ok) {
      throw new Error(`Endpoint returned status ${tagsRes.status}`);
    }
    return tagsRes.json();
  }

  /**
   * Performs client-side REST call to stream threat telemetry injection to Edge
   */
  static async ingestTelemetry(payload: any): Promise<{ ok: boolean; status: number; data: any }> {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "X-Agent-Key": "demo_agent_key_99" 
      },
      body: JSON.stringify(payload)
    });
    const resData = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      data: resData
    };
  }
}
