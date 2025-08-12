import React from 'react';
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CSpinner,
  CAlert,
  CBadge,
  CCardHeader
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPeople, cilUser } from '@coreui/icons';
import { useClassificazioni } from '@/store/classificazioniStore';

const CollaboratoriTab: React.FC = () => {
  const { classificazioni, isLoading, error } = useClassificazioni('COLLABORATORI');

  // Raggruppa per codice_riferimento (fornitore)
  const collaboratori = React.useMemo(() => {
    const gruppi = new Map<string, {
      codice_riferimento: string;
      fornitore_nome: string;
      count: number;
    }>();

    classificazioni.forEach(c => {
      if (!gruppi.has(c.codice_riferimento)) {
        gruppi.set(c.codice_riferimento, {
          codice_riferimento: c.codice_riferimento,
          fornitore_nome: c.fornitore_nome || c.codice_riferimento,
          count: 0
        });
      }
      gruppi.get(c.codice_riferimento)!.count += 1;
    });

    return Array.from(gruppi.values());
  }, [classificazioni]);

  if (isLoading) {
    return (
      <div className="text-center p-4">
        <CSpinner />
        <div className="mt-2">Caricamento collaboratori...</div>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="danger">
        <strong>Errore:</strong> {error}
      </CAlert>
    );
  }

  if (collaboratori.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilUser} className="me-2" />
        Nessun collaboratore classificato trovato.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilPeople} className="me-2" />
          {collaboratori.length} collaboratori trovati
        </h6>
      </div>
      
      <CRow className="justify-content-center">
        {collaboratori.map((collaboratore, index) => (
          <CCol key={index} md={2} className="mb-4">
            <CCard className="h-100">
              <CCardHeader>
              <CIcon icon={cilUser} size="xl" className="text-primary me-3" />

                {collaboratore.fornitore_nome}
              </CCardHeader>
              <CCardBody className="d-flex align-items-center">
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>
    </div>
  );
  };

export default CollaboratoriTab;