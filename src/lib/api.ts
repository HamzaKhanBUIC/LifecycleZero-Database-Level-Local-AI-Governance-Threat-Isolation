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
}
