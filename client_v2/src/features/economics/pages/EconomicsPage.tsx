import React, { useState } from 'react'
import { CButton, CCard, CCardBody, CCardHeader, CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import toast from 'react-hot-toast'
import { economicsService } from '../services/economics.service'
import DashboardTab from '../components/DashboardTab'
import ForecastTab from '../components/ForecastTab'
import SimulatoreTab from '../components/SimulatoreTab'
import ReportAppuntamenti from '../components/ReportAppuntamenti'
import ReportPrestazioni from '../components/ReportPrestazioni'

const EconomicsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [reportSubTab, setReportSubTab] = useState<string>('appuntamenti')
  const [ricalcolo, setRicalcolo] = useState(false)
  // Cambiare la key rimonta i tab, che rileggono i dati dal server.
  const [versione, setVersione] = useState(0)

  const ricalcola = async () => {
    setRicalcolo(true)
    try {
      await economicsService.apiInvalidateCache()
      setVersione(v => v + 1)
      toast.success('Cache svuotata: dati ricalcolati dai file del gestionale')
    } catch {
      toast.error('Ricalcolo non riuscito. Riprova.')
    } finally {
      setRicalcolo(false)
    }
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Analisi Economica</strong>
        <CButton color="secondary" size="sm" disabled={ricalcolo} onClick={() => void ricalcola()}>
          {ricalcolo ? 'Ricalcolo in corso...' : 'Ricalcola dati'}
        </CButton>
      </CCardHeader>
      <CCardBody>
        <CNav variant="tabs" className="mb-4">
          <CNavItem>
            <CNavLink
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              style={{ cursor: 'pointer' }}
            >
              Stato Attuale
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'forecast'}
              onClick={() => setActiveTab('forecast')}
              style={{ cursor: 'pointer' }}
            >
              Previsione
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'simulatore'}
              onClick={() => setActiveTab('simulatore')}
              style={{ cursor: 'pointer' }}
            >
              Simulatore
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === 'report'}
              onClick={() => setActiveTab('report')}
              style={{ cursor: 'pointer' }}
            >
              Report Studio
            </CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent key={versione}>
          <CTabPane visible={activeTab === 'dashboard'}>
            <DashboardTab />
          </CTabPane>
          <CTabPane visible={activeTab === 'forecast'}>
            {activeTab === 'forecast' && <ForecastTab />}
          </CTabPane>
          <CTabPane visible={activeTab === 'simulatore'}>
            {activeTab === 'simulatore' && <SimulatoreTab />}
          </CTabPane>
          <CTabPane visible={activeTab === 'report'}>
            {activeTab === 'report' && (
              <>
                <CNav variant="tabs" className="mb-3">
                  <CNavItem>
                    <CNavLink
                      active={reportSubTab === 'appuntamenti'}
                      onClick={() => setReportSubTab('appuntamenti')}
                      style={{ cursor: 'pointer' }}
                    >
                      Appuntamenti
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink
                      active={reportSubTab === 'prestazioni'}
                      onClick={() => setReportSubTab('prestazioni')}
                      style={{ cursor: 'pointer' }}
                    >
                      Prestazioni
                    </CNavLink>
                  </CNavItem>
                </CNav>
                <CTabContent>
                  <CTabPane visible={reportSubTab === 'appuntamenti'}>
                    <ReportAppuntamenti />
                  </CTabPane>
                  <CTabPane visible={reportSubTab === 'prestazioni'}>
                    {reportSubTab === 'prestazioni' && <ReportPrestazioni />}
                  </CTabPane>
                </CTabContent>
              </>
            )}
          </CTabPane>
        </CTabContent>
      </CCardBody>
    </CCard>
  )
}

export default EconomicsPage
