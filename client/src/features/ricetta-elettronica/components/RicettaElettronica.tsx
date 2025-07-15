import React, { useState } from "react";
import debounce from "lodash/debounce";
import { CButton, CForm, CFormInput, CFormLabel, CFormTextarea, CModal, CModalHeader, CModalBody, CModalFooter, CRow, CCol, CCard, CCardBody } from '@coreui/react';
import {
  searchDiagnosi,
  searchFarmaci,
  inviaRicetta,
} from '@/api/services/ricette.service';

interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
}

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

interface RicettaElettronicaProps {
  pazienti: Paziente[];
  datiMedico: DatiMedico;
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

export default function RicettaElettronica({ pazienti, datiMedico }: RicettaElettronicaProps) {
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [showConferma, setShowConferma] = useState(false);

  // Filtro pazienti per nome
  const filtered = search.trim() === '' ? pazienti : pazienti.filter(p => {
    const q = search.toLowerCase();
    return p.nome.toLowerCase().includes(q);
  });

  const [diagnosiList, setDiagnosiList] = useState<Diagnosi[]>([]);
  const [farmaciList, setFarmaciList] = useState<Farmaco[]>([]);
  const [diagnosiSelezionata, setDiagnosiSelezionata] = useState<Diagnosi | null>(null);
  const [farmacoSelezionato, setFarmacoSelezionato] = useState<Farmaco | null>(null);
  const [diagnosiInput, setDiagnosiInput] = useState('');
  const [farmacoInput, setFarmacoInput] = useState('');
  const [posologia, setPosologia] = useState("una cpr ogni 12h");
  const [durata, setDurata] = useState("6gg");
  const [note, setNote] = useState("");

  const [suggPosologia, setSuggPosologia] = useState<string[]>(getSuggerimenti(SUGG_POSOLOGIA_KEY));
  const [suggDurata, setSuggDurata] = useState<string[]>(getSuggerimenti(SUGG_DURATA_KEY));
  const [showSuggPosologia, setShowSuggPosologia] = useState(false);
  const [showSuggDurata, setShowSuggDurata] = useState(false);

  const fetchDiagnosi = debounce((q: string) => {
    if (!q) return;
    searchDiagnosi(q)
      .then(setDiagnosiList)
      .catch(err => console.error("Errore fetch diagnosi:", err));
  }, 400);

  const fetchFarmaci = debounce((q: string) => {
    if (!q) return;
    searchFarmaci(q)
      .then(setFarmaciList)
      .catch(err => console.error("Errore fetch farmaci:", err));
  }, 400);

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
      paziente: pazienteSelezionato,
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

  return (
    <CRow>
      {/* Prima colonna - Selezione paziente */}
      <CCol md={4}>
        <CCard>
          <CCardBody>
            <h5 className="mb-3">Selezione Paziente</h5>
            
            {/* Autocomplete paziente */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <CFormInput
                type="text"
                placeholder="Digita nome..."
                value={pazienteSelezionato ? pazienteSelezionato.nome : search}
                onChange={e => {
                  setSearch(e.target.value);
                  setShowList(true);
                  setPazienteSelezionato(null);
                }}
                onFocus={() => setShowList(true)}
                autoComplete="off"
              />
              {showList && filtered.length > 0 && (
                <div style={{
                  position: 'absolute',
                  zIndex: 10,
                  background: '#fff',
                  border: '1px solid #ccc',
                  width: '100%',
                  maxHeight: 200,
                  overflowY: 'auto',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  {filtered.map(p => (
                    <div
                      key={p.id}
                      style={{ padding: 8, cursor: 'pointer' }}
                      onMouseDown={e => {
                        e.preventDefault();
                        setPazienteSelezionato(p);
                        setSearch(p.nome);
                        setShowList(false);
                      }}
                    >
                      {p.nome}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box riepilogativo paziente */}
            {pazienteSelezionato && (
              <CCard className="mt-3" style={{ backgroundColor: '#f8f9fa' }}>
                <CCardBody>
                  <h6 className="mb-2">Dati Paziente</h6>
                  <div className="small">
                    <div><strong>Nome:</strong> {pazienteSelezionato.nome}</div>
                    <div><strong>Codice fiscale:</strong> {pazienteSelezionato.codiceFiscale || '-'}</div>
                    <div><strong>Indirizzo:</strong> {pazienteSelezionato.indirizzo || '-'}</div>
                    <div><strong>CAP:</strong> {pazienteSelezionato.cap || '-'}</div>
                    <div><strong>Città:</strong> {pazienteSelezionato.citta || '-'}</div>
                    <div><strong>Provincia:</strong> {pazienteSelezionato.provincia || '-'}</div>
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
                  <CFormInput
                    value={diagnosiInput}
                    placeholder="Cerca diagnosi..."
                    onChange={e => {
                      setDiagnosiInput(e.target.value);
                      fetchDiagnosi(e.target.value);
                    }}
                    autoComplete="off"
                  />
                  {diagnosiList.length > 0 && (
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
                  )}
                </div>

                {/* Ricerca Farmaco */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <CFormLabel>Farmaco</CFormLabel>
                  <CFormInput
                    value={farmacoInput}
                    placeholder="Cerca farmaco..."
                    onChange={e => {
                      setFarmacoInput(e.target.value);
                      fetchFarmaci(e.target.value);
                    }}
                    autoComplete="off"
                  />
                  {farmaciList.length > 0 && (
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
                      {farmaciList.map(f => (
                        <div
                          key={f.codice}
                          style={{ 
                            padding: '0.25rem', 
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee'
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            setFarmacoSelezionato(f);
                            setFarmacoInput(`${f.principio_attivo} - ${f.descrizione}`);
                            setFarmaciList([]);
                          }}
                        >
                          {f.principio_attivo} - {f.descrizione}
                        </div>
                      ))}
                    </div>
                  )}
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
          <div><b>Paziente:</b> {pazienteSelezionato?.nome} - {pazienteSelezionato?.codiceFiscale}</div>
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
