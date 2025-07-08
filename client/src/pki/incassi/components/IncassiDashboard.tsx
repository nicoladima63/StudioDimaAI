import React, { useState } from 'react';
import IncassiPeriodoForm from './IncassiPeriodoForm';
import IncassiAggregati from './IncassiAggregati';
import IncassiTable from './IncassiTable';
import { getIncassiByPeriodo } from '../services/incassi.service';
import { CAlert, CSpinner, CRow, CCol } from '@coreui/react';
import Card from '@/components/DashboardCard';

type Incasso = {
  data: string;
  importo: number;
  codice_paziente: string;
  medico: string;
  numero_fattura: string;
  data_fattura?: string;
};

type IncassiAggregatiData = {
  incassi: Incasso[];
  numero_fatture: number;
  importo_totale: number;
};

const IncassiDashboard: React.FC = () => {
  const [dati, setDati] = useState<IncassiAggregatiData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errore, setErrore] = useState<string | null>(null);

  const handleSubmit = async (params: { anno: string; tipo: string; numero: string }) => {
    setLoading(true);
    setErrore(null);
    try {
      const res = await getIncassiByPeriodo(params.anno, params.tipo, params.numero);
      setDati(res.data.data);
    } catch (err: any) {
      setErrore(err?.response?.data?.error || 'Errore nella richiesta');
      setDati(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Gestione Incassi">
      <CRow>
        <CCol md={12} lg={6} className="mb-3">
          <IncassiPeriodoForm onSubmit={handleSubmit} />
        </CCol>
        <CCol md={12} lg={6} className="mb-3">
          {loading && (
            <div className="text-center py-2">
              <CSpinner color="primary" />
              <span className="ms-2">Caricamento...</span>
            </div>
          )}
          {errore && <CAlert color="danger">{errore}</CAlert>}
          {dati && <IncassiAggregati numeroFatture={dati.numero_fatture} importoTotale={dati.importo_totale} />}
        </CCol>
      </CRow>
      <CRow>
        <CCol>
          {dati && <IncassiTable incassi={dati.incassi} />}
        </CCol>
      </CRow>
    </Card>
  );
};

export default IncassiDashboard; 