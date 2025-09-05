import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CSpinner } from '@coreui/react'

import { useAuthStore } from '@/store/auth.store'
import { setTokens } from '@/services/api/client'

interface Props {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const location = useLocation()
  const { isAuthenticated, isLoading, user, tokens, checkAuth } = useAuthStore()

  useEffect(() => {
    // Initialize tokens in API client from persisted auth store
    if (tokens?.accessToken && tokens?.refreshToken) {
      setTokens(tokens.accessToken, tokens.refreshToken)
    }
    
    // Check auth on mount if we have tokens but no user
    if (!user && !isLoading && tokens?.accessToken) {
      checkAuth()
    }
  }, []) // Empty dependency array - run only once on mount

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className='d-flex justify-content-center align-items-center min-vh-100'>
        <CSpinner color='primary' />
      </div>
    )
  }

  // Redirect to login only if no tokens at all (not authenticated)
  if (!isAuthenticated && !tokens?.accessToken) {
    return <Navigate to='/login' state={{ from: location }} replace />
  }
  
  // If we have tokens but no user yet, we're still loading (checkAuth in progress)
  if (tokens?.accessToken && !user && !isLoading) {
    return (
      <div className='d-flex justify-content-center align-items-center min-vh-100'>
        <CSpinner color='primary' />
      </div>
    )
  }

  return <>{children}</>
}

export default ProtectedRoute