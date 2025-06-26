import React, { useState, useEffect } from 'react'
import { CCol, CRow, CProgress, CButton, CSpinner } from '@coreui/react'
import { cilPeople, cilCalendar, cilChart, cilBell } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import Layout from '@/components/Layout'
import DashboardCard from '@/components/dashboard/DashboardCard'
import StatWidget from '@/components/dashboard/StatWidget'
import RecentActivities from './components/RecentActivities'
import MonthlyChart from './components/MonthlyChart'
import { mockDashboardData } from '@/mocks/dashboard'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState({
    users: 0,
    appointments: 0,
    growth: 0,
    notifications: 0
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats(mockDashboardData)
      setLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Layout>
      <DashboardCard 
        title="Dashboard" 
        headerAction={
          <CButton color="primary" size="sm">
            <CIcon icon={cilBell} className="me-1" />
            Notifiche
          </CButton>
        }
      >
        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
            <p>Caricamento dati in corso...</p>
          </div>
        ) : (
          <>
            <CRow>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="primary"
                  value={stats.users}
                  title="Utenti"
                  icon={cilPeople}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="info"
                  value={stats.appointments}
                  title="Appuntamenti"
                  icon={cilCalendar}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="warning"
                  value={`${stats.growth}%`}
                  title="Crescita"
                  icon={cilChart}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="danger"
                  value={stats.notifications}
                  title="Notifiche"
                  icon={cilBell}
                />
              </CCol>
            </CRow>

            <CRow className="mt-4">
              <CCol md={8}>
                <MonthlyChart />
              </CCol>
              <CCol md={4}>
                <CompletionStats />
              </CCol>
            </CRow>

            <CRow className="mt-4">
              <CCol>
                <RecentActivities />
              </CCol>
            </CRow>
          </>
        )}
      </DashboardCard>
    </Layout>
  )
}

export default Dashboard
