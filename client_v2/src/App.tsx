import React, { useEffect } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

// Router
import AppRouter from '@/router'

// Components
import ErrorFallback from '@/components/ui/ErrorFallback'

// Store
import { useAuthStore } from '@/store/auth.store'

// Utils
import { config } from '@/utils'

const App: React.FC = () => {
  const { tokens, clearAuth, checkAuth } = useAuthStore()
  
  // Initialize auth tokens on app start
  useEffect(() => {
    // Initialize tokens and check auth if we have persisted tokens
    if (tokens?.accessToken && tokens?.refreshToken) {
      import('@/services/api/client').then(({ setTokens }) => {
        setTokens(tokens.accessToken, tokens.refreshToken)
        // Verify token is still valid
        checkAuth()
      })
    }
  }, []) // Empty dependency array - run only once on mount

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error: Error, errorInfo: any) => {
        // Log errors in development
        if (config && config.app && config.app.environment === 'development') {
          console.error('Application Error:', error)
          console.error('Error Info:', errorInfo)
        }
        
        // In production, you could send errors to a logging service
        // logErrorToService(error, errorInfo)
      }}
    >
      <div className='c-app c-default-layout'>
        <AppRouter />
      </div>
    </ErrorBoundary>
  )
}

export default App