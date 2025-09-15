import React, { useState, useEffect } from 'react';
import {
  CCard, CCardBody, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CButton, CBadge, CSpinner, CAlert,
  CInputGroup, CInputGroupText, CFormInput, CRow, CCol, CForm, CFormLabel,
  CFormSelect, CCol as CColForm
} from '@coreui/react';
import { getRicetteFromTS, downloadRicettaPDFByNre } from '@/services/ricette_ts.service';
import type { Paziente } from '@/store/pazienti.store';

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
  pazienteSelezionato: Paziente | null;
}

// Funzione per formattare XML in modo leggibile
const formatXmlForDisplay = (xmlString: string): string => {
  if (!xmlString || xmlString === 'Nessun XML disponibile') {
    return xmlString;
  }
  
  try {
    // Parsing e formattazione XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Estrai campi chiave per visualizzazione tabellare
    const protocollo = xmlDoc.querySelector('protocolloTransazione')?.textContent || 'N/A';
    const dataRicezione = xmlDoc.querySelector('dataRicezione')?.textContent || 'N/A';
    const codEsito = xmlDoc.querySelector('codEsitoVisualizzazione')?.textContent || 'N/A';
    const erroreCodice = xmlDoc.querySelector('erroreRicetta codEsito')?.textContent || 'N/A';
    const erroreMessaggio = xmlDoc.querySelector('erroreRicetta esito')?.textContent || 'N/A';
    const tipoErrore = xmlDoc.querySelector('erroreRicetta tipoErrore')?.textContent || 'N/A';
    const comunicazioneCodice = xmlDoc.querySelector('comunicazione codice')?.textContent || 'N/A';
    const comunicazioneMessaggio = xmlDoc.querySelector('comunicazione messaggio')?.textContent || 'N/A';
    
    // Formatta in modo semplice e leggibile
    const formatted = `
=== RISPOSTA SISTEMA TS ===

📋 PROTOCOLLO TRANSAZIONE: ${protocollo}
📅 DATA RICEZIONE:         ${dataRicezione}
🔢 CODICE ESITO:           ${codEsito}

🚨 ERRORE RICETTA:
   Codice:    ${erroreCodice}
   Messaggio: ${erroreMessaggio}
   Tipo:      ${tipoErrore}

📢 COMUNICAZIONE:
   Codice:    ${comunicazioneCodice}
   Messaggio: ${comunicazioneMessaggio}

📄 XML COMPLETO:
${xmlString}

=== FINE RISPOSTA ===`;
    
    return formatted;
  } catch (error) {
    return `Errore formattazione XML: ${error}\n\nXML originale:\n${xmlString}`;
  }
};

const RicetteTSPaziente: React.FC<RicetteTSPazienteProps> = ({ pazienteSelezionato }) => {
  const [ricette, setRicette] = useState<RicettaTS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [serverResponse, setServerResponse] = useState<string>('');
  
  // Filtri di ricerca
  const [filtri, setFiltri] = useState({
    dataDa: '',
    dataA: '',
    nre: ''
  });

  // Filtra ricette lato frontend solo per ricerca locale
  const ricetteFiltrate = ricette.filter(ricetta => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return 
      ricetta.nre?.toLowerCase().includes(searchLower) ||
      ricetta.prodotto_aic?.toLowerCase().includes(searchLower) ||
      ricetta.denominazione_farmaco?.toLowerCase().includes(searchLower);
  });

  // Rimuove trigger automatico - solo pulsante "Cerca"
  useEffect(() => {
    if (!pazienteSelezionato?.codice_fiscale) {
      setRicette([]);
      setError('');
      setServerResponse('');
    }
  }, [pazienteSelezionato?.codice_fiscale]);

  const loadRicette = async () => {
    // Validazione parametri obbligatori
    if (!pazienteSelezionato?.codice_fiscale) {
      setError('❌ Seleziona un paziente per cercare le ricette');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Carica dal Sistema TS con CF paziente e filtri
      const params: any = {
        cf_assistito: pazienteSelezionato.codice_fiscale
      };
      
      if (filtri.dataDa) params.data_da = filtri.dataDa;
      if (filtri.dataA) params.data_a = filtri.dataA;
      if (filtri.nre) params.nre = filtri.nre;
      
      console.log('🔍 Ricerca ricette TS con parametri:', params);
      
      const response = await getRicetteFromTS(params);
      
      // Salva XML del Sistema TS per debug - FORMATTATO
      const xmlResponse = response.ts_response?.response_xml || 'Nessun XML disponibile';
      const formattedXml = formatXmlForDisplay(xmlResponse);
      setServerResponse(formattedXml);
      
      if (response.success) {
        setRicette(response.data || []);
        console.log(`✅ Trovate ${response.data?.length || 0} ricette per CF: ${pazienteSelezionato.codice_fiscale}`);
      } else {
        setError(response.message || 'Errore nel caricamento delle ricette dal Sistema TS');
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
      link.download = `ricetta_${ricetta.nre}_${pazienteSelezionato?.nome.replace(' ', '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Errore stampa PDF:', error);
      alert(`❌ Errore durante la stampa del PDF: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  const handleFiltriChange = (field: string, value: string) => {
    setFiltri(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCerca = () => {
    loadRicette();
  };

  const handleResetFiltri = () => {
    setFiltri({
      dataDa: '',
      dataA: '',
      nre: ''
    });
    // Ricarica senza filtri
    if (pazienteSelezionato?.codice_fiscale) {
      loadRicette();
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
                  Paziente: <strong>{pazienteSelezionato.nome}</strong> (CF: {pazienteSelezionato.codice_fiscale})
                </small>
              )}
            </CCol>
            <CCol md={6} className="text-end">
              <CButton color="primary" size="sm" onClick={loadRicette} disabled={!pazienteSelezionato}>
                🔍 Cerca
              </CButton>
            </CCol>
          </CRow>

          {/* Messaggio se nessun paziente selezionato */}
          {!pazienteSelezionato ? (
            <CAlert color="info">
              👤 Seleziona un paziente e clicca "Cerca" per visualizzare le sue ricette dal Sistema TS.
            </CAlert>
          ) : (
            <>
              {/* Filtri di ricerca avanzata */}
              <CForm className="mb-4">
                <CRow className="mb-3">
                  <CColForm md={3}>
                    <CFormLabel>📅 Data da</CFormLabel>
                    <CFormInput
                      type="date"
                      value={filtri.dataDa}
                      onChange={(e) => handleFiltriChange('dataDa', e.target.value)}
                    />
                  </CColForm>
                  <CColForm md={3}>
                    <CFormLabel>📅 Data a</CFormLabel>
                    <CFormInput
                      type="date"
                      value={filtri.dataA}
                      onChange={(e) => handleFiltriChange('dataA', e.target.value)}
                    />
                  </CColForm>
                  <CColForm md={3}>
                    <CFormLabel>🏷️ NRE specifico</CFormLabel>
                    <CFormInput
                      placeholder="Inserisci NRE..."
                      value={filtri.nre}
                      onChange={(e) => handleFiltriChange('nre', e.target.value)}
                    />
                  </CColForm>
                  <CColForm md={3} className="d-flex align-items-end">
                    <div>
                      <CButton color="primary" size="sm" onClick={handleCerca} className="me-2">
                        🔍 Cerca
                      </CButton>
                      <CButton color="secondary" size="sm" onClick={handleResetFiltri}>
                        🔄 Reset
                      </CButton>
                    </div>
                  </CColForm>
                </CRow>
              </CForm>

              {/* Campo di ricerca locale */}
              <CRow className="mb-3">
                <CCol md={8}>
                  <CInputGroup>
                    <CInputGroupText>🔍</CInputGroupText>
                    <CFormInput
                      placeholder="Cerca per NRE o farmaco nei risultati..."
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
                    `Nessuna ricetta trovata con "${searchTerm}" nei risultati.` :
                    'Nessuna ricetta trovata dal Sistema TS per questo paziente con i filtri selezionati.'
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

              {/* Risposta del Server per Debug */}
              {serverResponse && (
                <CRow className="mt-4">
                  <CCol>
                    <CAlert color="info">
                      <strong>📋 XML Sistema TS (Debug)</strong>
                    </CAlert>
                    <textarea
                      className="form-control"
                      rows={25}
                      value={serverResponse}
                      readOnly
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.2'
                      }}
                      placeholder="La risposta formattata del Sistema TS apparirà qui..."
                    />
                    <small className="text-muted">
                      💡 Questo XML ti mostra esito, codici errore, protocollo transazione e tutti i dettagli della risposta del Sistema TS
                    </small>
                  </CCol>
                </CRow>
              )}
            </>
          )}
        </CCardBody>
      </CCard>
    </div>
  );
};

export default RicetteTSPaziente;