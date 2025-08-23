import React, { useEffect, useState } from "react";
import { CCard, CCardBody, CCardHeader, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CSpinner, CAlert } from "@coreui/react";
import { getAllRicette } from "@/services/ricette_ts.service";

interface ListaRicetteTestProps {
  shouldLoad?: boolean;
  cfPaziente?: string;
}

const ListaRicetteTest: React.FC<ListaRicetteTestProps> = ({ shouldLoad = false, cfPaziente }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Carica solo se shouldLoad è true e non ha ancora caricato
    if (shouldLoad && !hasLoaded) {
      setLoading(true);
      setError(null);
      
      getAllRicette(cfPaziente ? { cf_assistito: cfPaziente } : {})
        .then(res => {
          if (res.success) {
            setData(res.data || []);
          } else {
            setError(res.message || "Errore caricamento ricette");
          }
          setHasLoaded(true);
        })
        .catch(err => setError(err?.message || "Errore sconosciuto"))
        .finally(() => setLoading(false));
    }
  }, [shouldLoad, hasLoaded, cfPaziente]);

  if (loading) return <CSpinner />;
  if (error) return <CAlert color="danger">{error}</CAlert>;
  
  // Se non deve ancora caricare, mostra placeholder
  if (!shouldLoad) {
    return (
      <CCard className="mb-3">
        <CCardHeader>Lista Ricette Test</CCardHeader>
        <CCardBody>
          <CAlert color="info">
            Seleziona questa tab per caricare le ricette dal Sistema TS
          </CAlert>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard className="mb-3">
      <CCardHeader>Lista Ricette Test</CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>CF Paziente</CTableHeaderCell>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Stato</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {data.map((r, idx) => (
              <CTableRow key={idx}>
                <CTableDataCell>{r.id}</CTableDataCell>
                <CTableDataCell>{r.cf_paziente}</CTableDataCell>
                <CTableDataCell>{r.data}</CTableDataCell>
                <CTableDataCell>{r.stato}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  );
};

export default ListaRicetteTest;
