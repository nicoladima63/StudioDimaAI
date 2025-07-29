import React, { useState, useEffect } from 'react';
import {
  CCard, CCardBody, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CButton, CBadge, CSpinner, CAlert,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CFormInput, CFormLabel, CFormTextarea, CInputGroup, CInputGroupText,
  CRow, CCol, CPagination, CPaginationItem
} from '@coreui/react';
import { getAllRicette, annullaRicetta, verificaStatoRicetta, downloadRicettaPDFByNre } from '@/api/services/ricette.service';

// Tipo per le ricette dal database (campi leggermente diversi)
interface RicettaDB {
  id: number;
  nre: string;
  codice_pin: string;
  protocollo_transazione?: string;
  stato: 'inviata' | 'annullata' | 'erogata';
  cf_assistito: string;
  paziente_nome: string;
  paziente_cognome: string;
  data_compilazione: string;
  prodotto_aic: string; // nome commerciale farmaco
  denominazione_farmaco?: string; // fallback
  posologia: string;
  durata_trattamento: string;
  note?: string;
  created_at: string;
}

const ListaRicetteTest: React.FC = () => {
  const [ricette, setRicette] = useState<RicettaDB[]>([]);
  const [ricetteFiltrate, setRicetteFiltrate] = useState<RicettaDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnnullaModal, setShowAnnullaModal] = useState(false);
  const [ricettaSelezionata, setRicettaSelezionata] = useState<RicettaDB | null>(null);
  const [motivazione, setMotivazione] = useState('');
  const [annullaLoading, setAnnullaLoading] = useState(false);
  // const [statoVerificaLoading, setStatoVerificaLoading] = useState(false); // Loading state for status verification - not displayed in UI
  const [, setStatoVerificaLoading] = useState(false);
  
  // Paginazione semplice
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [ricettePaginate, setRicettePaginate] = useState<RicettaDB[]>([]);

  // Carica ricette all'avvio
  useEffect(() => {
    loadRicette();
  }, []);

  // Effetto per filtrare le ricette
  useEffect(() => {
    if (!searchTerm.trim()) {
      setRicetteFiltrate(ricette);
    } else {
      const filtered = ricette.filter(ricetta => 
        ricetta.cf_assistito?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ricetta.paziente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ricetta.paziente_cognome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ricetta.nre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${ricetta.paziente_nome} ${ricetta.paziente_cognome}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setRicetteFiltrate(filtered);
    }
    setCurrentPage(1);
  }, [ricette, searchTerm]);

  // Effetto per la paginazione
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setRicettePaginate(ricetteFiltrate.slice(startIndex, endIndex));
  }, [ricetteFiltrate, currentPage, itemsPerPage]);

  const loadRicette = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Chiama sempre il Sistema TS (senza force_local)
      const response = await getAllRicette();
      
      if (response.success) {
        setRicette(response.data || []);
      } else {
        setError('Errore nel caricamento delle ricette dal Sistema TS');
      }
    } catch (err: any) {
      console.error('Errore caricamento ricette:', err);
      setError(err.message || 'Errore durante il caricamento delle ricette');
    } finally {
      setLoading(false);
    }
  };

  const handleStampaPDF = async (ricetta: RicettaDB) => {
    try {
      const blob = await downloadRicettaPDFByNre(ricetta.nre);
      
      // Crea URL temporaneo e avvia download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ricetta_${ricetta.nre}_${ricetta.paziente_cognome.replace(' ', '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Errore stampa PDF:', error);
      alert(`❌ Errore durante la stampa del PDF: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  const handleAnnullaClick = async (ricetta: RicettaDB) => {
    // Prima verifica lo stato aggiornato della ricetta
    setStatoVerificaLoading(true);
    
    try {
      const statoResponse = await verificaStatoRicetta(ricetta.nre);
      
      if (statoResponse.success) {
        const statoAttuale = statoResponse.stato_locale;
        
        if (statoAttuale === 'erogata') {
          alert('❌ Impossibile annullare: la ricetta è già stata erogata in farmacia.');
          return;
        }
        
        if (statoAttuale === 'annullata') {
          alert('ℹ️ La ricetta risulta già annullata.');
          // Ricarica la lista per aggiornare lo stato
          loadRicette();
          return;
        }
        
        // Se lo stato è ancora "inviata", procedi con l'annullamento
        setRicettaSelezionata(ricetta);
        setMotivazione('Annullamento ricetta di test');
        setShowAnnullaModal(true);
        
      } else {
        alert(`❌ Errore verifica stato: ${statoResponse.error}`);
      }
      
    } catch (error: any) {
      console.error('Errore verifica stato ricetta:', error);
      alert(`❌ Errore durante la verifica dello stato: ${error.message || 'Errore sconosciuto'}\n\nProcedere comunque con l'annullamento?`);
      // In caso di errore, permetti comunque di provare l'annullamento
      setRicettaSelezionata(ricetta);
      setMotivazione('Annullamento ricetta di test');
      setShowAnnullaModal(true);
    } finally {
      setStatoVerificaLoading(false);
    }
  };

  const confermaAnnullamento = async () => {
    if (!ricettaSelezionata) return;

    setAnnullaLoading(true);
    
    try {
      const response = await annullaRicetta(
        ricettaSelezionata.nre, 
        ricettaSelezionata.codice_pin, 
        motivazione
      );

      if (response.success) {
        alert('✅ Ricetta annullata con successo!');
        setShowAnnullaModal(false);
        setRicettaSelezionata(null);
        setMotivazione('');
        // Ricarica la lista
        loadRicette();
      } else {
        alert(`❌ Errore annullamento: ${response.error || 'Errore sconosciuto'}`);
      }
    } catch (err: any) {
      console.error('Errore annullamento ricetta:', err);
      alert(`❌ Errore durante l'annullamento: ${err.message || 'Errore sconosciuto'}`);
    } finally {
      setAnnullaLoading(false);
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
        <p className="mt-2">Caricamento ricette dal sistema TS...</p>
      </div>
    );
  }

  return (
    <div>
      <CCard>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={6}>
              <h5>📋 Lista Ricette Sistema TS</h5>
            </CCol>
            <CCol md={6} className="text-end">
              <CButton color="primary" size="sm" onClick={loadRicette}>
                🔄 Ricarica dal Sistema TS
              </CButton>
            </CCol>
          </CRow>

          {/* Campo di ricerca semplice */}
          <CRow className="mb-3">
            <CCol md={8}>
              <CInputGroup>
                <CInputGroupText>🔍</CInputGroupText>
                <CFormInput
                  placeholder="Cerca per nome, cognome, codice fiscale o NRE..."
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

          {ricetteFiltrate.length === 0 && !error && !loading ? (
            <CAlert color="info">
              {searchTerm ? 
                `Nessuna ricetta trovata con "${searchTerm}".` :
                'Nessuna ricetta trovata dal Sistema TS.'
              }
            </CAlert>
          ) : (
            <CTable striped hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>CF Assistito</CTableHeaderCell>
                  <CTableHeaderCell>Data Emissione</CTableHeaderCell>
                  <CTableHeaderCell>NRE</CTableHeaderCell>
                  <CTableHeaderCell>Stato</CTableHeaderCell>
                  <CTableHeaderCell>Farmaco</CTableHeaderCell>
                  <CTableHeaderCell>Paziente</CTableHeaderCell>
                  <CTableHeaderCell>Azioni</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {ricettePaginate.map((ricetta) => (
                  <CTableRow key={ricetta.id}>
                    <CTableDataCell>
                      <strong>{ricetta.cf_assistito}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      {formatData(ricetta.data_compilazione)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <code>{ricetta.nre}</code>
                    </CTableDataCell>
                    <CTableDataCell>
                      {getStatoBadge(ricetta.stato)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>
                        <strong>{ricetta.prodotto_aic || ricetta.denominazione_farmaco}</strong>
                        <br />
                        <small className="text-muted">
                          {ricetta.posologia} - {ricetta.durata_trattamento}
                        </small>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      {ricetta.paziente_nome} {ricetta.paziente_cognome}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-1">
                        {/* Bottone Stampa PDF - solo se ricetta ha PDF */}
                        {ricetta.prodotto_aic && (
                          <CButton 
                            color="info" 
                            size="sm"
                            onClick={() => handleStampaPDF(ricetta)}
                            title="Stampa PDF"
                          >
                            🖨️
                          </CButton>
                        )}
                        
                        {/* Bottone Annulla - solo se inviata */}
                        {ricetta.stato === 'inviata' && (
                          <CButton 
                            color="danger" 
                            size="sm"
                            onClick={() => handleAnnullaClick(ricetta)}
                            title="Annulla"
                          >
                            ❌
                          </CButton>
                        )}
                        
                        {/* Stato per ricette non annullabili */}
                        {ricetta.stato !== 'inviata' && (
                          <small className="text-muted">{ricetta.stato}</small>
                        )}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}

          {/* Paginazione semplice */}
          {ricetteFiltrate.length > itemsPerPage && (
            <div className="d-flex justify-content-center mt-3">
              <CPagination>
                <CPaginationItem 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  ← Precedente
                </CPaginationItem>
                
                <CPaginationItem active>
                  {currentPage} / {Math.ceil(ricetteFiltrate.length / itemsPerPage)}
                </CPaginationItem>
                
                <CPaginationItem 
                  disabled={currentPage === Math.ceil(ricetteFiltrate.length / itemsPerPage)}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Successiva →
                </CPaginationItem>
              </CPagination>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Modal Conferma Annullamento */}
      <CModal visible={showAnnullaModal} onClose={() => setShowAnnullaModal(false)}>
        <CModalHeader>
          <CModalTitle>❌ Conferma Annullamento Ricetta</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {ricettaSelezionata && (
            <div>
              <CAlert color="warning">
                <strong>Attenzione!</strong> Stai per annullare la seguente ricetta:
              </CAlert>
              
              <div className="mb-3">
                <p><strong>NRE:</strong> {ricettaSelezionata.nre}</p>
                <p><strong>CF Assistito:</strong> {ricettaSelezionata.cf_assistito}</p>
                <p><strong>Paziente:</strong> {ricettaSelezionata.paziente_nome} {ricettaSelezionata.paziente_cognome}</p>
                <p><strong>Farmaco:</strong> {ricettaSelezionata.prodotto_aic || ricettaSelezionata.denominazione_farmaco}</p>
              </div>

              <div className="mb-3">
                <CFormLabel>Motivazione Annullamento</CFormLabel>
                <CFormTextarea
                  value={motivazione}
                  onChange={(e) => setMotivazione(e.target.value)}
                  rows={3}
                  placeholder="Inserire la motivazione dell'annullamento..."
                />
              </div>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton 
            color="secondary" 
            onClick={() => setShowAnnullaModal(false)}
            disabled={annullaLoading}
          >
            Annulla
          </CButton>
          <CButton 
            color="danger" 
            onClick={confermaAnnullamento}
            disabled={!motivazione.trim() || annullaLoading}
          >
            {annullaLoading ? <CSpinner size="sm" className="me-2" /> : '❌'}
            Conferma Annullamento
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default ListaRicetteTest;