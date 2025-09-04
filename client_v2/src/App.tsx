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
    // TEMPORARY FIX: Clear old tokens due to JWT secret key change
    // Remove this after users have logged in again
    const shouldClearOldTokens = !sessionStorage.getItem('jwt_keys_fixed_v2')
    if (shouldClearOldTokens) {
      console.log('Clearing old JWT tokens due to server key change')
      clearAuth()
      sessionStorage.setItem('jwt_keys_fixed_v2', 'true')
      return
    }
    
    // Initialize tokens and check auth if we have persisted tokens
    if (tokens?.accessToken && tokens?.refreshToken) {
      import('@/services/api/client').then(({ setTokens }) => {
        setTokens(tokens.accessToken, tokens.refreshToken)
        // Verify token is still valid
        checkAuth()
      })
    }
  }, [tokens, clearAuth, checkAuth])

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error: Error, errorInfo: any) => {
        // Log errors in development
        if (config.app.environment === 'development') {
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