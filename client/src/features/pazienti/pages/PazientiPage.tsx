import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import PazientiTable from '../components/PazientiTable';
import PazientiStats from '../components/PazientiStats';
import { CButton, CRow, CCol, CSpinner, CAlert, CCard, CCardBody, CCardHeader } from '@coreui/react';
import { getPazientiList, getPazientiStats } from '@/api/apiClient';

const PazientiPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
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

  // Filtro in base a nome o cognome (case-insensitive)
  const pazientiFiltrati = pazienti.filter(p =>
    p.DB_PANOME.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card title="Gestione Pazienti">
      <CCard className="mb-4">
        <CCardBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          {stats && <PazientiStats stats={stats} />}
          <CRow className="mb-3">
            <CCol>
              <CButton color="primary" disabled>Esporta (coming soon)</CButton>
            </CCol>
          </CRow>
          <input
            type="text"
            placeholder="Cerca per nome o cognome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ marginBottom: 16, padding: 8, width: 300 }}
          />
          {loading ? (
            <div className="text-center py-5"><CSpinner color="primary" /></div>
          ) : (
            <PazientiTable pazienti={pazientiFiltrati} />
          )}
        </CCardBody>
      </CCard>
    </Card>
  );
};

export default PazientiPage; 