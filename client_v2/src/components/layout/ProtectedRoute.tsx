import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CSpinner } from '@coreui/react'

import { useAuthStore } from '@/store/auth.store'

interface Props {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const location = useLocation()
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore()

  useEffect(() => {
    // Check auth on mount if we have tokens but no user
    if (!user && !isLoading) {
      checkAuth()
    }
  }, [user, isLoading, checkAuth])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className='d-flex justify-content-center align-items-center min-vh-100'>
        <CSpinner color='primary' />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to='/login' state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute