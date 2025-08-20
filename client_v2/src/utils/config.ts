// Configuration utilities per Studio Dima V2

export const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_V2_URL || 'http://localhost:5001/api/v2',
    timeout: 30000,
    retries: 3,
  },
  app: {
    title: import.meta.env.VITE_APP_TITLE || 'Studio Dima V2',
    version: import.meta.env.VITE_APP_VERSION || '2.0.0',
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  },
  cache: {
    duration: 5 * 60 * 1000, // 5 minuti
    maxRetries: 3,
  },
  ui: {
    toastDuration: 4000,
    debounceDelay: 300,
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
      sizes: [10, 20, 50, 100],
    },
  },
} as const

export const isDevelopment = config.app.environment === 'development'
export const isProduction = config.app.environment === 'production'
export const isTest = config.app.environment === 'test'

export default config