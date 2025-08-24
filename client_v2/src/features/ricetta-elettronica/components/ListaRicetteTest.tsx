import React, { useEffect, useState } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CSpinner,
  CAlert,
} from '@coreui/react';
import { getRicetteFromTS } from '@/services/ricette_ts.service';

interface ListaRicetteTestProps {
  shouldLoad?: boolean;
  cfPaziente?: string;
}

const ListaRicetteTest: React.FC<ListaRicetteTestProps> = ({ shouldLoad = false, cfPaziente }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // FUNZIONE CORRETTA CHE USA L'ARCHITETTURA V2
  const caricaRicetteFromSistemaTS = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('=== CARICAMENTO RICETTE DAL SISTEMA TS V2 ===');
      
      // RICERCA BASICA: SOLO NRE + CF MEDICO + CF ASSISTITO
      const result = await getRicetteFromTS({
        cf_assistito: cfPaziente || 'BLDMCR69R45G999C',
        // NIENTE DATE! La ricetta è vecchia
        test_ricerca_specifica: true,
        nre: 'C0003340582', 
        cf_medico_reale: 'DMRNCL63S21D612I',
        use_production: true
      });

      console.log('=== RISULTATO SERVICE V2 ===');
      console.log(result);

      if (result.success) {
        setData(result.data || []);
        console.log(`Ricette caricate: ${result.data?.length || 0}`);
      } else {
        setError(result.message || 'Errore recupero ricette dal Sistema TS');
        console.error('Errore service V2:', result.error);
      }
    } catch (err: any) {
      console.error('Errore caricamento ricette:', err);
      setError(`Errore: ${err.message}`);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    // USA ARCHITETTURA V2 CORRETTA
    if (shouldLoad && !hasLoaded) {
      caricaRicetteFromSistemaTS();
    }
  }, [shouldLoad, hasLoaded]);

  if (loading) return <CSpinner />;
  if (error) return <CAlert color='danger'>{error}</CAlert>;

  // Se non deve ancora caricare, mostra placeholder
  if (!shouldLoad) {
    return (
      <CCard className='mb-3'>
        <CCardHeader>📋 Lista Ricette Sistema TS</CCardHeader>
        <CCardBody>
          <CAlert color='info'>
            Seleziona questa tab per caricare le ricette direttamente dal Sistema TS
          </CAlert>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard className='mb-3'>
      <CCardHeader>📋 Lista Ricette Sistema TS</CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>NRE</CTableHeaderCell>
              <CTableHeaderCell>PIN</CTableHeaderCell>
              <CTableHeaderCell>CF Paziente</CTableHeaderCell>
              <CTableHeaderCell>Paziente</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Farmaco</CTableHeaderCell>
              <CTableHeaderCell>Stato</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {data.map((r, idx) => (
              <CTableRow key={idx}>
                <CTableDataCell>
                  <code>{r.nre || r.id}</code>
                </CTableDataCell>
                <CTableDataCell>
                  <small>{r.codice_pin || r.pin}</small>
                </CTableDataCell>
                <CTableDataCell>
                  <small>{r.cf_assistito || r.cf_paziente}</small>
                </CTableDataCell>
                <CTableDataCell>
                  {r.paziente_nome} {r.paziente_cognome}
                </CTableDataCell>
                <CTableDataCell>
                  <small>{r.data_compilazione || r.data}</small>
                </CTableDataCell>
                <CTableDataCell>{r.denominazione_farmaco || r.farmaco}</CTableDataCell>
                <CTableDataCell>
                  <span
                    className={`badge ${r.stato === 'inviata' ? 'bg-success' : r.stato === 'annullata' ? 'bg-danger' : 'bg-secondary'}`}
                  >
                    {r.stato}
                  </span>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  );
};

export default ListaRicetteTest;
