// src/features/pazienti/components/CittaTable.tsx
import React, { useState } from 'react';
import { 
  CSpinner, 
  CBadge, 
  CButton, 
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter
} from '@coreui/react';
import type { CittaData, PazienteCompleto } from '@/lib/types';
import { usePazientiStore } from '@/store/pazienti.store';

interface CittaTableProps {
  cittaData: CittaData[];
  loading: boolean;
  onNavigateToPatients?: (citta: string) => void;
}

const CittaTable: React.FC<CittaTableProps> = ({ 
  cittaData, 
  loading, 
  onNavigateToPatients 
}) => {
  const [selectedCitta, setSelectedCitta] = useState<string | null>(null);
  const [showPazientiModal, setShowPazientiModal] = useState(false);
  const [pazientiCitta, setPazientiCitta] = useState<PazienteCompleto[]>([]);
  const { pazienti } = usePazientiStore();

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento dati città...</p>
      </div>
    );
  }

  const handleVediPazienti = (nomeCitta: string) => {
    // Filtra pazienti per città
    const pazientiDellaCitta = pazienti.filter(p => p.citta_clean === nomeCitta);
    setPazientiCitta(pazientiDellaCitta);
    setSelectedCitta(nomeCitta);
    setShowPazientiModal(true);
  };

  const handleNavigateToPatients = () => {
    if (selectedCitta && onNavigateToPatients) {
      onNavigateToPatients(selectedCitta);
      setShowPazientiModal(false);
    }
  };
  
  return (
    <>
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Città</th>
              <th>Totale Pazienti</th>
              <th>Richiami Necessari</th>
              <th>Con Cellulare</th>
              <th>Con Email</th>
              <th>In Cura</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {cittaData.map((citta) => (
              <tr key={citta.citta}>
                <td>
                  <strong>{citta.citta}</strong>
                </td>
                <td>
                  <CBadge color="primary">{citta.totale_pazienti}</CBadge>
                </td>
                <td>
                  <CBadge color="warning">{citta.richiami_necessari}</CBadge>
                </td>
                <td>
                  <CBadge color="success">{citta.con_cellulare}</CBadge>
                </td>
                <td>
                  <CBadge color="info">{citta.con_email}</CBadge>
                </td>
                <td>
                  <CBadge color="secondary">{citta.in_cura}</CBadge>
                </td>
                <td>
                  <CButton
                    color="outline-primary"
                    size="sm"
                    onClick={() => handleVediPazienti(citta.citta)}
                  >
                    Vedi Pazienti
                  </CButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal per visualizzare pazienti della città */}
      <CModal
        visible={showPazientiModal}
        onClose={() => setShowPazientiModal(false)}
        size="xl"
      >
        <CModalHeader>
          <CModalTitle>
            Pazienti di {selectedCitta} ({pazientiCitta.length})
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {pazientiCitta.length > 0 ? (
            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table table-sm table-striped">
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
                  <tr>
                    <th>Codice</th>
                    <th>Nome</th>
                    <th>Indirizzo</th>
                    <th>Contatto</th>
                    <th>Ultima Visita</th>
                    <th>Richiamo</th>
                  </tr>
                </thead>
                <tbody>
                  {pazientiCitta.map((paziente) => (
                    <tr key={paziente.DB_CODE}>
                      <td>
                        <small className="text-muted">{paziente.DB_CODE}</small>
                      </td>
                      <td>
                        <strong>{paziente.nome_completo}</strong>
                      </td>
                      <td>
                        <small>{paziente.DB_PAINDIR}</small>
                      </td>
                      <td>
                        {paziente.numero_contatto ? (
                          <span className="text-success">{paziente.numero_contatto}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <small>
                          {paziente.ultima_visita ? 
                            new Date(paziente.ultima_visita).toLocaleDateString('it-IT') : 
                            '-'
                          }
                        </small>
                      </td>
                      <td>
                        {paziente.needs_recall ? (
                          <CBadge color={
                            paziente.recall_priority === 'high' ? 'danger' : 
                            paziente.recall_priority === 'medium' ? 'warning' : 
                            'info'
                          }>
                            {paziente.recall_priority}
                          </CBadge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted">Nessun paziente trovato per questa città</p>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton 
            color="secondary" 
            onClick={() => setShowPazientiModal(false)}
          >
            Chiudi
          </CButton>
          {pazientiCitta.length > 0 && (
            <CButton 
              color="primary"
              onClick={handleNavigateToPatients}
            >
              Vai ai Pazienti
            </CButton>
          )}
        </CModalFooter>
      </CModal>
    </>
  );
};

export default CittaTable;