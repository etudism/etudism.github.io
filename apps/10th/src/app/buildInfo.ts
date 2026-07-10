export interface BuildInfo {
  buildSha: string;
  buildTime: string;
  appVersion: string;
  defaultModel: string;
  performancePipeline: string;
}

export const BUILD_INFO: Readonly<BuildInfo> = Object.freeze({
  buildSha: __BUILD_SHA__,
  buildTime: __BUILD_TIME__,
  appVersion: __APP_VERSION__,
  defaultModel: __DEFAULT_MODEL__,
  performancePipeline: __PERFORMANCE_PIPELINE__,
});
