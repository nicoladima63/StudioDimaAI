import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CSpinner } from '@coreui/react'

// Layout components
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

// Lazy load components per performance
const Dashboard = React.lazy(() => import('@/features/dashboard/pages/Dashboard'))
const LoginPage = React.lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = React.lazy(() => import('@/features/auth/pages/RegisterPage'))
const MaterialiPage = React.lazy(() => import('@/features/materiali/pages/MaterialiPage'))
const MaterialiMigrazione = React.lazy(() => import('@/features/materiali/pages/MaterialiMigrazione'))
const RicercaArticoli = React.lazy(() => import('@/features/materiali/pages/RicercaArticoli'))
const FornitoriPage = React.lazy(() => import('@/features/fornitori/pages/FornitoriPage'))
const PazientiPage = React.lazy(() => import('@/features/pazienti/pages/PazientiPage'))
const RicettaElettronicaPage = React.lazy(() => import('@/features/ricetta-elettronica/pages/RicettaElettronicaPage'))
const CalendarPage = React.lazy(() => import('@/features/calendar/pages/CalendarPage'))
const ContiPage = React.lazy(() => import('@/features/conti/pages/ContiPage'))
const SpesePage = React.lazy(() => import('@/features/spese/pages/SpesePage'))
const CollaboratoriPage = React.lazy(() => import('@/features/collaboratori/pages/CollaboratoriPage'))
const EisenhowerMatrixPage = React.lazy(() => import('@/features/tempo/pages/TempoPage'))
const NotFoundPage = React.lazy(() => import('@/components/ui/NotFoundPage'))

//test page
const TestSelectPage = React.lazy(() => import('@/features/test/TestSelectPage'))
const RicettaTestPage = React.lazy(() => import('@/features/ricetta-elettronica/pages/RNETestPage'))

//settings page
const SettingCalendarPage = React.lazy(() => import('@/features/settings/pages/CalendarSettings'))
const TemplatesPage = React.lazy(() => import('@/features/settings/pages/TemplatesPage'))
const MonitoringSettingsPage = React.lazy(() => import('@/features/settings/pages/MonitoringSettings'))
const MonitorPrestazioniStandalonePage = React.lazy(() => import('@/features/settings/pages/MonitorPrestazioniStandalonePage'))
const AutomationPage = React.lazy(() => import('@/features/settings/pages/AutomationPage'))
const SchedulerPage = React.lazy(() => import('@/features/scheduler/pages/SchedulerPage'))

// User Management
const UserListPage = React.lazy(() => import('@/features/users/UserListPage'))
const UserForm = React.lazy(() => import('@/features/users/UserForm'))

// Lavorazioni Features
const ProvidersPage = React.lazy(() => import('@/features/lavorazioni/ProvidersPage'))
const WorksPage = React.lazy(() => import('@/features/lavorazioni/WorksPage'))
const WorkDetailsPage = React.lazy(() => import('@/features/lavorazioni/WorkDetailsPage'))
const StepsPage = React.lazy(() => import('@/features/lavorazioni/StepsPage'))
const TasksPage = React.lazy(() => import('@/features/lavorazioni/TasksPage'))
const TodosPage = React.lazy(() => import('@/features/todos/pages/TodosPage'))
const EconomicsPage = React.lazy(() => import('@/features/economics/pages/EconomicsPage'))
const AnalisiComparativaPage = React.lazy(() => import('@/features/economics/pages/AnalisiComparativaPage'))
const FornitoriClassificazione = React.lazy(() => import('@/features/fornitori/pages/FornitoriClassificazione'))
const EmailPage = React.lazy(() => import('@/features/email/pages/EmailPage'))

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
        <Route path='/register' element={<RegisterPage />} />

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
          <Route path='eisenhower' element={<EisenhowerMatrixPage />} />
          <Route path='materiali' element={<MaterialiPage />} />
          <Route path='materiali/migrazione' element={<MaterialiMigrazione />} />
          <Route path='materiali/ricerca' element={<RicercaArticoli />} />

          <Route path='fornitori' element={<FornitoriPage />} />
          <Route path='fornitori/classificazione' element={<FornitoriClassificazione />} />
          <Route path='pazienti' element={<PazientiPage />} />
          <Route path='conti' element={<ContiPage />} />
          <Route path='ricetta' element={<RicettaElettronicaPage />} />
          <Route path='calendar' element={<CalendarPage />} />
          <Route path='spese' element={<SpesePage />} />
          <Route path='collaboratori' element={<CollaboratoriPage />} />
          <Route path='email' element={<EmailPage />} />
          {/* Pagina di test per le select */}
          <Route path='test' element={<TestSelectPage />} />
          <Route path='ricetta/test' element={<RicettaTestPage />} />

          {/* Pagine di settings */}
          <Route path='settings/calendar' element={<SettingCalendarPage />} />
          <Route path='settings/template' element={<TemplatesPage />} />
          <Route path='settings/monitoring' element={<MonitoringSettingsPage />} />
          <Route path='settings/monitor-prestazioni' element={<MonitorPrestazioniStandalonePage />} />
          <Route path='settings/automazioni' element={<AutomationPage />} />
          <Route path='settings/scheduler' element={<SchedulerPage />} />

          {/* User Management Routes */}
          <Route path='users' element={<UserListPage />} />
          <Route path='users/new' element={<UserForm />} />
          <Route path='users/edit/:userId' element={<UserForm />} />

          {/* Lavorazioni Routes */}
          <Route path='providers' element={<ProvidersPage />} />
          <Route path='works' element={<WorksPage />} />
          <Route path='works/:taskId' element={<WorkDetailsPage />} />
          <Route path='steps' element={<StepsPage />} />
          <Route path='tasks' element={<TasksPage />} />

          {/* Todo Routes */}
          <Route path='todos' element={<TodosPage />} />

          {/* Economics */}
          <Route path='economics' element={<EconomicsPage />} />
          <Route path='economics/comparativa' element={<AnalisiComparativaPage />} />

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