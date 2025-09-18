import { useState, useEffect } from "react";
import { 
  CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CFormSelect,
  CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, 
  CCardBody, CSpinner, CBadge
} from '@coreui/react';
import ricettaApi, {
  getDiagnosiDisponibili,
  getFarmaciPerDiagnosi, 
  getDurateStandard,
  getNoteFrequenti,
  saveRicetta,
  type FarmacoProtocollo} from '@/services/ricette_ts.service';
import  type {Diagnosi, RicettaInvioPayload}  from '@/types/ricetta.types';
import type { Paziente } from '@/store/pazienti.store';

interface DatiMedico {
  regione: string;
  regioneOrdine: string;
  ambito: string;
  specializzazione: string;
  iscrizione: string;
  indirizzo: string;
  telefono: string;
  cap: string;
  citta: string;
  provincia: string;
  asl: string;
  cfMedico: string;
}

interface RicettaAvanzataProps {
  datiMedico: DatiMedico;
  pazienteSelezionato: Paziente | null;
}

export default function RicettaAvanzata({ datiMedico, pazienteSelezionato }: RicettaAvanzataProps) {

  // Diagnosi e farmaci
  const [diagnosiDisponibili, setDiagnosiDisponibili] = useState<Diagnosi[]>([]);
  const [diagnosiSelezionata, setDiagnosiSelezionata] = useState<Diagnosi | null>(null);
  const [farmaciDisponibili, setFarmaciDisponibili] = useState<FarmacoProtocollo[]>([]);
  const [farmacoSelezionato, setFarmacoSelezionato] = useState<FarmacoProtocollo | null>(null);

  // Posologie e durate
  const [posologia, setPosologia] = useState("");
  const [durateStandard, setDurateStandard] = useState<string[]>([]);
  const [durata, setDurata] = useState("");
  const [noteFrequenti, setNoteFrequenti] = useState<string[]>([]);
  const [note, setNote] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [showConferma, setShowConferma] = useState(false);
  const [autoMode] = useState(true);
  const [tsResponse, setTsResponse] = useState<any>(null);

  // Carica dati iniziali
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carica diagnosi, durate e note
        const [diagnosi, durate, noteFreq] = await Promise.all([
          getDiagnosiDisponibili(),
          getDurateStandard(), 
          getNoteFrequenti()
        ]);

        setDiagnosiDisponibili(diagnosi.data || []);
        setDurateStandard(durate.data || []);
        setNoteFrequenti(noteFreq.data || []);
      } catch (error) {
        console.error('Errore caricamento dati:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Quando cambia la diagnosi, carica farmaci
  useEffect(() => {
    if (diagnosiSelezionata && autoMode) {
      const loadFarmaci = async () => {
        try {
          const response = await getFarmaciPerDiagnosi(diagnosiSelezionata.id);
          const farmaci = response.data || [];
          setFarmaciDisponibili(farmaci);
          
          // Auto-seleziona primo farmaco SOLO se disponibile
          if (farmaci.length > 0) {
            const primoFarmaco = farmaci[0];
            setFarmacoSelezionato(primoFarmaco);
            setPosologia(primoFarmaco.posologia_default || '');
            setDurata(primoFarmaco.durata_default || '');
            setNote(primoFarmaco.note_default || '');
          } else {
            // Reset se nessun farmaco disponibile
            setFarmacoSelezionato(null);
            setPosologia('');
            setDurata('');
            setNote('');
          }
        } catch (error) {
          console.error('Errore caricamento farmaci:', error);
          setFarmaciDisponibili([]);
          setFarmacoSelezionato(null);
        }
      };

      loadFarmaci();
    }
  }, [diagnosiSelezionata, autoMode]);



  const handleDiagnosiChange = (diagnosiId: string) => {
    const diagnosi = diagnosiDisponibili.find(d => d.id === parseInt(diagnosiId));
    setDiagnosiSelezionata(diagnosi || null);
    
    // Reset farmaco
    setFarmacoSelezionato(null);
    setFarmaciDisponibili([]);
    setPosologia("");
    setDurata("");
    setNote("");
  };

  const handleFarmacoChange = (farmacoId: string) => {
    const farmaco = farmaciDisponibili.find(f => f.codice === farmacoId);
    setFarmacoSelezionato(farmaco || null);
    
    if (farmaco && autoMode) {
      setPosologia(farmaco.posologia_default || '');
      setDurata(farmaco.durata_default || '');
      setNote(farmaco.note_default || '');
    } else if (!farmaco) {
      // Reset se nessun farmaco selezionato
      setPosologia('');
      setDurata('');
      setNote('');
    }
  };

  const handleInvia = () => {
    // Validazione rapida per abilitare il modal
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato || !posologia.trim() || !durata.trim()) {
      alert("❌ Compila tutti i campi obbligatori prima di procedere.");
      return;
    }
    setShowConferma(true);
  };

  const confermaInvio = async () => {
    // VALIDAZIONE COMPLETA - ERRORE VINCOLANTE
    if (!pazienteSelezionato) {
      alert("❌ ERRORE: Nessun paziente selezionato!");
      return;
    }
    
    if (!pazienteSelezionato.codice_fiscale) {
      alert("❌ ERRORE: Il paziente deve avere un codice fiscale per inviare la ricetta!");
      return;
    }
    
    if (!diagnosiSelezionata) {
      alert("❌ ERRORE: Seleziona una diagnosi!");
      return;
    }
    
    if (!farmacoSelezionato) {
      alert("❌ ERRORE: Seleziona un farmaco!");
      return;
    }
    
    if (!posologia.trim()) {
      alert("❌ ERRORE: Inserisci la posologia!");
      return;
    }
    
    if (!durata.trim()) {
      alert("❌ ERRORE: Inserisci la durata del trattamento!");
      return;
    }

    // Payload aggiornato per la nuova funzione invio_ricetta
    const payload: RicettaInvioPayload = {
      // CF assistito (necessario per la funzione)
      cf_assistito: pazienteSelezionato.codice_fiscale!, // ERRORE VINCOLANTE: CF obbligatorio
      
      // Campi obbligatori per invio_ricetta - VALIDATI
      cognome_nome: pazienteSelezionato.nome.trim(),
      indirizzo: `${pazienteSelezionato.indirizzo || ''}|${pazienteSelezionato.cap || ''}|${pazienteSelezionato.citta || ''}|${pazienteSelezionato.provincia || ''}`,
      cod_diagnosi: diagnosiSelezionata.codice,
      descr_diagnosi: diagnosiSelezionata.descrizione,
      prescrizioni: [{
        cod_prodotto: farmacoSelezionato.codice,
        descrizione: farmacoSelezionato.nome,
        quantita: '1', // Default quantità
        posologia: posologia,
        note: note || '',
        tdl: '0' // Default: non terapia del dolore
      }],
      
      // Campi opzionali con valori dal medico
      cod_regione: datiMedico.regione,
      cod_asl: datiMedico.asl,
      specializzazione: datiMedico.specializzazione,
      num_iscrizione_albo: datiMedico.iscrizione,
      indirizzo_medico: `${datiMedico.indirizzo}|${datiMedico.cap}|${datiMedico.citta}|${datiMedico.provincia}`,
      telefono_medico: `+39|${datiMedico.telefono}`,
      tipo_prescrizione: 'F'
    };

    try {
      const response = await ricettaApi.inviaRicetta(payload);
      console.log('Risposta Sistema TS:', response);
      // Salva la risposta del Sistema TS per debug
      setTsResponse(response);
      
      if (response.success && response.data) {
        const { nre, pin_ricetta, protocollo_transazione, nome_medico, cognome_medico, data_inserimento, pdf_promemoria_b64 } = response.data;
        
        // ✅ SUCCESSO: Mostra i dati ricevuti dal Sistema TS
        if (nre && pin_ricetta) {
          // SOLO SE NRE E PIN SONO PRESENTI: salva la ricetta nel database locale
          try {
            const ricettaData = {
              nre: nre,
              codice_pin: pin_ricetta,
              cf_medico: datiMedico.cfMedico,
              medico_cognome: cognome_medico || 'N/A',
              medico_nome: nome_medico || 'N/A', 
              specializzazione: datiMedico.specializzazione,
              nr_iscrizione_albo: datiMedico.iscrizione,
              cf_assistito: pazienteSelezionato.codice_fiscale,
              paziente_cognome: pazienteSelezionato.nome.split(' ')[0] || 'N/A',
              paziente_nome: pazienteSelezionato.nome,
              data_compilazione: data_inserimento || new Date().toISOString(),
              codice_diagnosi: diagnosiSelezionata.codice,
              descrizione_diagnosi: diagnosiSelezionata.descrizione,
              gruppo_equivalenza_farmaco: 'EQUIVALENTE_01', // Campo obbligatorio
              prodotto_aic: farmacoSelezionato.codice, // Usa codice farmaco come AIC
              codice_farmaco: farmacoSelezionato.codice,
              denominazione_farmaco: farmacoSelezionato.nome,
              principio_attivo: farmacoSelezionato.principio_attivo,
              posologia: posologia,
              durata_trattamento: durata,
              response_xml: '', // XML rimosso per risparmiare spazio - ricette recuperabili da Sistema TS
              note: note.trim() || '',
              protocollo_transazione: protocollo_transazione || undefined,
              pdf_base64: pdf_promemoria_b64 || undefined
            };
            
            const saveResult = await saveRicetta(ricettaData);
            if (saveResult.success) {
              console.log(`✅ Ricetta salvata nel database con ID: ${saveResult.data?.ricetta_id}`);
            } else {
              console.warn(`⚠️ Avviso salvataggio: ${saveResult.message}`);
            }
          } catch (saveError) {
            console.warn("⚠️ Avviso: ricetta inviata ma non salvata nel database locale:", saveError);
          }
          
          alert(`✅ Ricetta inviata e salvata con successo!\n\n📋 NRE: ${nre}\n🔑 PIN: ${pin_ricetta}${protocollo_transazione ? `\n🔗 Protocollo: ${protocollo_transazione}` : ''}\n\nConserva questi dati per eventuali annullamenti.`);
        } else {
          // ❌ RISPOSTA SENZA NRE/PIN: non salvare, solo mostrare
          alert("⚠️ Ricetta inviata al Sistema TS ma senza NRE/PIN. Controlla la risposta per dettagli.");
        }
      } else {
        // ❌ ERRORE: Mostra il vero errore invece di successo falso
        alert(`❌ Errore invio ricetta:\n\n${response.error || 'Errore sconosciuto'}\n\n${response.message || 'Nessun dettaglio disponibile'}\n\nControlla la sezione "Risposta Sistema TS" qui sotto per l'XML completo.`);
        setShowConferma(false);
        return; // Non resettare il form in caso di errore
      }
      
      setShowConferma(false);
      
      // Reset form SOLO dopo invio riuscito
      setDiagnosiSelezionata(null);
      setFarmacoSelezionato(null);
      setPosologia("");
      setDurata("");
      setNote("");
      
    } catch (err) {
      console.error("Errore invio ricetta:", err);
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      // Salva anche gli errori per debug
      setTsResponse({ success: false, error: 'NETWORK_ERROR', message: errorMessage, details: err });
      alert(`❌ Errore durante l'invio della ricetta: ${errorMessage}`);
      setShowConferma(false);
      // Non resettare il form in caso di errore di rete
    }
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <CSpinner color="primary" />
        <p>Caricamento protocolli terapeutici...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Messaggio se nessun paziente */}
      {!pazienteSelezionato ? (
        <CCard>
          <CCardBody className="text-center py-5">
            <h5 className="text-muted">👤 Nessun paziente selezionato</h5>
            <p className="text-muted">
              Seleziona un paziente utilizzando la ricerca in alto per compilare una ricetta.
            </p>
          </CCardBody>
        </CCard>
      ) : (
        <CRow>
          {/* Dati paziente selezionato */}
          <CCol md={4}>
            <CCard>
              <CCardBody>
                <h5 className="mb-3">👤 Paziente Selezionato</h5>
                <div className="small">
                  <div><strong>Nome:</strong> {pazienteSelezionato.nome}</div>
                  <div><strong>CF:</strong> {pazienteSelezionato.codice_fiscale || '❌ MANCANTE'}</div>
                  <div><strong>Indirizzo:</strong> {pazienteSelezionato.indirizzo || '❌ MANCANTE'}</div>
                </div>
              </CCardBody>
            </CCard>
            
            {/* Risposta Sistema TS */}
            {tsResponse && (
              <CCard className="mt-3">
                <CCardBody>
                  <h6 className="mb-3">🔍 Risposta Sistema TS</h6>
                  <div className="small">
                    <div><strong>Success:</strong> 
                      <span className={tsResponse.success ? 'text-success' : 'text-danger'}>
                        {tsResponse.success ? ' ✅' : ' ❌'}
                      </span>
                    </div>
                    {tsResponse.error && (
                      <div><strong>Error:</strong> <span className="text-danger">{tsResponse.error}</span></div>
                    )}
                    {tsResponse.message && (
                      <div><strong>Message:</strong> {tsResponse.message}</div>
                    )}
                    {/* XML Response - SEMPRE VISIBILE */}
                    <div className="mt-2">
                      <strong>XML Response:</strong>
                      <pre className="small bg-light p-3 mt-1" style={{maxHeight: '500px', overflow: 'auto', fontSize: '12px', lineHeight: '1.4'}}>
                        {tsResponse.response_xml ? 
                          tsResponse.response_xml
                            .replace(/></g, '>\n<')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                          : 'Nessun XML disponibile'
                        }
                      </pre>
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            )}
          </CCol>

          {/* Form ricetta */}
          <CCol md={8}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">📋 Protocollo Terapeutico</h5>
            
            <CForm>
                {/* Diagnosi */}
                <div className="mb-3">
                  <CFormLabel>🩺 Diagnosi</CFormLabel>
                  <CFormSelect
                    value={diagnosiSelezionata?.id || ''}
                    onChange={(e) => handleDiagnosiChange(e.target.value)}
                  >
                    <option value="">Seleziona diagnosi...</option>
                    {diagnosiDisponibili && diagnosiDisponibili.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.codice} - {d.descrizione}
                      </option>
                    ))}
                  </CFormSelect>
                </div>

                {/* Farmaco */}
                <div className="mb-3">
                  <CFormLabel>💊 Farmaco</CFormLabel>
                  <CFormSelect
                    value={farmacoSelezionato?.codice || ''}
                    onChange={(e) => handleFarmacoChange(e.target.value)}
                    disabled={!diagnosiSelezionata || farmaciDisponibili.length === 0}
                  >
                    <option value="">
                      {!diagnosiSelezionata ? "Prima seleziona una diagnosi" : 
                       farmaciDisponibili.length === 0 ? "Nessun farmaco disponibile" : 
                       "Seleziona farmaco..."}
                    </option>
                    {farmaciDisponibili.map(f => (
                      <option key={f.codice} value={f.codice}>
                        {f.nome} - {f.principio_attivo} ({f.classe})
                      </option>
                    ))}
                  </CFormSelect>
                  
                  {farmacoSelezionato && (
                    <small className="text-muted d-block mt-1">
                      Codice: {farmacoSelezionato.codice} | Classe: {farmacoSelezionato.classe}
                    </small>
                  )}
                </div>

                {/* Posologia */}
                <div className="mb-3">
                  <CFormLabel>⏰ Posologia</CFormLabel>
                  <CFormInput
                    value={posologia}
                    onChange={(e) => setPosologia(e.target.value)}
                    placeholder={!farmacoSelezionato ? "Prima seleziona un farmaco" : "es. 1 compressa ogni 8 ore"}
                    disabled={!farmacoSelezionato}
                  />
                </div>

                {/* Durata */}
                <div className="mb-3">
                  <CFormLabel>📅 Durata</CFormLabel>
                  {autoMode ? (
                    <CFormSelect
                      value={durata}
                      onChange={(e) => setDurata(e.target.value)}
                      disabled={!farmacoSelezionato}
                    >
                      <option value="">
                        {!farmacoSelezionato ? "Prima seleziona un farmaco" : "Seleziona durata..."}
                      </option>
                      {durateStandard.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </CFormSelect>
                  ) : (
                    <CFormInput
                      value={durata}
                      onChange={(e) => setDurata(e.target.value)}
                      placeholder={!farmacoSelezionato ? "Prima seleziona un farmaco" : "es. 5 giorni"}
                      disabled={!farmacoSelezionato}
                    />
                  )}
                </div>

                {/* Note */}
                <div className="mb-3">
                  <CFormLabel>📝 Note</CFormLabel>
                  {autoMode && noteFrequenti.length > 0 ? (
                    <div>
                      <CFormTextarea 
                        value={note} 
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder={!farmacoSelezionato ? "Prima seleziona un farmaco" : "Note aggiuntive..."}
                        disabled={!farmacoSelezionato}
                      />
                      <div className="mt-2">
                        <small className="text-muted">Note frequenti:</small>
                        <div className="mt-1">
                          {noteFrequenti.slice(0, 3).map(n => (
                            <CBadge 
                              key={n}
                              color="light" 
                              className="me-1 mb-1 cursor-pointer"
                              onClick={() => setNote(note + (note ? '. ' : '') + n)}
                            >
                              + {n}
                            </CBadge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <CFormTextarea 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="Note aggiuntive..."
                    />
                  )}
                </div>

                <CButton 
                  color="primary" 
                  onClick={handleInvia}
                  disabled={!diagnosiSelezionata || !farmacoSelezionato || !posologia || !durata}
                >
                  📤 Invia Ricetta
                </CButton>
              </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
    )}

      {/* Modal conferma */}
      <CModal visible={showConferma} onClose={() => setShowConferma(false)} size="lg">
        <CModalHeader>
          <h4>📋 Conferma Invio Ricetta</h4>
        </CModalHeader>
        <CModalBody>
          <div className="row">
            <div className="col-md-6">
              <h6>👤 Paziente</h6>
              <p><strong>{pazienteSelezionato?.nome}</strong><br/>
              CF: {pazienteSelezionato?.codice_fiscale}</p>
              
              <h6>🩺 Diagnosi</h6>
              <p><strong>{diagnosiSelezionata?.codice}</strong><br/>
              {diagnosiSelezionata?.descrizione}</p>
            </div>
            <div className="col-md-6">
              <h6>💊 Farmaco</h6>
              <p><strong>{farmacoSelezionato?.nome}</strong><br/>
              {farmacoSelezionato?.principio_attivo}<br/>
              <small>Codice: {farmacoSelezionato?.codice}</small></p>
              
              <h6>⏰ Terapia</h6>
              <p><strong>Posologia:</strong> {posologia}<br/>
              <strong>Durata:</strong> {durata}</p>
            </div>
          </div>
          
          {note && (
            <div>
              <h6>📝 Note</h6>
              <p>{note}</p>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowConferma(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={confermaInvio}>
            ✅ Conferma Invio
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
}