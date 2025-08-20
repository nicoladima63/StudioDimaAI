/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_V2_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  readonly VITE_ENVIRONMENT: 'development' | 'production' | 'test'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __DEV__: boolean