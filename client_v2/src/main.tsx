import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// CoreUI CSS
import '@coreui/coreui/dist/css/coreui.min.css'
import '@coreui/icons/css/free.min.css'

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

// Disable console.log in production
if (config.app.environment === 'production') {
  console.log = () => {}
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position='top-right'
          toastOptions={{
            duration: config.ui.toastDuration,
            style: {
              borderRadius: '8px',
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10b981',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)