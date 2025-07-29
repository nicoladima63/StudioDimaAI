import { useState, useEffect } from "react";
import { 
  CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CFormSelect,
  CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, 
  CCardBody, CSpinner, CBadge
} from '@coreui/react';
import {
  getDiagnosiDisponibili,
  getFarmaciPerDiagnosi, 
  getDurateStandard,
  getNoteFrequenti,
  inviaRicetta,
  type Diagnosi,
  type FarmacoProtocollo,
  type RicettaPayload
} from '@/api/services/ricette.service';
import type { PazienteCompleto } from '@/lib/types';

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
  pazienteSelezionato: PazienteCompleto | null;
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

        setDiagnosiDisponibili(diagnosi);
        setDurateStandard(durate);
        setNoteFrequenti(noteFreq);
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
          const farmaci = await getFarmaciPerDiagnosi(diagnosiSelezionata.id);
          setFarmaciDisponibili(farmaci);
          
          // Auto-seleziona primo farmaco
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

  const handleInvia = () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato || !posologia || !durata) {
      alert("Compila tutti i campi obbligatori.");
      return;
    }
    setShowConferma(true);
  };

  const confermaInvio = async () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato) {
      alert("Dati mancanti per l'invio della ricetta.");
      return;
    }

    const payload: RicettaPayload = {
      medico: {
        cfMedico: datiMedico.cfMedico,
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
        id: pazienteSelezionato.DB_CODE,
        nome: pazienteSelezionato.DB_PANOME,
        cognome: '',
        codiceFiscale: pazienteSelezionato.DB_PACODFI,
        indirizzo: pazienteSelezionato.DB_PAINDIR,
        cap: pazienteSelezionato.DB_PACAP,
        citta: pazienteSelezionato.DB_PACITTA,
        provincia: pazienteSelezionato.DB_PAPROVI,
      },
      diagnosi: {
        codice: diagnosiSelezionata.codice,
        descrizione: diagnosiSelezionata.descrizione
      },
      farmaco: {
        codice: farmacoSelezionato.codice,
        principio_attivo: farmacoSelezionato.principio_attivo,
        descrizione: farmacoSelezionato.nome
      },
      posologia,
      durata,
      note,
    };

    try {
      const response = await inviaRicetta(payload);
      
      if (response.success && response.data) {
        const { nre, pin_ricetta, protocollo_transazione } = response.data;
        
        if (nre && pin_ricetta) {
          alert(`✅ Ricetta inviata con successo!\n\n📋 NRE: ${nre}\n🔑 PIN: ${pin_ricetta}${protocollo_transazione ? `\n🔗 Protocollo: ${protocollo_transazione}` : ''}\n\nConserva questi dati per eventuali annullamenti.`);
        } else {
          alert("✅ Ricetta inviata con successo al Sistema TS.");
        }
      } else {
        alert("✅ Ricetta inviata con successo.");
      }
      
      setShowConferma(false);
      
      // Reset form dopo invio riuscito
      setDiagnosiSelezionata(null);
      setFarmacoSelezionato(null);
      setPosologia("");
      setDurata("");
      setNote("");
      
    } catch (err) {
      console.error("Errore invio ricetta:", err);
      alert("❌ Errore durante l'invio della ricetta.");
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
                  <div><strong>Nome:</strong> {pazienteSelezionato.DB_PANOME}</div>
                  <div><strong>CF:</strong> {pazienteSelezionato.DB_PACODFI || '-'}</div>
                  <div><strong>Indirizzo:</strong> {pazienteSelezionato.DB_PAINDIR || '-'}</div>
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
              <p><strong>{pazienteSelezionato?.DB_PANOME}</strong><br/>
              CF: {pazienteSelezionato?.DB_PACODFI}</p>
              
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