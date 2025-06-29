import React, { useEffect, useState } from 'react';
import PazientiTable from './PazientiTable';
import PazientiStats from './PazientiStats';
import { CButton, CRow, CCol, CSpinner, CAlert, CCard, CCardBody, CCardHeader } from '@coreui/react';
import { getPazientiList, getPazientiStats } from '@/api/apiClient';

const PazientiPage: React.FC = () => {
  const [pazienti, setPazienti] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPazientiList(),
      getPazientiStats()
    ])
      .then(([pazRes, statsRes]) => {
        if (pazRes.success) setPazienti(pazRes.data);
        if (statsRes.success) setStats(statsRes.data);
      })
      .catch(() => setError('Errore nel caricamento dei dati'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <CCard className="mb-4">
        <CCardHeader>
          <h4>Gestione Pazienti</h4>
        </CCardHeader>
        <CCardBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          {stats && <PazientiStats stats={stats} />}
          <CRow className="mb-3">
            <CCol>
              <CButton color="primary" disabled>Esporta (coming soon)</CButton>
            </CCol>
          </CRow>
          {loading ? (
            <div className="text-center py-5"><CSpinner color="primary" /></div>
          ) : (
            <PazientiTable pazienti={pazienti} />
          )}
        </CCardBody>
      </CCard>
    </div>
  );
};

export default PazientiPage; 