import React, { useState, useEffect } from 'react'
import { CCol, CRow, CButton, CSpinner } from '@coreui/react'
import { cilPeople, cilCalendar, cilChart, cilBell } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import DashboardCard from '@/components/DashboardCard'
import StatWidget from '@/components/StatWidget'
import RecentActivities from '@/components/RecentActivities'
import AppuntamentiCoreUICard from '@/components/AppuntamentiCoreUICard'
import AppuntamentiChart from '@/components/AppuntamentiChart'
import AppuntamentiTotaliBar from '@/components/AppuntamentiTotaliBar'
import { getPazientiStats, getAppuntamentiStats, getPrimeVisiteStats, getAppuntamentiPerAnno } from '@/api/apiClient'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState({
    pazienti: 0,
    inCura: 0,
    mesePrecedente: 0,
    meseCorrente: 0,
    meseProssimo: 0,
    crescita: 0,
    nuoveVisite: null
  })
  const [datiGrafico, setDatiGrafico] = useState<{ [anno: string]: { month: number; count: number }[] }>({})

  const colori = ['#3399ff', '#8884d8', '#b0b0b0']

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const pazData = await getPazientiStats()
        const appData = await getAppuntamentiStats()
        const primeData = await getPrimeVisiteStats()
        let crescita = 0;
        if (appData.data.mese_precedente === 0 && appData.data.mese_corrente > 0) {
          crescita = 100;
        } else if (appData.data.mese_precedente === 0 && appData.data.mese_corrente === 0) {
          crescita = 0;
        } else if (appData.data.mese_precedente > 0 && appData.data.mese_corrente === 0) {
          crescita = -100;
        } else if (appData.data.mese_precedente > 0) {
          crescita = Math.round(((appData.data.mese_corrente - appData.data.mese_precedente) / appData.data.mese_precedente) * 100);
        }
        setStats({
          pazienti: pazData.data.totale,
          inCura: pazData.data.in_cura,
          mesePrecedente: appData.data.mese_precedente,
          meseCorrente: appData.data.mese_corrente,
          meseProssimo: appData.data.mese_prossimo,
          crescita,
          nuoveVisite: primeData.data.nuove_visite
        })
        // Carica dati per il grafico appuntamenti 3 anni
        const datiAnni = await getAppuntamentiPerAnno()
        setDatiGrafico(datiAnni.data)
      } catch {
        // fallback o errore
        setStats({
          pazienti: 0,
          inCura: 0,
          mesePrecedente: 0,
          meseCorrente: 0,
          meseProssimo: 0,
          crescita: 0,
          nuoveVisite: null
        })
        setDatiGrafico({})
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
              <CCol sm={6} lg={2}>
                <StatWidget 
                  color="primary"
                  value={`${stats.pazienti} | ${stats.inCura}`}
                  title="Pazienti | In cura"
                  icon={cilPeople}
                />
              </CCol>
              <CCol sm={6} lg={2}>
                <StatWidget 
                  color="info"
                  value={`${stats.mesePrecedente} | ${stats.meseCorrente} | ${stats.meseProssimo}`}
                  title="Prec. | In corso | Prossimo"
                  icon={cilCalendar}
                />
              </CCol>
              <CCol sm={6} lg={2}>
                <StatWidget 
                  color="warning"
                  value={`${stats.crescita}%`}
                  title="Crescita %"
                  icon={cilChart}
                />
              </CCol>
              <CCol sm={6} lg={2}>
                <StatWidget 
                  color="danger"
                  value={stats.nuoveVisite !== null ? stats.nuoveVisite : 'Nuove visite nel mese='}
                  title="Prime visite"
                  icon={cilBell}
                />
              </CCol>
              <CCol sm={12} lg={3}>
                 <AppuntamentiCoreUICard
                   value={stats.meseCorrente}
                   percent={stats.crescita}
                   data={datiGrafico[String(new Date().getFullYear())] || []}
                   color="#3399ff"
                 />
              </CCol>
            </CRow>

            <CRow className="mt-4">
              <CCol md={8}>
                <AppuntamentiChart 
                    data={datiGrafico}
                  />
              </CCol>
              <CCol md={4}>
                <AppuntamentiTotaliBar
                  totali={Object.keys(datiGrafico).sort().map((anno, idx) => ({
                    anno,
                    totale: (datiGrafico[anno] || []).reduce((sum, m) => sum + m.count, 0),
                    colore: colori[idx % colori.length]
                  }))}
                />
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
