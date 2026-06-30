import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// CoreUI CSS — mantenuto per le pagine non ancora migrate a Tailwind
import '@coreui/coreui/dist/css/coreui.min.css'

// App imports
import App from './App'
import { config } from '@/utils'

// Styles
import './styles/index.css'

// Create QueryClient with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: config.cache.duration,
      retry: config.cache.maxRetries,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

if (config.app.environment === 'production') {
  console.log = () => {}
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope)
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
  })
}

// Applica il tema prima del render per evitare flash
const _savedTheme = localStorage.getItem('studio-dima-theme')
const _initTheme = _savedTheme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
if (_initTheme === 'dark') {
  document.documentElement.classList.add('dark')
}
document.documentElement.setAttribute('data-bs-theme', _initTheme)
document.documentElement.setAttribute('data-coreui-theme', _initTheme)

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: config.ui.toastDuration,
            style: {
              borderRadius: '8px',
              background: '#363636',
              color: '#fff',
              fontSize: '14px',
            },
            success: {
              style: { background: '#10b981' },
            },
            error: {
              style: { background: '#ef4444' },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
