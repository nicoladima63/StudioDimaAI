import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CSpinner } from '@coreui/react'

// Layout components
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

// Lazy load components per performance
const Dashboard = React.lazy(() => import('@/features/dashboard/pages/Dashboard'))
const LoginPage = React.lazy(() => import('@/features/auth/pages/LoginPage'))
const MaterialiPage = React.lazy(() => import('@/features/materiali/pages/MaterialiPage'))
const FornitoriPage = React.lazy(() => import('@/features/fornitori/pages/FornitoriPage'))
const PazientiPage = React.lazy(() => import('@/features/pazienti/pages/PazientiPage'))
const RicettaElettronicaPage = React.lazy(() => import('@/features/ricetta-elettronica/pages/RicettaElettronicaPage'))
const CalendarPage=React.lazy(()=>import('@/features/calendar/pages/CalendarPage'))
const ContiPage=React.lazy(()=>import('@/features/conti/pages/ContiPage'))

const NotFoundPage = React.lazy(() => import('@/components/ui/NotFoundPage'))

//test page
const TestSelectPage = React.lazy(() => import('@/features/test/TestSelectPage'))
const RicettaTestPage = React.lazy(() => import('@/features/ricetta-elettronica/pages/RNETestPage'))

//settings page
const SettingCalendarPage=React.lazy(()=>import ('@/features/settings/pages/CalendarSettings'))
const SEttingTemplatesPage=React.lazy(()=>import ('@/features/settings/pages/TemplatesPage'))

// Loading fallback component
const LoadingFallback = () => (
  <div className='d-flex justify-content-center align-items-center' style={{ height: '200px' }}>
    <CSpinner color='primary' />
  </div>
)

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path='/login' element={<LoginPage />} />
        
        {/* Protected routes with layout */}
        <Route
          path='/'
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route index element={<Navigate to='/dashboard' replace />} />
          <Route path='dashboard' element={<Dashboard />} />
          
          {/* Feature routes */}
          <Route path='materiali' element={<MaterialiPage />} />
          <Route path='fornitori' element={<FornitoriPage />} />
          <Route path='pazienti' element={<PazientiPage />} />
          <Route path='conti' element={<ContiPage/>} />
          <Route path='ricetta' element={<RicettaElettronicaPage />} />
          <Route path='calendar' element={<CalendarPage />} />
          {/* Pagina di test per le select */}
          <Route path='test' element={<TestSelectPage />} />
          <Route path='ricetta/test' element={<RicettaTestPage />} />

          {/* Pagine di settings */}
          <Route path='settings/calendar' element={<SettingCalendarPage />} />
          <Route path='settings/template' element={<SEttingTemplatesPage />} />
          {/* Catch-all for 404 */}
          {/* Future feature routes will be added here */}
          {/* 
          <Route path='fornitori/*' element={<FornitoriRoutes />} />
          <Route path='materiali/*' element={<MaterialiRoutes />} />
          <Route path='statistiche/*' element={<StatisticheRoutes />} />
          */}
        </Route>
        
        {/* 404 route */}
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter