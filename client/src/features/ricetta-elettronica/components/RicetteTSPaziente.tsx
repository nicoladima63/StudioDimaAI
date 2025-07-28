import React, { useState, useEffect } from 'react';
import {
  CCard, CCardBody, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CButton, CBadge, CSpinner, CAlert,
  CInputGroup, CInputGroupText, CFormInput, CRow, CCol
} from '@coreui/react';
import { getAllRicette, downloadRicettaPDFByNre } from '@/api/services/ricette.service';
import type { PazienteCompleto } from '@/lib/types';

// Tipo per le ricette dal Sistema TS
interface RicettaTS {
  id?: number;
  nre?: string;
  codice_pin?: string;
  stato?: string;
  cf_assistito?: string;
  paziente_nome?: string;
  paziente_cognome?: string;
  data_compilazione?: string;
  prodotto_aic?: string;
  denominazione_farmaco?: string;
  posologia?: string;
  durata_trattamento?: string;
  note?: string;
}

interface RicetteTSPazienteProps {
  pazienteSelezionato: PazienteCompleto | null;
}

const RicetteTSPaziente: React.FC<RicetteTSPazienteProps> = ({ pazienteSelezionato }) => {
  const [ricette, setRicette] = useState<RicettaTS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra ricette in base al paziente selezionato
  const ricetteFiltrate = ricette.filter(ricetta => {
    if (!pazienteSelezionato) return false;
    
    // Filtra per CF del paziente selezionato
    const matchPaziente = ricetta.cf_assistito === pazienteSelezionato.DB_PACODFI;
    
    // Applica filtro di ricerca se presente
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        ricetta.nre?.toLowerCase().includes(searchLower) ||
        ricetta.prodotto_aic?.toLowerCase().includes(searchLower) ||
        ricetta.denominazione_farmaco?.toLowerCase().includes(searchLower);
      return matchPaziente && matchSearch;
    }
    
    return matchPaziente;
  });

  // Carica ricette all'avvio
  useEffect(() => {
    loadRicette();
  }, []);

  const loadRicette = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Carica dal Sistema TS (senza force_local)
      const response = await getAllRicette();
      
      if (response.success) {
        setRicette(response.data || []);
      } else {
        setError('Errore nel caricamento delle ricette dal Sistema TS');
      }
    } catch (err: any) {
      console.error('Errore caricamento ricette TS:', err);
      setError(err.message || 'Errore durante il caricamento delle ricette');
    } finally {
      setLoading(false);
    }
  };

  const handleStampaPDF = async (ricetta: RicettaTS) => {
    if (!ricetta.nre) return;
    
    try {
      const blob = await downloadRicettaPDFByNre(ricetta.nre);
      
      // Crea URL temporaneo e avvia download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ricetta_${ricetta.nre}_${pazienteSelezionato?.DB_PANOME.replace(' ', '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Errore stampa PDF:', error);
      alert(`❌ Errore durante la stampa del PDF: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case 'inviata':
        return <CBadge color="success">Inviata</CBadge>;
      case 'erogata':
        return <CBadge color="info">Erogata</CBadge>;
      case 'annullata':
        return <CBadge color="danger">Annullata</CBadge>;
      default:
        return <CBadge color="secondary">{stato}</CBadge>;
    }
  };

  const formatData = (dataString: string) => {
    try {
      return new Date(dataString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dataString;
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <CSpinner color="primary" />
        <p className="mt-2">Caricamento ricette dal Sistema TS...</p>
      </div>
    );
  }

  return (
    <div>
      <CCard>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={6}>
              <h5>🌐 Ricette Sistema TS per Paziente</h5>
              {pazienteSelezionato && (
                <small className="text-muted">
                  Paziente: <strong>{pazienteSelezionato.DB_PANOME}</strong>
                </small>
              )}
            </CCol>
            <CCol md={6} className="text-end">
              <CButton color="primary" size="sm" onClick={loadRicette}>
                🔄 Ricarica
              </CButton>
            </CCol>
          </CRow>

          {/* Messaggio se nessun paziente selezionato */}
          {!pazienteSelezionato ? (
            <CAlert color="info">
              👤 Seleziona un paziente per visualizzare le sue ricette dal Sistema TS.
            </CAlert>
          ) : (
            <>
              {/* Campo di ricerca */}
              <CRow className="mb-3">
                <CCol md={8}>
                  <CInputGroup>
                    <CInputGroupText>🔍</CInputGroupText>
                    <CFormInput
                      placeholder="Cerca per NRE o farmaco..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </CInputGroup>
                </CCol>
                <CCol md={4} className="text-end">
                  <small className="text-muted">
                    Trovate: <strong>{ricetteFiltrate.length}</strong> ricette
                  </small>
                </CCol>
              </CRow>

              {error && (
                <CAlert color="danger">
                  <strong>Errore:</strong> {error}
                </CAlert>
              )}

              {ricetteFiltrate.length === 0 && !error ? (
                <CAlert color="info">
                  {searchTerm ? 
                    `Nessuna ricetta trovata con "${searchTerm}" per questo paziente.` :
                    'Nessuna ricetta trovata dal Sistema TS per questo paziente.'
                  }
                </CAlert>
              ) : (
                <CTable striped hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Data</CTableHeaderCell>
                      <CTableHeaderCell>NRE</CTableHeaderCell>
                      <CTableHeaderCell>Stato</CTableHeaderCell>
                      <CTableHeaderCell>Farmaco</CTableHeaderCell>
                      <CTableHeaderCell>Terapia</CTableHeaderCell>
                      <CTableHeaderCell>Azioni</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {ricetteFiltrate.map((ricetta, index) => (
                      <CTableRow key={ricetta.id || index}>
                        <CTableDataCell>
                          <small>{ricetta.data_compilazione ? formatData(ricetta.data_compilazione) : '-'}</small>
                        </CTableDataCell>
                        <CTableDataCell>
                          <code>{ricetta.nre || '-'}</code>
                        </CTableDataCell>
                        <CTableDataCell>
                          {ricetta.stato ? getStatoBadge(ricetta.stato) : '-'}
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>
                            <strong>{ricetta.prodotto_aic || ricetta.denominazione_farmaco || '-'}</strong>
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <small className="text-muted">
                            {ricetta.posologia || '-'}<br />
                            {ricetta.durata_trattamento || '-'}
                          </small>
                        </CTableDataCell>
                        <CTableDataCell>
                          {ricetta.nre && (
                            <CButton 
                              color="info" 
                              size="sm"
                              onClick={() => handleStampaPDF(ricetta)}
                              title="Stampa PDF"
                            >
                              🖨️
                            </CButton>
                          )}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </>
          )}
        </CCardBody>
      </CCard>
    </div>
  );
};

export default RicetteTSPaziente;