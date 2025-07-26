import React, { useState, useEffect } from "react";
import { 
  CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CFormSelect,
  CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, 
  CCardBody, CAlert, CSpinner, CBadge
} from '@coreui/react';
import {
  getDiagnosiDisponibili,
  getFarmaciPerDiagnosi, 
  getPosologiePerFarmaco,
  getDurateStandard,
  getNoteFrequenti,
  inviaRicetta,
  type Diagnosi,
  type FarmacoProtocollo,
  type RicettaPayload
} from '@/api/services/ricette.service';
import { getPazientiAll } from '@/api/services/pazienti.service';
import { usePazientiStore } from '@/store/pazienti.store';
import type { PazienteCompleto } from '@/lib/types';
import AutoComplete from '@/components/common/AutoComplete';

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

export default function RicettaAvanzata({ datiMedico }: { datiMedico: DatiMedico }) {
  // Pazienti
  const allPazienti = usePazientiStore(state => state.pazienti);
  const setPazienti = usePazientiStore(state => state.setPazienti);
  const [search, setSearch] = useState('');
  const [pazienteSelezionato, setPazienteSelezionato] = useState<PazienteCompleto | null>(null);

  // Diagnosi e farmaci
  const [diagnosiDisponibili, setDiagnosiDisponibili] = useState<Diagnosi[]>([]);
  const [diagnosiSelezionata, setDiagnosiSelezionata] = useState<Diagnosi | null>(null);
  const [farmaciDisponibili, setFarmaciDisponibili] = useState<FarmacoProtocollo[]>([]);
  const [farmacoSelezionato, setFarmacoSelezionato] = useState<FarmacoProtocollo | null>(null);

  // Posologie e durate
  const [posologieDisponibili, setPosologieDisponibili] = useState<string[]>([]);
  const [posologia, setPosologia] = useState("");
  const [durateStandard, setDurateStandard] = useState<string[]>([]);
  const [durata, setDurata] = useState("");
  const [noteFrequenti, setNoteFrequenti] = useState<string[]>([]);
  const [note, setNote] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [showConferma, setShowConferma] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  // Carica dati iniziali
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carica pazienti se vuoti
        if (allPazienti.length === 0) {
          const res = await getPazientiAll();
          if (res.success) setPazienti(res.data);
        }

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

  // Quando cambia il farmaco, carica posologie
  useEffect(() => {
    if (farmacoSelezionato && autoMode) {
      const loadPosologie = async () => {
        try {
          const posologie = await getPosologiePerFarmaco(farmacoSelezionato.principio_attivo);
          setPosologieDisponibili(posologie);
        } catch (error) {
          console.error('Errore caricamento posologie:', error);
        }
      };

      loadPosologie();
    }
  }, [farmacoSelezionato, autoMode]);

  const fetchPazienti = async (q: string): Promise<PazienteCompleto[]> => {
    const ql = q.toLowerCase();
    const pazienti = usePazientiStore.getState().pazienti;
    return pazienti.filter(p =>
      (p.DB_PANOME && p.DB_PANOME.toLowerCase().includes(ql)) ||
      (p.DB_PACODFI && p.DB_PACODFI.toLowerCase().includes(ql))
    );
  };

  const handleDiagnosiChange = (diagnosiId: string) => {
    const diagnosi = diagnosiDisponibili.find(d => d.id === diagnosiId);
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
      await inviaRicetta(payload);
      alert("Ricetta inviata con successo.");
      setShowConferma(false);
    } catch (err) {
      console.error("Errore invio ricetta:", err);
      alert("Errore durante l'invio della ricetta.");
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
    <CRow>

      {/* Selezione paziente */}
      <CCol md={4}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">👤 Paziente</h5>
            
            <AutoComplete<PazienteCompleto>
              value={pazienteSelezionato ? pazienteSelezionato.DB_PANOME : search}
              onChange={setSearch}
              onSelect={(p: PazienteCompleto) => {
                setPazienteSelezionato(p);
                setSearch(p.DB_PANOME);
              }}
              fetchSuggestions={fetchPazienti}
              getOptionLabel={(p: PazienteCompleto) => `${p.DB_PANOME} (${p.DB_PACODFI})`}
              placeholder="Cerca paziente..."
            />

            {pazienteSelezionato && (
              <CCard className="mt-3" style={{ backgroundColor: '#f8f9fa' }}>
                <CCardBody>
                  <h6 className="mb-2">Dati Paziente</h6>
                  <div className="small">
                    <div><strong>Nome:</strong> {pazienteSelezionato.DB_PANOME}</div>
                    <div><strong>CF:</strong> {pazienteSelezionato.DB_PACODFI || '-'}</div>
                    <div><strong>Indirizzo:</strong> {pazienteSelezionato.DB_PAINDIR || '-'}</div>
                  </div>
                </CCardBody>
              </CCard>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* Form ricetta */}
      <CCol md={8}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">📋 Protocollo Terapeutico</h5>
            
            {!pazienteSelezionato ? (
              <div className="text-center text-muted py-4">
                <p>Seleziona prima un paziente per compilare la ricetta</p>
              </div>
            ) : (
              <CForm>
                {/* Diagnosi */}
                <div className="mb-3">
                  <CFormLabel>🩺 Diagnosi</CFormLabel>
                  <CFormSelect
                    value={diagnosiSelezionata?.id || ''}
                    onChange={(e) => handleDiagnosiChange(e.target.value)}
                  >
                    <option value="">Seleziona diagnosi...</option>
                    {diagnosiDisponibili.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.codice} - {d.descrizione} ({d.num_farmaci} farmaci)
                      </option>
                    ))}
                  </CFormSelect>
                </div>

                {/* Farmaco */}
                {farmaciDisponibili.length > 0 && (
                  <div className="mb-3">
                    <CFormLabel>💊 Farmaco</CFormLabel>
                    <CFormSelect
                      value={farmacoSelezionato?.codice || ''}
                      onChange={(e) => handleFarmacoChange(e.target.value)}
                    >
                      <option value="">Seleziona farmaco...</option>
                      {farmaciDisponibili.map(f => (
                        <option key={f.codice} value={f.codice}>
                          {f.nome} - {f.principio_attivo} 
                          <CBadge color="secondary" className="ms-1">{f.classe}</CBadge>
                        </option>
                      ))}
                    </CFormSelect>
                    
                    {farmacoSelezionato && (
                      <small className="text-muted d-block mt-1">
                        Codice: {farmacoSelezionato.codice} | Classe: {farmacoSelezionato.classe}
                      </small>
                    )}
                  </div>
                )}

                {/* Posologia */}
                {(posologieDisponibili.length > 0 || !autoMode) && (
                  <div className="mb-3">
                    <CFormLabel>⏰ Posologia</CFormLabel>
                    {autoMode && posologieDisponibili.length > 0 ? (
                      <CFormSelect
                        value={posologia}
                        onChange={(e) => setPosologia(e.target.value)}
                      >
                        {posologieDisponibili.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </CFormSelect>
                    ) : (
                      <CFormInput
                        value={posologia}
                        onChange={(e) => setPosologia(e.target.value)}
                        placeholder="es. 1 compressa ogni 8 ore"
                      />
                    )}
                  </div>
                )}

                {/* Durata */}
                <div className="mb-3">
                  <CFormLabel>📅 Durata</CFormLabel>
                  {autoMode ? (
                    <CFormSelect
                      value={durata}
                      onChange={(e) => setDurata(e.target.value)}
                    >
                      <option value="">Seleziona durata...</option>
                      {durateStandard.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </CFormSelect>
                  ) : (
                    <CFormInput
                      value={durata}
                      onChange={(e) => setDurata(e.target.value)}
                      placeholder="es. 5 giorni"
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
                        placeholder="Note aggiuntive..."
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
            )}
          </CCardBody>
        </CCard>
      </CCol>

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
    </CRow>
  );
}