import React, { useEffect, useState } from "react";
import { CCard, CCardBody, CCardHeader, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CSpinner, CAlert } from "@coreui/react";
import { getRicetteTest } from "@/services/api/ricetta.service";

const ListaRicetteTest: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRicetteTest()
      .then(res => {
        if (res.success) {
          setData(res.data || []);
        } else {
          setError(res.message || "Errore caricamento ricette");
        }
      })
      .catch(err => setError(err?.message || "Errore sconosciuto"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CSpinner />;
  if (error) return <CAlert color="danger">{error}</CAlert>;

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
