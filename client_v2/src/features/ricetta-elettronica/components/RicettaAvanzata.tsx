import { useState, useEffect } from "react";
import { 
  CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CFormSelect,
  CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, 
  CCardBody, CSpinner, CBadge
} from '@coreui/react';
import {
  getDiagnosiDisponibili,
  getFarmaciPerDiagnosi,
  getFarmaciCommerciali,
  getDurateStandard,
  getNoteFrequenti,
  inviaRicetta,
  saveRicetta,
  type FarmacoProtocollo,
  type ProdottoCommerciale} from '@/services/ricette_ts.service';
import  type {Diagnosi, RicettaPayload}  from '@/types/ricetta.types';
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

  // Prodotti commerciali (AIC) per il principio attivo selezionato
  const [prodottiCommerciali, setProdottiCommerciali] = useState<ProdottoCommerciale[]>([]);
  const [prodottoSelezionato, setProdottoSelezionato] = useState<ProdottoCommerciale | null>(null);

  // Posologie e durate
  const [posologia, setPosologia] = useState("");
  const [durateStandard, setDurateStandard] = useState<string[]>([]);
  const [durata, setDurata] = useState("");
  const [quantita, setQuantita] = useState(1);
  const [noteFrequenti, setNoteFrequenti] = useState<string[]>([]);
  const [note, setNote] = useState("");

  // Gruppo di equivalenza AIFA (richiesto dal Sistema TS per farmaci di classe A)
  const [gruppoEquivalenzaCodice, setGruppoEquivalenzaCodice] = useState("");
  const [gruppoEquivalenzaDescrizione, setGruppoEquivalenzaDescrizione] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [showConferma, setShowConferma] = useState(false);
  const [autoMode] = useState(true);

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
          setFarmaciDisponibili(response.data || []);
          // Auto-seleziona primo farmaco
          const farmaci = response.data || [];
          if (farmaci.length > 0) {
            setFarmacoSelezionato(farmaci[0]);
            setPosologia(farmaci[0].posologia_default);
            setDurata(farmaci[0].durata_default);
            setNote(farmaci[0].note_default);
          }
        } catch (error) {
          console.error('Errore caricamento farmaci:', error);
        }
      };

      loadFarmaci();
    }
  }, [diagnosiSelezionata, autoMode]);

  // Quando cambia il principio attivo, carica i prodotti commerciali (AIC) disponibili
  useEffect(() => {
    if (farmacoSelezionato) {
      const loadProdotti = async () => {
        try {
          const response = await getFarmaciCommerciali(parseInt(farmacoSelezionato.codice));
          const prodotti = response.data || [];
          setProdottiCommerciali(prodotti);
          setProdottoSelezionato(null);
          setGruppoEquivalenzaCodice("");
          setGruppoEquivalenzaDescrizione("");
        } catch (error) {
          console.error('Errore caricamento prodotti commerciali:', error);
        }
      };
      loadProdotti();
    } else {
      setProdottiCommerciali([]);
      setProdottoSelezionato(null);
      setGruppoEquivalenzaCodice("");
      setGruppoEquivalenzaDescrizione("");
    }
  }, [farmacoSelezionato]);

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
      setPosologia(farmaco.posologia_default);
      setDurata(farmaco.durata_default);
      setNote(farmaco.note_default);
    }
  };

  const handleProdottoChange = (aic: string) => {
    const prodotto = prodottiCommerciali.find(p => p.aic === aic);
    setProdottoSelezionato(prodotto || null);
    setGruppoEquivalenzaCodice(prodotto?.gruppo_equivalenza_codice || "");
    setGruppoEquivalenzaDescrizione(prodotto?.gruppo_equivalenza_descrizione || "");
  };

  const handleInvia = () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato || !prodottoSelezionato || !posologia || !durata) {
      alert("Compila tutti i campi obbligatori (incluso il nome commerciale del farmaco).");
      return;
    }
    setShowConferma(true);
  };

  const confermaInvio = async () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato || !prodottoSelezionato) {
      alert("Dati mancanti per l'invio della ricetta.");
      return;
    }

    const payload: RicettaPayload = {
      medico: {
        cf_medico: datiMedico.cfMedico,
        regione: datiMedico.regione,
        asl: datiMedico.asl,
        specializzazione: datiMedico.specializzazione,
        iscrizione: datiMedico.iscrizione,
        indirizzo: datiMedico.indirizzo,
        telefono: datiMedico.telefono,
        cap: datiMedico.cap,
        citta: datiMedico.citta,
        provincia: datiMedico.provincia
      },
      paziente: {
        id: pazienteSelezionato.id,
        nome: pazienteSelezionato.nome,
        cognome: '',
        codice_fiscale: pazienteSelezionato.codice_fiscale || '',
        indirizzo: pazienteSelezionato.indirizzo || '',
        cap: pazienteSelezionato.cap || '',
        citta: pazienteSelezionato.citta || '',
        provincia: pazienteSelezionato.provincia || '',
      },
      diagnosi: {
        id:diagnosiSelezionata.id,
        codice: diagnosiSelezionata.codice,
        descrizione: diagnosiSelezionata.descrizione
      },
      farmaco: {
        codice: prodottoSelezionato.aic,
        principio_attivo: farmacoSelezionato.principio_attivo,
        descrizione: prodottoSelezionato.nome_commerciale,
        gruppo_equivalenza_codice: gruppoEquivalenzaCodice || undefined,
        gruppo_equivalenza_descrizione: gruppoEquivalenzaDescrizione || undefined
      },
      posologia,
      durata,
      note,
      quantita,
    };

    try {
      const response = await inviaRicetta(payload);
      
      if (response.success && response.data) {
        const { nre, pin_ricetta, protocollo_transazione, nome_medico, cognome_medico, data_inserimento, pdf_promemoria_b64 } = response.data;
        
        // Salva la ricetta nel database locale
        try {
          const ricettaData = {
            nre: nre || '',
            codice_pin: pin_ricetta || '',
            cf_medico: datiMedico.cfMedico,
            medico_cognome: cognome_medico || 'N/A',
            medico_nome: nome_medico || 'N/A', 
            specializzazione: datiMedico.specializzazione,
            nr_iscrizione_albo: datiMedico.iscrizione,
            cf_assistito: pazienteSelezionato.codice_fiscale || '',
            paziente_cognome: pazienteSelezionato.cognome || 'N/A',
            paziente_nome: pazienteSelezionato.nome,
            data_compilazione: data_inserimento || new Date().toISOString(),
            codice_diagnosi: diagnosiSelezionata.codice,
            descrizione_diagnosi: diagnosiSelezionata.descrizione,
            gruppo_equivalenza_farmaco: gruppoEquivalenzaCodice || '',
            prodotto_aic: prodottoSelezionato.aic,
            codice_farmaco: prodottoSelezionato.aic,
            denominazione_farmaco: prodottoSelezionato.nome_commerciale,
            principio_attivo: farmacoSelezionato.principio_attivo,
            posologia: posologia,
            durata_trattamento: durata,
            response_xml: '', // XML rimosso per risparmiare spazio - ricette recuperabili da Sistema TS
            note: note || undefined,
            protocollo_transazione: protocollo_transazione || undefined,
            pdf_base64: pdf_promemoria_b64 || undefined
          };
          
          const saveResult = await saveRicetta(ricettaData);
          if (saveResult.success) {
            console.log(`Ricetta salvata nel database con ID: ${saveResult.data?.ricetta_id}`);
          } else {
            console.warn(`Avviso salvataggio: ${saveResult.message}`);
          }
        } catch (saveError) {
          console.warn("Avviso: ricetta inviata ma non salvata nel database locale:", saveError);
        }
        
        if (nre && pin_ricetta) {
          alert(`✅ Ricetta inviata e salvata con successo!\n\n📋 NRE: ${nre}\n🔑 PIN: ${pin_ricetta}${protocollo_transazione ? `\n🔗 Protocollo: ${protocollo_transazione}` : ''}\n\nConserva questi dati per eventuali annullamenti.`);
        } else {
          alert("✅ Ricetta inviata e salvata con successo al Sistema TS.");
        }

        setShowConferma(false);

        // Reset form dopo invio riuscito
        setDiagnosiSelezionata(null);
        setFarmacoSelezionato(null);
        setPosologia("");
        setDurata("");
        setNote("");
      } else {
        // Invio fallito: mostra l'errore reale, NON chiudere il modal né svuotare il form
        const erroreMsg = response.message || response.error || 'Errore sconosciuto dal Sistema TS';
        alert(`❌ Invio ricetta fallito:\n\n${erroreMsg}`);
      }

    } catch (err: any) {
      console.error("Errore invio ricetta:", err);
      alert(`❌ Errore durante l'invio della ricetta: ${err?.message || 'Errore sconosciuto'}`);
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
                  <div><strong>CF:</strong> {pazienteSelezionato.codice_fiscale || '-'}</div>
                  <div><strong>Indirizzo:</strong> {pazienteSelezionato.indirizzo || '-'}</div>
                </div>
              </CCardBody>
            </CCard>
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
                        {d.codice} - {d.descrizione} ({d.num_farmaci} farmaci)
                      </option>
                    ))}
                  </CFormSelect>
                </div>

                {/* Principio attivo */}
                <div className="mb-3">
                  <CFormLabel>💊 Principio attivo</CFormLabel>
                  <CFormSelect
                    value={farmacoSelezionato?.codice || ''}
                    onChange={(e) => handleFarmacoChange(e.target.value)}
                    disabled={!diagnosiSelezionata || farmaciDisponibili.length === 0}
                  >
                    <option value="">
                      {!diagnosiSelezionata ? "Prima seleziona una diagnosi" :
                       farmaciDisponibili.length === 0 ? "Nessun farmaco disponibile" :
                       "Seleziona principio attivo..."}
                    </option>
                    {farmaciDisponibili.map(f => (
                      <option key={f.codice} value={f.codice}>
                        {f.nome} - {f.principio_attivo} ({f.classe})
                      </option>
                    ))}
                  </CFormSelect>
                </div>

                {/* Nome commerciale (AIC) - dipende dal principio attivo selezionato */}
                {farmacoSelezionato && (
                  <div className="mb-3">
                    <CFormLabel>🏪 Nome commerciale</CFormLabel>
                    <CFormSelect
                      value={prodottoSelezionato?.aic || ''}
                      onChange={(e) => handleProdottoChange(e.target.value)}
                      disabled={prodottiCommerciali.length === 0}
                    >
                      <option value="">
                        {prodottiCommerciali.length === 0
                          ? "Nessun prodotto commerciale configurato per questo principio attivo"
                          : "Seleziona nome commerciale..."}
                      </option>
                      {prodottiCommerciali.map(p => (
                        <option key={p.aic} value={p.aic}>
                          {p.nome_commerciale} - AIC {p.aic} ({p.classe})
                        </option>
                      ))}
                    </CFormSelect>
                    {prodottiCommerciali.length === 0 && (
                      <small className="text-danger d-block mt-1">
                        Nessun prodotto commerciale in archivio per questo principio attivo: impossibile inviare la ricetta finché non viene configurato.
                      </small>
                    )}
                  </div>
                )}

                {/* Gruppo di equivalenza AIFA - obbligatorio dal Sistema TS solo per farmaci di classe A */}
                {farmacoSelezionato && (
                  <div className="mb-3">
                    <CFormLabel>🏷️ Gruppo equivalenza AIFA (solo se farmaco classe A)</CFormLabel>
                    <CRow>
                      <CCol md={4}>
                        <CFormInput
                          value={gruppoEquivalenzaCodice}
                          onChange={(e) => setGruppoEquivalenzaCodice(e.target.value)}
                          placeholder="es. CJA"
                        />
                      </CCol>
                      <CCol md={8}>
                        <CFormInput
                          value={gruppoEquivalenzaDescrizione}
                          onChange={(e) => setGruppoEquivalenzaDescrizione(e.target.value)}
                          placeholder="Descrizione gruppo equivalenza (dal portale Sistema TS)"
                        />
                      </CCol>
                    </CRow>
                  </div>
                )}

                {/* Quantita confezioni */}
                <div className="mb-3">
                  <CFormLabel>📦 Quantità confezioni</CFormLabel>
                  <CFormInput
                    type="number"
                    min={1}
                    value={quantita}
                    onChange={(e) => setQuantita(Number(e.target.value) || 1)}
                    disabled={!farmacoSelezionato}
                  />
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
                  disabled={!diagnosiSelezionata || !farmacoSelezionato || !prodottoSelezionato || !posologia || !durata}
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
              <p><strong>{prodottoSelezionato?.nome_commerciale}</strong><br/>
              {farmacoSelezionato?.principio_attivo}<br/>
              <small>AIC: {prodottoSelezionato?.aic}</small></p>

              <h6>⏰ Terapia</h6>
              <p><strong>Posologia:</strong> {posologia}<br/>
              <strong>Durata:</strong> {durata}<br/>
              <strong>Quantità:</strong> {quantita}</p>
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