import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'

// Router
import AppRouter from '@/router'

// Components
import ErrorFallback from '@/components/ui/ErrorFallback'

// Utils
import { config } from '@/utils'

const App: React.FC = () => {
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