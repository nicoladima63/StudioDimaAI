import React, { useState, useEffect } from 'react'
import { CCol, CRow, CButton, CSpinner } from '@coreui/react'
import { cilPeople, cilCalendar, cilChart, cilBell } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import DashboardCard from '@/components/DashboardCard'
import StatWidget from '@/components/StatWidget'
import RecentActivities from '@/components/RecentActivities'
import MonthlyChart from '@/components/MonthlyChart'
import CompletionStats from '@/components/CompletionStats'
import { getPazientiStats, getAppuntamentiStats, getPrimeVisiteStats } from '@/api/apiClient'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState({
    pazienti: 0,
    inCura: 0,
    meseCorrente: 0,
    meseProssimo: 0,
    crescita: 0,
    nuoveVisite: null
  })

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const pazData = await getPazientiStats()
        const appData = await getAppuntamentiStats()
        const primeData = await getPrimeVisiteStats()
        const crescita = appData.data.mese_corrente
          ? Math.round(((appData.data.mese_prossimo - appData.data.mese_corrente) / appData.data.mese_corrente) * 100)
          : 0
        setStats({
          pazienti: pazData.data.totale,
          inCura: pazData.data.in_cura,
          meseCorrente: appData.data.mese_corrente,
          meseProssimo: appData.data.mese_prossimo,
          crescita,
          nuoveVisite: primeData.data.nuove_visite
        })
      } catch {
        // fallback o errore
        setStats({
          pazienti: 0,
          inCura: 0,
          meseCorrente: 0,
          meseProssimo: 0,
          crescita: 0,
          nuoveVisite: null
        })
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  return (
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
                  value={`${stats.pazienti} | ${stats.inCura}`}
                  title="Pazienti | In cura"
                  icon={cilPeople}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="info"
                  value={`${stats.meseCorrente} | ${stats.meseProssimo}`}
                  title="App. mese | prossimo"
                  icon={cilCalendar}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="warning"
                  value={`${stats.crescita}%`}
                  title="Crescita %"
                  icon={cilChart}
                />
              </CCol>
              <CCol sm={6} lg={3}>
                <StatWidget 
                  color="danger"
                  value={stats.nuoveVisite !== null ? stats.nuoveVisite : 'Nuove visite nel mese='}
                  title="Prime visite"
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
  )
}

export default Dashboard
