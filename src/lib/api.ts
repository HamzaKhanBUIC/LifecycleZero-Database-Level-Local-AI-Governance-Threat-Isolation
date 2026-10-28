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
  upgradeTenantPlanAction,
  ingestSandboxTelemetryAction
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
   * Streams a simulated threat telemetry event (sandbox only). The browser never holds an
   * agent key: the server action forwards it to /api/ingest with the server-side AGENT_API_KEY.
   */
  static async ingestTelemetry(payload: any): Promise<{ ok: boolean; status: number; data: any }> {
    return ingestSandboxTelemetryAction(payload);
  }
}
