import React, { useState, useEffect } from 'react';
import { getIncassiByPeriodo } from '../services/incassi.service';
import { getAnniFatture } from '@/api/services/fatture.service';
import { useFattureStore } from '../store/useFattureStore';
import { CAlert, CSpinner, CBadge, CRow, CCol } from '@coreui/react';
import IncassiPeriodoForm from './IncassiPeriodoForm';
// import IncassiTable from './IncassiTable';

const IncassiDashboard: React.FC = () => {
  const { anniDisponibili, setAnniDisponibili } = useFattureStore();
  // const [anniSelezionati, setAnniSelezionati] = useState<number[]>([]); // State used only in form submission
  const [, setAnniSelezionati] = useState<number[]>([]);
  // const [tipo, setTipo] = useState('mese'); // State used only in form submission
  const [, setTipo] = useState('mese');
  // const [numero, setNumero] = useState(''); // State used only in form submission
  const [, setNumero] = useState('');
  const [dati, setDati] = useState<{ anno: number; numero_fatture?: number; importo_totale?: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (useFattureStore.getState().anniDisponibili.length === 0) {
      getAnniFatture().then(setAnniDisponibili);
    }
    // eslint-disable-next-line
  }, []);

  const handleSubmit = async (anni: number[], tipo: string, numero: string) => {
    setLoading(true);
    setErrore(null);
    try {
      const results = await Promise.all(
        anni.map(anno => getIncassiByPeriodo(String(anno), tipo, numero))
      );
      setDati(results.map((res, idx) => ({
        anno: anni[idx],
        ...res.data.data
      })));
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err && typeof (err as any).response === 'object' && (err as any).response !== null && 'data' in (err as any).response) {
        setErrore((err as any).response.data?.error || 'Errore nella richiesta');
      } else {
        setErrore('Errore nella richiesta');
      }
      setDati([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* --- FORM REACT-SELECT --- */}
      <IncassiPeriodoForm
        anniDisponibili={anniDisponibili}
        onSubmit={({ anni, tipo, numero }) => {
          setAnniSelezionati(anni);
          setTipo(tipo);
          setNumero(numero);
          // Lancia subito la ricerca!
          handleSubmit(anni, tipo, numero);
        }}
      />
      {dati.length > 0 && (
        <CRow className="mb-3">
          {dati.map(d => (
            <CCol xs={12} key={d.anno} className="mb-2">
              <CBadge color="secondary" className="me-2" style={{ fontSize: '1em' }}>anno: {d.anno}</CBadge>
              <CBadge color="primary" className="me-2" style={{ fontSize: '1em' }}>
                Fatture: {d.numero_fatture}
              </CBadge>
              <CBadge color="success" style={{ fontSize: '1em' }}>
                Totale: € {d.importo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </CBadge>
            </CCol>
          ))}
        </CRow>
      )}
      {loading && (
        <div className="text-center py-2">
          <CSpinner color="primary" />
          <span className="ms-2">Caricamento...</span>
        </div>
      )}
      {errore && <CAlert color="danger">{errore}</CAlert>}
      {/*
      {dati && (
        <IncassiTable incassi={dati.incassi} />
      )}
      */}
      {/* Qui, sotto il form, puoi visualizzare i risultati in futuro se necessario */}
    </>
  );
};

export default IncassiDashboard; 