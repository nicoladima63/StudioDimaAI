import React, { useState, useEffect } from 'react';
import {
  CCard, CCardBody, CTable, CTableHead, CTableRow, CTableHeaderCell,
  CTableBody, CTableDataCell, CButton, CBadge, CSpinner, CAlert,
  CInputGroup, CInputGroupText, CFormInput, CFormTextarea, CRow, CCol, CForm, CFormLabel,
  CFormSelect, CModal, CModalHeader, CModalBody, CModalFooter, CModalTitle
} from '@coreui/react';
import { getRicetteFromTS, saveRicetta, ricettaApi } from '@/services/ricette_ts.service';
import type { Paziente } from '@/store/pazienti.store';

// Tipo per le ricette dal Sistema TS (aggiornato con i campi del tracciato ufficiale)
interface RicettaTS {
  id?: number;
  nre?: string;
  codice_pin?: string;
  pin_nrbe?: string;
  protocollo_transazione?: string;
  stato?: string;
  cf_assistito?: string;
  cogn_nome_assistito?: string;
  paziente_nome?: string;
  paziente_cognome?: string;
  data_compilazione?: string;
  prodotto_aic?: string;
  cod_prod_prest?: string;
  descr_prod_prest?: string;
  denominazione_farmaco?: string;
  posologia?: string;
  durata_trattamento?: string;
  note?: string;
  pdf_promemoria_b64?: string;
  num_iscrizione_albo?: string;
  cod_specializzazione?: string;
  cod_gruppo_equival?: string;
  // Nuovi campi dal tracciato ufficiale
  cf_medico?: string;
  nome_medico?: string;
  cognome_medico?: string;
  cod_diagnosi?: string;
  descr_diagnosi?: string;
  quantita?: string;
  data_inserimento?: string;
  dettagli_prescrizione?: Array<{
    cod_prod_prest?: string;
    descr_prod_prest?: string;
    quantita?: string;
    posologia?: string;
    durata_trattamento?: string;
    descr_testo_libero_note?: string;
    tdl?: string;
    non_sost?: string;
    modalita_impiego?: string;
    preparaz_farmaceutica?: string;
    num_ripetibilita?: string;
    validita_farm?: string;
    stato?: string;
  }>;
  source?: string;
}

// Tipo per l'analisi degli errori
interface ErrorAnalysis {
  has_errors: boolean;
  error_level: 'info' | 'warning' | 'error';
  error_messages: string[];
  suggested_actions: string[];
}

// Tipo per i metadati della risposta
interface MetadatiRisposta {
  protocollo_transazione?: string;
  data_ricezione?: string;
  cod_esito_visualizzazione?: string;
  cf_medico?: string;
  nome_medico?: string;
  cognome_medico?: string;
  cod_regione?: string;
  cod_asl?: string;
  cod_specializzazione?: string;
  codice_paziente?: string;
  cogn_nome?: string;
  indirizzo?: string;
  tipo_prescrizione?: string;
  cod_diagnosi?: string;
  descr_diagnosi?: string;
  data_compilazione?: string;
  nrbe?: string;
  pin_nrbe?: string;
  stato_processo?: string;
  data_inserimento?: string;
  errori_ricetta?: Array<{
    cod_esito?: string;
    esito?: string;
    identificativo_prod_prest?: string;
    tipo_errore?: string;
  }>;
  comunicazioni?: Array<{
    codice?: string;
    messaggio?: string;
  }>;
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
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysis | null>(null);
  const [metadatiRisposta, setMetadatiRisposta] = useState<MetadatiRisposta | null>(null);

  // Salvataggio nel DB locale e invio email
  const [savingId, setSavingId] = useState<string | null>(null);
  const [emailModalRicetta, setEmailModalRicetta] = useState<RicettaTS | null>(null);
  const [emailDestinatario, setEmailDestinatario] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

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
    return (
      ricetta.nre?.toLowerCase().includes(searchLower) ||
      ricetta.prodotto_aic?.toLowerCase().includes(searchLower) ||
      ricetta.denominazione_farmaco?.toLowerCase().includes(searchLower)
    );
  });

  // Rimuove trigger automatico - solo pulsante "Cerca"
  useEffect(() => {
    if (!pazienteSelezionato?.codice_fiscale) {
      setRicette([]);
      setError('');
      setServerResponse('');
      setErrorAnalysis(null);
      setMetadatiRisposta(null);
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
        cf_assistito: pazienteSelezionato.codice_fiscale,
      };
      
      if (filtri.dataDa) params.data_da = filtri.dataDa;
      if (filtri.dataA) params.data_a = filtri.dataA;
      if (filtri.nre) {
        params.nre = filtri.nre;
        params.test_ricerca_specifica = true;  // Attiva ricerca specifica per NRE
      }
      
      const response = await getRicetteFromTS(params);

      const xmlResponse = response.ts_response?.response_xml || 'Nessun XML disponibile';
      setServerResponse(formatXmlForDisplay(xmlResponse));
      setMetadatiRisposta(response.ts_response?.metadati_risposta || null);
      setErrorAnalysis(response.ts_response?.error_analysis || null);

      if (response.success) {
        setRicette(response.data || []);
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

  const handleStampaPDF = (ricetta: RicettaTS) => {
    if (!ricetta.pdf_promemoria_b64) {
      alert('❌ PDF non disponibile per questa ricetta');
      return;
    }

    try {
      const byteCharacters = atob(ricetta.pdf_promemoria_b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });

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

  const handleSalvaRicetta = async (ricetta: RicettaTS) => {
    if (!ricetta.nre || !pazienteSelezionato) return;
    setSavingId(ricetta.nre);
    try {
      const cognomeNomeParts = (ricetta.cogn_nome_assistito || '').trim().split(' ');
      const result = await saveRicetta({
        nre: ricetta.nre,
        codice_pin: ricetta.pin_nrbe || '',
        cf_medico: ricetta.cf_medico || '',
        medico_cognome: ricetta.cognome_medico || '',
        medico_nome: ricetta.nome_medico || '',
        specializzazione: ricetta.cod_specializzazione || '',
        nr_iscrizione_albo: ricetta.num_iscrizione_albo || '',
        cf_assistito: pazienteSelezionato.codice_fiscale || ricetta.cf_assistito || '',
        paziente_cognome: cognomeNomeParts[0] || pazienteSelezionato.nome,
        paziente_nome: cognomeNomeParts.slice(1).join(' ') || pazienteSelezionato.nome,
        data_compilazione: ricetta.data_compilazione || new Date().toISOString(),
        codice_diagnosi: ricetta.cod_diagnosi || '',
        descrizione_diagnosi: ricetta.descr_diagnosi || '',
        gruppo_equivalenza_farmaco: ricetta.cod_gruppo_equival || '',
        prodotto_aic: ricetta.cod_prod_prest || '',
        codice_farmaco: ricetta.cod_prod_prest || '',
        denominazione_farmaco: ricetta.descr_prod_prest || '',
        principio_attivo: ricetta.descr_prod_prest || '',
        posologia: ricetta.posologia || '',
        durata_trattamento: ricetta.durata_trattamento || '',
        response_xml: '',
        protocollo_transazione: ricetta.protocollo_transazione,
        pdf_base64: ricetta.pdf_promemoria_b64
      });

      if (result.success) {
        alert(`✅ Ricetta salvata nel database locale (ID: ${result.data?.ricetta_id})`);
      } else {
        alert(`❌ Salvataggio fallito: ${result.message}`);
      }
    } catch (error: any) {
      alert(`❌ Errore durante il salvataggio: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleApriEmailModal = (ricetta: RicettaTS) => {
    setEmailModalRicetta(ricetta);
    setEmailDestinatario(pazienteSelezionato?.email || '');
  };

  const handleInviaEmail = async () => {
    if (!emailModalRicetta || !emailDestinatario) {
      alert('Inserire un indirizzo email');
      return;
    }

    setEmailLoading(true);
    try {
      const result = await ricettaApi.inviaRicettaEmail({
        email_paziente: emailDestinatario,
        nome_paziente: pazienteSelezionato?.nome || 'Paziente',
        pdf_base64: emailModalRicetta.pdf_promemoria_b64 || '',
        nre: emailModalRicetta.nre
      });

      if (result.success) {
        alert(`✅ Email inviata a ${emailDestinatario}`);
        setEmailModalRicetta(null);
      } else {
        alert(`❌ Invio email fallito: ${result.message || result.error}`);
      }
    } catch (error: any) {
      alert(`❌ Errore durante l'invio dell'email: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setEmailLoading(false);
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

  const renderDettagliRicetta = (ricetta: RicettaTS) => {
    if (!ricetta.dettagli_prescrizione || ricetta.dettagli_prescrizione.length === 0) {
      return (
        <div className="text-muted">
          <small>Nessun dettaglio prescrizione disponibile</small>
        </div>
      );
    }

    return (
      <div className="mt-2">
        {ricetta.dettagli_prescrizione.map((dettaglio, index) => (
          <div key={index} className="border-start border-3 border-info ps-2 mb-2">
            <div className="fw-bold text-primary">
              {dettaglio.descr_prod_prest || 'Farmaco non specificato'}
            </div>
            <div className="small text-muted">
              <strong>AIC:</strong> {dettaglio.cod_prod_prest || '-'} | 
              <strong> Quantità:</strong> {dettaglio.quantita || '-'} | 
              <strong> TDL:</strong> {dettaglio.tdl === '1' ? 'Sì' : 'No'}
            </div>
            {dettaglio.posologia && (
              <div className="small">
                <strong>Posologia:</strong> {dettaglio.posologia}
              </div>
            )}
            {dettaglio.durata_trattamento && (
              <div className="small">
                <strong>Durata:</strong> {dettaglio.durata_trattamento}
              </div>
            )}
            {dettaglio.descr_testo_libero_note && (
              <div className="small text-info">
                <strong>Note:</strong> {dettaglio.descr_testo_libero_note}
              </div>
            )}
            {dettaglio.non_sost === '1' && (
              <div className="small text-warning">
                <strong>⚠️ Non sostituibile</strong>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderErrorAnalysis = () => {
    if (!errorAnalysis || !errorAnalysis.has_errors) return null;

    const alertColor = errorAnalysis.error_level === 'error' ? 'danger' : 
                      errorAnalysis.error_level === 'warning' ? 'warning' : 'info';

    return (
      <CAlert color={alertColor} className="mt-3">
        <strong>📋 Analisi Sistema TS</strong>
        <ul className="mb-2">
          {errorAnalysis.error_messages.map((msg, index) => (
            <li key={index}>{msg}</li>
          ))}
        </ul>
        {errorAnalysis.suggested_actions.length > 0 && (
          <div>
            <strong>Suggerimenti:</strong>
            <ul>
              {errorAnalysis.suggested_actions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </CAlert>
    );
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
                  <CCol md={3}>
                    <CFormLabel>📅 Data da</CFormLabel>
                    <CFormInput
                      type="date"
                      value={filtri.dataDa}
                      onChange={(e) => handleFiltriChange('dataDa', e.target.value)}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>📅 Data a</CFormLabel>
                    <CFormInput
                      type="date"
                      value={filtri.dataA}
                      onChange={(e) => handleFiltriChange('dataA', e.target.value)}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>🏷️ NRE specifico</CFormLabel>
                    <CFormInput
                      placeholder="Inserisci NRE..."
                      value={filtri.nre}
                      onChange={(e) => handleFiltriChange('nre', e.target.value)}
                    />
                  </CCol>
                  <CCol md={3} className="d-flex align-items-end">
                    <div>
                      <CButton color="primary" size="sm" onClick={handleCerca} className="me-2">
                        🔍 Cerca
                      </CButton>
                      <CButton color="secondary" size="sm" onClick={handleResetFiltri}>
                        🔄 Reset
                      </CButton>
                    </div>
                  </CCol>
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
                      <CTableHeaderCell>Medico</CTableHeaderCell>
                      <CTableHeaderCell>Azioni</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {ricetteFiltrate.map((ricetta, index) => (
                      <CTableRow key={ricetta.id || index}>
                        <CTableDataCell>
                          <small>{ricetta.data_compilazione ? formatData(ricetta.data_compilazione) : '-'}</small>
                          {ricetta.data_inserimento && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              Inserita: {formatData(ricetta.data_inserimento)}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <code>{ricetta.nre || '-'}</code>
                          {ricetta.codice_pin && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              PIN: {ricetta.codice_pin}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          {ricetta.stato ? getStatoBadge(ricetta.stato) : '-'}
                          {ricetta.source && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              {ricetta.source === 'sistema_ts_officiale' ? '📋 Ufficiale' : '🔍 Fallback'}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>
                            <strong>{ricetta.prodotto_aic || ricetta.denominazione_farmaco || '-'}</strong>
                            {ricetta.prodotto_aic && (
                              <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                AIC: {ricetta.prodotto_aic}
                              </div>
                            )}
                          </div>
                          {ricetta.quantita && (
                            <div className="text-info" style={{ fontSize: '0.7rem' }}>
                              Qty: {ricetta.quantita}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <small className="text-muted">
                            {ricetta.posologia || '-'}<br />
                            {ricetta.durata_trattamento || '-'}
                          </small>
                          {ricetta.note && (
                            <div className="text-info" style={{ fontSize: '0.7rem' }}>
                              Note: {ricetta.note}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <small>
                            {ricetta.nome_medico && ricetta.cognome_medico ? 
                              `${ricetta.cognome_medico} ${ricetta.nome_medico}` : 
                              ricetta.cf_medico || '-'}
                          </small>
                          {ricetta.cod_diagnosi && (
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                              Dx: {ricetta.cod_diagnosi}
                            </div>
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex flex-column gap-1">
                            {ricetta.pdf_promemoria_b64 && (
                              <CButton
                                color="info"
                                size="sm"
                                onClick={() => handleStampaPDF(ricetta)}
                                title="Scarica PDF"
                              >
                                🖨️
                              </CButton>
                            )}
                            {ricetta.nre && (
                              <CButton
                                color="warning"
                                size="sm"
                                onClick={() => handleSalvaRicetta(ricetta)}
                                disabled={savingId === ricetta.nre}
                                title="Salva nel database locale"
                              >
                                {savingId === ricetta.nre ? <CSpinner size="sm" /> : '💾'}
                              </CButton>
                            )}
                            {ricetta.pdf_promemoria_b64 && (
                              <CButton
                                color="primary"
                                size="sm"
                                onClick={() => handleApriEmailModal(ricetta)}
                                title="Invia via email"
                              >
                                📧
                              </CButton>
                            )}
                            {ricetta.dettagli_prescrizione && ricetta.dettagli_prescrizione.length > 0 && (
                              <CButton 
                                color="secondary" 
                                size="sm"
                                onClick={() => {
                                  // toggle dettagli: da implementare
                                }}
                                title="Mostra dettagli"
                              >
                                📋
                              </CButton>
                            )}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}

              {/* Analisi Errori Sistema TS */}
              {renderErrorAnalysis()}

              {/* Metadati Risposta (se disponibili) */}
              {metadatiRisposta && (
                <CRow className="mt-3">
                  <CCol>
                    <CAlert color="info">
                      <strong>📊 Metadati Sistema TS</strong>
                      <div className="mt-2">
                        <small>
                          <strong>Protocollo:</strong> {metadatiRisposta.protocollo_transazione || '-'} | 
                          <strong> Esito:</strong> {metadatiRisposta.cod_esito_visualizzazione || '-'} | 
                          <strong> Data ricezione:</strong> {metadatiRisposta.data_ricezione ? formatData(metadatiRisposta.data_ricezione) : '-'}
                        </small>
                        {metadatiRisposta.nome_medico && metadatiRisposta.cognome_medico && (
                          <div className="mt-1">
                            <small>
                              <strong>Medico:</strong> {metadatiRisposta.cognome_medico} {metadatiRisposta.nome_medico} 
                              ({metadatiRisposta.cf_medico}) | 
                              <strong> Regione:</strong> {metadatiRisposta.cod_regione} | 
                              <strong> ASL:</strong> {metadatiRisposta.cod_asl}
                            </small>
                          </div>
                        )}
                        {metadatiRisposta.cod_diagnosi && (
                          <div className="mt-1">
                            <small>
                              <strong>Diagnosi:</strong> {metadatiRisposta.cod_diagnosi} - {metadatiRisposta.descr_diagnosi}
                            </small>
                          </div>
                        )}
                      </div>
                    </CAlert>
                  </CCol>
                </CRow>
              )}

              {/* Risposta del Server per Debug */}
              {serverResponse && (
                <CRow className="mt-4">
                  <CCol>
                    <CAlert color="info">
                      <strong>📋 XML Sistema TS (Debug)</strong>
                    </CAlert>
                    <CFormTextarea
                      rows={25}
                      value={serverResponse}
                      readOnly
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
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

      {/* Modal invio email */}
      <CModal visible={!!emailModalRicetta} onClose={() => setEmailModalRicetta(null)}>
        <CModalHeader>
          <CModalTitle>📧 Invia ricetta via email</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Email paziente</CFormLabel>
              <CFormInput
                type="email"
                value={emailDestinatario}
                onChange={(e) => setEmailDestinatario(e.target.value)}
                placeholder="email@esempio.com"
              />
              {!pazienteSelezionato?.email && (
                <small className="text-muted">
                  Il paziente non ha un'email in archivio: inseriscila manualmente.
                </small>
              )}
            </div>
            {emailModalRicetta && (
              <CAlert color="info">
                <strong>Ricetta:</strong> NRE {emailModalRicetta.nre}<br/>
                PIN: {emailModalRicetta.pin_nrbe}
              </CAlert>
            )}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setEmailModalRicetta(null)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={handleInviaEmail} disabled={emailLoading || !emailDestinatario}>
            {emailLoading ? <CSpinner size="sm" className="me-2" /> : '📧'}
            Invia Email
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default RicetteTSPaziente;