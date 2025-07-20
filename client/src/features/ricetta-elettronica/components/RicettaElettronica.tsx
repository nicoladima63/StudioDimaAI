import React, { useState, useEffect } from "react";
import { CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, CCardBody } from '@coreui/react';
import {
  searchDiagnosi,
  searchFarmaci,
  inviaRicetta,
} from '@/api/services/ricette.service';
import { getPazientiAll } from '@/api/services/pazienti.service';
import { usePazientiStore } from '@/store/pazienti.store';
import type { PazienteCompleto } from '@/lib/types';
import AutoComplete from '@/components/common/AutoComplete';

interface Diagnosi {
  codice: string;
  descrizione: string;
}

interface Farmaco {
  codice: string;
  principio_attivo: string;
  descrizione: string;
}

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
}

// Utility per localStorage suggerimenti
const SUGG_POSOLOGIA_KEY = 'sugg_posologia';
const SUGG_DURATA_KEY = 'sugg_durata';
const MAX_SUGG = 7;

function getSuggerimenti(key: string): string[] {
  try {
    const val = localStorage.getItem(key);
    if (!val) return [];
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function salvaSuggerimento(key: string, valore: string) {
  let suggerimenti = getSuggerimenti(key);
  suggerimenti = suggerimenti.filter(v => v !== valore);
  suggerimenti.unshift(valore);
  if (suggerimenti.length > MAX_SUGG) suggerimenti = suggerimenti.slice(0, MAX_SUGG);
  localStorage.setItem(key, JSON.stringify(suggerimenti));
}

// Aggiungo la funzione per rimuovere suggerimenti
function rimuoviSuggerimento(key: string, valore: string, setState: (arr: string[]) => void) {
  let suggerimenti = getSuggerimenti(key);
  suggerimenti = suggerimenti.filter(v => v !== valore);
  localStorage.setItem(key, JSON.stringify(suggerimenti));
  setState(suggerimenti);
}

export default function RicettaElettronica({ datiMedico }: { datiMedico: DatiMedico }) {
  // Pazienti reali dallo store Zustand
  const allPazienti = usePazientiStore(state => state.pazienti);
  const setPazienti = usePazientiStore(state => state.setPazienti);
  // Carica i pazienti solo al primo mount se la lista è vuota
  useEffect(() => {
    if (allPazienti.length === 0) {
      getPazientiAll().then(res => {
        if (res.success) setPazienti(res.data);
      });
    }
  }, [allPazienti]);

  // Filtro live su nome, cognome, codice fiscale ecc.
  const [search, setSearch] = useState('');
  const [pazienteSelezionato, setPazienteSelezionato] = useState<PazienteCompleto | null>(null);
  const [showConferma, setShowConferma] = useState(false);

  const [diagnosiSelezionata, setDiagnosiSelezionata] = useState<Diagnosi | null>(null);
  const [diagnosiInput, setDiagnosiInput] = useState('');
  const fetchDiagnosi = async (q: string): Promise<Diagnosi[]> => {
    return await searchDiagnosi(q);
  };

  const [farmacoSelezionato, setFarmacoSelezionato] = useState<Farmaco | null>(null);
  const [farmacoInput, setFarmacoInput] = useState('');
  const fetchFarmaci = async (q: string): Promise<Farmaco[]> => {
    return await searchFarmaci(q);
  };

  const [posologia, setPosologia] = useState("una cpr ogni 12h");
  const [durata, setDurata] = useState("6gg");
  const [note, setNote] = useState("");

  const [suggPosologia, setSuggPosologia] = useState<string[]>(getSuggerimenti(SUGG_POSOLOGIA_KEY));
  const [suggDurata, setSuggDurata] = useState<string[]>(getSuggerimenti(SUGG_DURATA_KEY));
  const [showSuggPosologia, setShowSuggPosologia] = useState(false);
  const [showSuggDurata, setShowSuggDurata] = useState(false);

  const handleInvia = () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato) {
      alert("Compila tutti i campi obbligatori.");
      return;
    }
    // Aggiorna suggerimenti
    if (posologia.trim()) {
      salvaSuggerimento(SUGG_POSOLOGIA_KEY, posologia.trim());
      setSuggPosologia(getSuggerimenti(SUGG_POSOLOGIA_KEY));
    }
    if (durata.trim()) {
      salvaSuggerimento(SUGG_DURATA_KEY, durata.trim());
      setSuggDurata(getSuggerimenti(SUGG_DURATA_KEY));
    }
    setShowConferma(true);
  };

  const confermaInvio = () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato) {
      alert("Dati mancanti per l'invio della ricetta.");
      return;
    }
    const payload = {
      medico: datiMedico,
      paziente: {
        id: pazienteSelezionato.DB_CODE,
        nome: pazienteSelezionato.DB_PANOME,
        cognome: '', // Se serve, estrai da nome_completo o aggiungi campo
        codiceFiscale: pazienteSelezionato.DB_PACODFI,
        indirizzo: pazienteSelezionato.DB_PAINDIR,
        cap: pazienteSelezionato.DB_PACAP,
        citta: pazienteSelezionato.DB_PACITTA,
        provincia: pazienteSelezionato.DB_PAPROVI,
      },
      diagnosi: diagnosiSelezionata,
      farmaco: farmacoSelezionato,
      posologia,
      durata,
      note,
    };
    inviaRicetta(payload)
      .then(() => {
        alert("Ricetta inviata con successo.");
        setShowConferma(false);
      })
      .catch(err => {
        console.error("Errore invio ricetta:", err);
        alert("Errore durante l'invio della ricetta.");
      });
  };

  const fetchPazienti = async (q: string): Promise<PazienteCompleto[]> => {
    const ql = q.toLowerCase();
    const pazienti = usePazientiStore.getState().pazienti;
    const result = pazienti.filter(p =>
      (p.DB_PANOME && p.DB_PANOME.toLowerCase().includes(ql)) ||
      (p.DB_PACODFI && p.DB_PACODFI.toLowerCase().includes(ql))
    );
    return result;
  };

  return (
    <CRow>
      {/* Prima colonna - Selezione paziente */}
      <CCol md={4}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">Selezione Paziente</h5>
            
            {/* Autocomplete paziente */}
            <AutoComplete<PazienteCompleto>
              value={pazienteSelezionato ? pazienteSelezionato.nome_completo : search}
              onChange={setSearch}
              onSelect={(p: PazienteCompleto) => {
                setPazienteSelezionato(p);
                setSearch(p.nome_completo);
              }}
              fetchSuggestions={fetchPazienti}
              getOptionLabel={(p: PazienteCompleto) => `${p.DB_PANOME} (${p.DB_PACODFI})`}
              placeholder="Digita nome..."
            />

            {/* Box riepilogativo paziente */}
            {pazienteSelezionato && (
              <CCard className="mt-3" style={{ backgroundColor: '#f8f9fa' }}>
                <CCardBody>
                  <h6 className="mb-2">Dati Paziente</h6>
                  <div className="small">
                    <div><strong>Nome:</strong> {pazienteSelezionato.DB_PANOME}</div>
                    <div><strong>Codice fiscale:</strong> {pazienteSelezionato.DB_PACODFI || '-'}</div>
                    <div><strong>Indirizzo:</strong> {pazienteSelezionato.DB_PAINDIR || '-'}</div>
                    <div><strong>CAP:</strong> {pazienteSelezionato.DB_PACAP || '-'}</div>
                    <div><strong>Città:</strong> {pazienteSelezionato.DB_PACITTA || '-'}</div>
                    <div><strong>Provincia:</strong> {pazienteSelezionato.DB_PAPROVI || '-'}</div>
                  </div>
                </CCardBody>
              </CCard>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* Seconda colonna - Form ricetta */}
      <CCol md={8}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">Ricetta Elettronica Privata</h5>
            
            {!pazienteSelezionato ? (
              <div className="text-center text-muted py-4">
                <p>Seleziona prima un paziente per compilare la ricetta</p>
              </div>
            ) : (
              <CForm autoComplete="off">
                {/* Ricerca Diagnosi */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <CFormLabel>Diagnosi</CFormLabel>
                  <AutoComplete<Diagnosi>
                    value={diagnosiInput}
                    onChange={setDiagnosiInput}
                    onSelect={(d: Diagnosi) => {
                      setDiagnosiSelezionata(d);
                      setDiagnosiInput(`${d.codice} - ${d.descrizione}`);
                    }}
                    fetchSuggestions={fetchDiagnosi}
                    getOptionLabel={(d: Diagnosi) => `${d.codice} - ${d.descrizione}`}
                    placeholder="Cerca diagnosi..."
                  />
                  {/* The following block was removed as per the edit hint */}
                  {/* {diagnosiList.length > 0 && (
                    <div style={{ 
                      border: '1px solid #ccc', 
                      marginTop: '0.25rem', 
                      maxHeight: '160px', 
                      overflowY: 'auto',
                      fontSize: '0.875rem',
                      position: 'absolute',
                      width: '100%',
                      zIndex: 100,
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      {diagnosiList.map(d => (
                        <div
                          key={d.codice}
                          style={{ 
                            padding: '0.25rem', 
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            setDiagnosiSelezionata(d);
                            setDiagnosiInput(`${d.codice} - ${d.descrizione}`);
                            setDiagnosiList([]);
                          }}
                        >
                          {d.codice} - {d.descrizione}
                        </div>
                      ))}
                    </div>
                  )} */}
                </div>

                {/* Ricerca Farmaco */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <CFormLabel>Farmaco</CFormLabel>
                  <AutoComplete<Farmaco>
                    value={farmacoInput}
                    onChange={setFarmacoInput}
                    onSelect={(f: Farmaco) => {
                      setFarmacoSelezionato(f);
                      setFarmacoInput(`${f.principio_attivo} - ${f.descrizione}`);
                    }}
                    fetchSuggestions={fetchFarmaci}
                    getOptionLabel={(f: Farmaco) => `${f.principio_attivo} - ${f.descrizione}`}
                    placeholder="Cerca farmaco..."
                  />
                </div>

                {/* Posologia con suggerimenti */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <CFormLabel>Posologia</CFormLabel>
                  <CFormInput
                    value={posologia}
                    onChange={e => {
                      setPosologia(e.target.value);
                      setShowSuggPosologia(true);
                    }}
                    onFocus={() => setShowSuggPosologia(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSuggPosologia(false), 150);
                      if (posologia.trim() && !suggPosologia.includes(posologia.trim())) {
                        salvaSuggerimento(SUGG_POSOLOGIA_KEY, posologia.trim());
                        setSuggPosologia(getSuggerimenti(SUGG_POSOLOGIA_KEY));
                      }
                    }}
                    autoComplete="off"
                    style={{ background: '#fff', position: 'relative', zIndex: 2 }}
                  />
                  {(showSuggPosologia && (posologia.length > 0 || suggPosologia.length > 0)) && suggPosologia.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid #ccc',
                      width: '100%',
                      maxHeight: 160,
                      overflowY: 'auto',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      {suggPosologia.filter(s => s.toLowerCase().includes(posologia.toLowerCase()) && s !== posologia).map(s => (
                        <div
                          key={s}
                          style={{ display: 'flex', alignItems: 'center', padding: 8, cursor: 'pointer' }}
                        >
                          <span
                            style={{ flex: 1 }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setPosologia(s);
                              setShowSuggPosologia(false);
                            }}
                          >
                            {s}
                          </span>
                          <span
                            style={{ color: '#888', marginLeft: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}
                            title="Rimuovi suggerimento"
                            onMouseDown={e => {
                              e.preventDefault();
                              rimuoviSuggerimento(SUGG_POSOLOGIA_KEY, s, setSuggPosologia);
                            }}
                          >
                            ×
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Durata con suggerimenti */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <CFormLabel>Durata</CFormLabel>
                  <CFormInput
                    value={durata}
                    onChange={e => {
                      setDurata(e.target.value);
                      setShowSuggDurata(true);
                    }}
                    onFocus={() => setShowSuggDurata(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSuggDurata(false), 150);
                      if (durata.trim() && !suggDurata.includes(durata.trim())) {
                        salvaSuggerimento(SUGG_DURATA_KEY, durata.trim());
                        setSuggDurata(getSuggerimenti(SUGG_DURATA_KEY));
                      }
                    }}
                    autoComplete="off"
                    style={{ background: '#fff', position: 'relative', zIndex: 2 }}
                  />
                  {(showSuggDurata && (durata.length > 0 || suggDurata.length > 0)) && suggDurata.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid #ccc',
                      width: '100%',
                      maxHeight: 160,
                      overflowY: 'auto',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      {suggDurata.filter(s => s.toLowerCase().includes(durata.toLowerCase()) && s !== durata).map(s => (
                        <div
                          key={s}
                          style={{ display: 'flex', alignItems: 'center', padding: 8, cursor: 'pointer' }}
                        >
                          <span
                            style={{ flex: 1 }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setDurata(s);
                              setShowSuggDurata(false);
                            }}
                          >
                            {s}
                          </span>
                          <span
                            style={{ color: '#888', marginLeft: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}
                            title="Rimuovi suggerimento"
                            onMouseDown={e => {
                              e.preventDefault();
                              rimuoviSuggerimento(SUGG_DURATA_KEY, s, setSuggDurata);
                            }}
                          >
                            ×
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Note aggiuntive */}
                <div style={{ marginBottom: '1rem' }}>
                  <CFormLabel>Note aggiuntive</CFormLabel>
                  <CFormTextarea 
                    value={note} 
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
                <CButton color="primary" onClick={handleInvia}>
                  Invia Ricetta
                </CButton>
              </CForm>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      {/* Modal riepilogo conferma invio */}
      <CModal visible={showConferma} onClose={() => setShowConferma(false)}>
        <CModalHeader>
          <h4>Conferma invio ricetta</h4>
        </CModalHeader>
        <CModalBody>
          <div><b>Medico:</b> {datiMedico.specializzazione} ({datiMedico.regioneOrdine})</div>
          <div><b>Paziente:</b> {pazienteSelezionato?.nome_completo || pazienteSelezionato?.nome} - {pazienteSelezionato?.codiceFiscale || pazienteSelezionato?.DB_PACODFI}</div>
          <div><b>Diagnosi:</b> {diagnosiSelezionata ? `${diagnosiSelezionata.codice} - ${diagnosiSelezionata.descrizione}` : '-'}</div>
          <div><b>Farmaco:</b> {farmacoSelezionato ? `${farmacoSelezionato.principio_attivo} - ${farmacoSelezionato.descrizione}` : '-'}</div>
          <div><b>Posologia:</b> {posologia}</div>
          <div><b>Durata:</b> {durata}</div>
          <div><b>Note:</b> {note}</div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowConferma(false)}>
            Annulla
          </CButton>
          <CButton color="primary" onClick={confermaInvio}>
            Conferma invio
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  );
}
