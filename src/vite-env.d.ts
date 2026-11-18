/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Build-time API origin. The runtime config.js value takes precedence. */
  readonly VITE_API_BASE_URL?: string
}

interface JauntRuntimeConfig {
  /** Absolute API origin (or origin + path prefix). Empty means same-origin. */
  apiBaseUrl?: string
}

interface Window {
  __JAUNT_CONFIG__?: JauntRuntimeConfig
}
