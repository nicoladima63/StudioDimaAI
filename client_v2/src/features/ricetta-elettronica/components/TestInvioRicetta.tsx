import React, { useState } from 'react';
import {
  CCard, CCardBody, CButton, CForm, CFormInput, CFormLabel, 
  CFormTextarea, CRow, CCol, CAlert, CSpinner, CBadge,
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle
} from '@coreui/react';
import ricettaApi from "@/services/api/ricetta.service";
import type { RicettaPayload } from '@/types/ricetta.types';

// Tipo per EmailRicettaPayload (da definire meglio in types)
interface EmailRicettaPayload {
  email_paziente: string;
  nome_paziente: string;
  ricetta_data: any;
  pdf_base64: string;
}

const TestInvioRicetta: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailData, setEmailData] = useState({
    email: '',
    nome: 'Maria Prandi' // Nome test di default
  });


  // Dati hardcodati per ambiente TEST del Ministero - CODICI VALIDI UFFICIALI
  const [datiTest, setDatiTest] = useState({
    // CF assistito test ufficiale dal kit Ministero (assistitoTest.txt)
    cfAssistito: 'PNIMRA70A01H501P',
    nomeAssistito: 'MARIA',
    cognomeAssistito: 'PRANDI',
    
    // Diagnosi test - CODICE UFFICIALE dal SoapUI del kit Ministero
    codiceDiagnosi: '521.09',
    descrizioneDiagnosi: 'CARIE DENTALE',
    
    codiceFarmaco: '046580015',
    denominazioneFarmaco: 'AMOXICILLINA AC CLA ALM*12BUST',
    principioAttivo: 'Amoxicillina + Acido Clavulanico',
    
    // Terapia
    posologia: '1 bustina ogni 8 ore',
    durata: '6 giorni',
    note: 'Assumere durante i pasti'
  });

  const handleTestInvio = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    // Payload test con dati ufficiali ambiente test
    const payload: RicettaPayload = {
      medico: {
        cfMedico: 'PROVAX00X00X000Y',  // CF medico test ufficiale
        regione: '020',
        asl: '201', 
        specializzazione: 'F',
        iscrizione: '591',
        indirizzo: 'Via Test 123',
        telefono: '0123456789',
        cap: '00100',
        citta: 'Roma',
        provincia: 'RM'
      },
      paziente: {
        id: 'test_paziente',
        nome: datiTest.nomeAssistito,
        cognome: datiTest.cognomeAssistito,
        codiceFiscale: datiTest.cfAssistito,
        indirizzo: 'Via Prova 456',
        cap: '00100',
        citta: 'Roma',
        provincia: 'RM'
      },
      diagnosi: {
        codice: datiTest.codiceDiagnosi,
        descrizione: datiTest.descrizioneDiagnosi
      },
      farmaco: {
        codice: datiTest.codiceFarmaco,
        principio_attivo: datiTest.principioAttivo,
        descrizione: datiTest.denominazioneFarmaco
      },
      posologia: datiTest.posologia,
      durata: datiTest.durata,
      note: datiTest.note
    };

    try {
      const result = await ricettaApi.inviaRicetta(payload);
      setResponse(result);
    } catch (err: any) {
      console.error('Errore test invio:', err);
      setError(err.message || 'Errore durante il test di invio');
    } finally {
      setLoading(false);
    }
  };

  const analyzeResponse = () => {
    if (!response?.data?.response_xml) return null;

    const xml = response.data.response_xml;
    
    // Analizza elementi chiave dalla response
    const protocolloMatch = xml.match(/<protocolloTransazione>([^<]+)<\/protocolloTransazione>/);
    const codEsitoMatch = xml.match(/<codEsitoInserimento>([^<]+)<\/codEsitoInserimento>/);
    const erroreMatch = xml.match(/<ns2:codEsito>([^<]+)<\/ns2:codEsito>/);
    const descrizioneErroreMatch = xml.match(/<ns2:esito>([^<]+)<\/ns2:esito>/);

    return {
      protocolloTransazione: protocolloMatch?.[1],
      codiceEsito: codEsitoMatch?.[1],
      codiceErrore: erroreMatch?.[1],
      descrizioneErrore: descrizioneErroreMatch?.[1]
    };
  };

  const analisi = response ? analyzeResponse() : null;

  const downloadPDF = (pdfBase64: string) => {
    try {
      // Converti base64 in blob
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Crea URL temporaneo e avvia download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ricetta_${response?.data?.nre || 'test'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download PDF:', error);
      alert('Errore durante il download del PDF');
    }
  };

  const handleSendEmail = async () => {
    if (!emailData.email || !emailData.nome) {
      alert('Inserire email e nome paziente');
      return;
    }

    setEmailLoading(true);
    
    try {
      const emailPayload: EmailRicettaPayload = {
        email_paziente: emailData.email,
        nome_paziente: emailData.nome,
        ricetta_data: response.data,
        pdf_base64: response.data.pdf_promemoria_b64
      };

      // TODO: Implementare inviaRicettaEmail nel service
      console.log('Email payload:', emailPayload);
      alert('Funzione email da implementare');
      setShowEmailModal(false);

    } catch (error: any) {
      console.error('Errore invio email:', error);
      alert(`Errore durante l'invio dell'email: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setEmailLoading(false);
    }
  };


  return (
    <div>
      <CRow>
        <CCol md={6}>
          <CCard>
            <CCardBody>
              <h5>🧪 Test Invio Ricetta V2</h5>
              <p className="text-muted">Dati preconfigurati per ambiente test Ministero</p>
              
              <CForm>
                <div className="mb-3">
                  <CFormLabel>CF Assistito (Test)</CFormLabel>
                  <CFormInput
                    value={datiTest.cfAssistito}
                    onChange={(e) => setDatiTest({...datiTest, cfAssistito: e.target.value})}
                  />
                  <small className="text-muted">CF ufficiale ambiente test</small>
                </div>

                <div className="mb-3">
                  <CFormLabel>Nome e Cognome</CFormLabel>
                  <CRow>
                    <CCol>
                      <CFormInput
                        value={datiTest.nomeAssistito}
                        onChange={(e) => setDatiTest({...datiTest, nomeAssistito: e.target.value})}
                        placeholder="Nome"
                      />
                    </CCol>
                    <CCol>
                      <CFormInput
                        value={datiTest.cognomeAssistito}
                        onChange={(e) => setDatiTest({...datiTest, cognomeAssistito: e.target.value})}
                        placeholder="Cognome"
                      />
                    </CCol>
                  </CRow>
                </div>

                <div className="mb-3">
                  <CFormLabel>Diagnosi</CFormLabel>
                  <CFormInput
                    value={`${datiTest.codiceDiagnosi} - ${datiTest.descrizioneDiagnosi}`}
                    onChange={(e) => {
                      const [codice, ...resto] = e.target.value.split(' - ');
                      setDatiTest({
                        ...datiTest, 
                        codiceDiagnosi: codice || '',
                        descrizioneDiagnosi: resto.join(' - ') || ''
                      });
                    }}
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Farmaco</CFormLabel>
                  <CFormInput
                    value={`${datiTest.codiceFarmaco} - ${datiTest.denominazioneFarmaco}`}
                    onChange={(e) => {
                      const [codice, ...resto] = e.target.value.split(' - ');
                      setDatiTest({
                        ...datiTest,
                        codiceFarmaco: codice || '',
                        denominazioneFarmaco: resto.join(' - ') || ''
                      });
                    }}
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Posologia</CFormLabel>
                  <CFormInput
                    value={datiTest.posologia}
                    onChange={(e) => setDatiTest({...datiTest, posologia: e.target.value})}
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Durata</CFormLabel>
                  <CFormInput
                    value={datiTest.durata}
                    onChange={(e) => setDatiTest({...datiTest, durata: e.target.value})}
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Note</CFormLabel>
                  <CFormTextarea
                    value={datiTest.note}
                    onChange={(e) => setDatiTest({...datiTest, note: e.target.value})}
                    rows={2}
                  />
                </div>

                <CButton 
                  color="primary" 
                  onClick={handleTestInvio} 
                  disabled={loading}
                  className="w-100"
                >
                  {loading ? <CSpinner size="sm" className="me-2" /> : '🧪'} 
                  Test Invio Ricetta V2
                </CButton>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={6}>
          <CCard>
            <CCardBody>
              <h5>📋 Risposta Sistema TS</h5>
              
              {error && (
                <CAlert color="danger">
                  <strong>Errore:</strong> {error}
                </CAlert>
              )}

              {response && (
                <div>
                  {/* Analisi rapida */}
                  {analisi && (
                    <div className="mb-3">
                      <h6>📊 Analisi Risposta:</h6>
                      <p><strong>Protocollo:</strong> {analisi.protocolloTransazione || 'N/A'}</p>
                      <p><strong>Codice Esito:</strong> 
                        <CBadge color={analisi.codiceEsito === '0000' ? 'success' : 'danger'} className="ms-1">
                          {analisi.codiceEsito}
                        </CBadge>
                      </p>
                      {analisi.codiceErrore && (
                        <p><strong>Errore:</strong> 
                          <CBadge color="warning" className="ms-1">{analisi.codiceErrore}</CBadge>
                          <br />
                          <small>{analisi.descrizioneErrore}</small>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Dati estratti */}
                  {response.data && (
                    <div className="mb-3">
                      <h6>🔍 Dati Estratti:</h6>
                      <p><strong>NRE:</strong> {response.data.nre || '❌ Non trovato'}</p>
                      <p><strong>PIN:</strong> {response.data.pin_ricetta || '❌ Non trovato'}</p>
                      <p><strong>Transazione:</strong> {response.data.protocollo_transazione || '❌ Non trovato'}</p>
                      <p><strong>Data:</strong> {response.data.data_inserimento || '❌ Non trovata'}</p>
                      <p><strong>Medico:</strong> {response.data.nome_medico} {response.data.cognome_medico}</p>
                      <p><strong>PDF Ricetta:</strong> 
                        {response.data.pdf_disponibile ? (
                          <div className="d-inline-block">
                            <CButton 
                              size="sm" 
                              color="success" 
                              className="ms-2 me-2"
                              onClick={() => downloadPDF(response.data.pdf_promemoria_b64)}
                            >
                              📄 Scarica PDF
                            </CButton>
                            <CButton 
                              size="sm" 
                              color="primary" 
                              className="me-2"
                              onClick={() => setShowEmailModal(true)}
                            >
                              📧 Invia Email
                            </CButton>
                          </div>
                        ) : '❌ Non disponibile'}
                      </p>
                    </div>
                  )}

                  {/* XML completo */}
                  <div>
                    <h6>📄 XML Risposta Completa:</h6>
                    <CFormTextarea
                      value={response.data?.response_xml || JSON.stringify(response, null, 2)}
                      rows={12}
                      readOnly
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {!response && !error && (
                <p className="text-muted text-center">
                  Clicca "Test Invio Ricetta V2" per vedere la risposta del sistema
                </p>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Modal per invio email */}
      <CModal visible={showEmailModal} onClose={() => setShowEmailModal(false)}>
        <CModalHeader>
          <CModalTitle>📧 Invia Ricetta via Email</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Nome Paziente</CFormLabel>
              <CFormInput
                value={emailData.nome}
                onChange={(e) => setEmailData({...emailData, nome: e.target.value})}
                placeholder="Nome del paziente"
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Email Paziente</CFormLabel>
              <CFormInput
                type="email"
                value={emailData.email}
                onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                placeholder="email@esempio.com"
              />
            </div>
            {response?.data && (
              <div className="mb-3">
                <CAlert color="info">
                  <strong>Ricetta da inviare:</strong><br/>
                  NRE: {response.data.nre}<br/>
                  PIN: {response.data.pin_ricetta}<br/>
                  Farmaco: {response.data.denominazione_farmaco || 'AMOXICILLINA AC CLA ALM*12BUST'}
                </CAlert>
              </div>
            )}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowEmailModal(false)}>
            Annulla
          </CButton>
          <CButton 
            color="primary" 
            onClick={handleSendEmail}
            disabled={emailLoading || !emailData.email || !emailData.nome}
          >
            {emailLoading ? <CSpinner size="sm" className="me-2" /> : '📧'}
            Invia Email
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default TestInvioRicetta;
