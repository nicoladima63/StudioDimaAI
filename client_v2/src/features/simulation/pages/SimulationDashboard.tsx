import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CSpinner,
  CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilMediaPlay, cilReload, cilEnvelopeClosed, cilAlarm, cilUserFollow } from '@coreui/icons';
import { simulationService, SimulationResults } from '@/features/simulation/services/simulation.service';
import ReminderSimulationTab from '../components/ReminderSimulationTab';
import RecallSimulationTab from '../components/RecallSimulationTab';
import EmailSimulationTab from '../components/EmailSimulationTab';

const SimulationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await simulationService.getResults();
      setResults(data);
    } catch (err) {
      console.error('Error loading simulation results:', err);
      setError('Errore nel caricamento dei risultati della simulazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await simulationService.runSimulation();
      setResults(data);
    } catch (err) {
      console.error('Error running simulation:', err);
      setError('Errore durante l\'esecuzione della simulazione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <CRow className="mb-4">
        <CCol md={8}>
          <h1 className="h3">Dashboard Simulazione (Flusso Teorico)</h1>
          <p className="text-muted">
            In questa pagina puoi visualizzare cosa farebbe il sistema senza eseguire azioni reali.
          </p>
        </CCol>
        <CCol md={4} className="text-end">
          <CButton color="primary" onClick={handleRunSimulation} disabled={loading}>
            {loading ? <CSpinner size="sm" /> : <CIcon icon={cilMediaPlay} className="me-2" />}
            Esegui Simulazione Completa
          </CButton>
          <CButton color="secondary" variant="outline" className="ms-2" onClick={loadResults} disabled={loading}>
            <CIcon icon={cilReload} />
          </CButton>
        </CCol>
      </CRow>

      {error && (
        <CAlert color="danger" dismissible>
          {error}
        </CAlert>
      )}

      <CCard className="mb-4">
        <CCardHeader>
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
                <CIcon icon={cilAlarm} className="me-2" />
                Reminder ({results?.reminders?.length || 0})
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 2} onClick={() => setActiveTab(2)} style={{ cursor: 'pointer' }}>
                <CIcon icon={cilUserFollow} className="me-2" />
                Richiami ({results?.recalls?.length || 0})
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 3} onClick={() => setActiveTab(3)} style={{ cursor: 'pointer' }}>
                <CIcon icon={cilEnvelopeClosed} className="me-2" />
                Email Filtrate ({results?.emails?.length || 0})
              </CNavLink>
            </CNavItem>
          </CNav>
        </CCardHeader>
        <CCardBody>
          {loading && !results ? (
            <div className="text-center p-5">
              <CSpinner color="primary" />
              <p className="mt-2">Simulazione in corso...</p>
            </div>
          ) : (
            <CTabContent>
              <CTabPane visible={activeTab === 1}>
                <ReminderSimulationTab actions={results?.reminders || []} />
              </CTabPane>
              <CTabPane visible={activeTab === 2}>
                <RecallSimulationTab actions={results?.recalls || []} />
              </CTabPane>
              <CTabPane visible={activeTab === 3}>
                <EmailSimulationTab actions={results?.emails || []} />
              </CTabPane>
            </CTabContent>
          )}
        </CCardBody>
      </CCard>
    </div>
  );
};

export default SimulationDashboard;
