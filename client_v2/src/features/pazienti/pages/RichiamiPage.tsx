import React, { useState, useCallback } from 'react';
import {
  CCard, CCardBody, CCardHeader,
  CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell,
  CBadge, CButton, CFormSelect, CFormCheck, CFormSwitch, CRow, CCol,
  CInputGroup, CFormInput, CFormLabel,
  CSpinner, CPagination, CPaginationItem,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPhone, cilClock, cilX } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import apiClient from '@/services/api/client';

interface PazienteDaRichiamare {
  id: string;
  nome: string;
  cellulare: string;
  telefono: string;
  sesso: string;
  tipo_richiamo: string;
  tipo_richiamo_nomi: string[];
  mesi_richiamo: number | null;
  ultima_visita: string | null;
  data_richiamo_prevista: string | null;
  mesi_dalla_visita: number | null;
  scaduto: boolean;
  giorni_ritardo: number;
}

const TIPO_COLORS: Record<string, string> = {
  '1': '#808080',
  '2': '#800080',
  '3': '#FF00FF',
  '4': '#ADD8E6',
  '5': '#FF00FF',
  '6': '#FFC0CB',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Tutti i tipi' },
  { value: '2', label: 'Igiene' },
  { value: '5', label: 'Impianto' },
  { value: '3', label: 'Rx Impianto' },
  { value: '4', label: 'Controllo' },
  { value: '6', label: 'Ortodonzia' },
  { value: '1', label: 'Generico' },
];

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

const RichiamiPage: React.FC = () => {
  const [pazienti, setPazienti] = useState<PazienteDaRichiamare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caricato, setCaricato] = useState(false);

  // Parametro server
  const [soloCellulare, setSoloCellulare] = useState(true);

  // Filtri client-side: ogni filtro ha uno switch on/off + valore
  const [tipoOn, setTipoOn] = useState(false);
  const [tipoVal, setTipoVal] = useState('');

  const [sessoOn, setSessoOn] = useState(false);
  const [sessoVal, setSessoVal] = useState('');

  const [scadutiOn, setScadutiOn] = useState(false);

  const [visitaOn, setVisitaOn] = useState(false);
  const [visitaDa, setVisitaDa] = useState('');
  const [visitaA, setVisitaA] = useState('');

  const [ritardoOn, setRitardoOn] = useState(false);
  const [ritardoMin, setRitardoMin] = useState('');

  // Tabella
  const [cerca, setCerca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortCol, setSortCol] = useState<'nome' | 'giorni_ritardo' | 'ultima_visita'>('giorni_ritardo');
  const [sortAsc, setSortAsc] = useState(false);

  const carica = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCaricato(true);
    setPagina(1);
    try {
      const res = await apiClient.get('/richiami/pazienti-da-richiamare', {
        params: { solo_cellulare: soloCellulare },
      });
      const data = res.data;
      if (data.success !== false) {
        setPazienti(data.pazienti ?? data.data?.pazienti ?? []);
      } else {
        setError(data.error || 'Errore caricamento');
        setPazienti([]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Errore di rete');
      setPazienti([]);
    } finally {
      setLoading(false);
    }
  }, [soloCellulare]);

  const resetFiltri = () => {
    setTipoOn(false); setTipoVal('');
    setSessoOn(false); setSessoVal('');
    setScadutiOn(false);
    setVisitaOn(false); setVisitaDa(''); setVisitaA('');
    setRitardoOn(false); setRitardoMin('');
    setCerca('');
    setPagina(1);
  };

  const filtriAttivi = [tipoOn, sessoOn, scadutiOn, visitaOn, ritardoOn].filter(Boolean).length;

  const filtrati = pazienti
    .filter(p => {
      if (tipoOn && tipoVal && !p.tipo_richiamo.includes(tipoVal)) return false;
      if (sessoOn && sessoVal && p.sesso !== sessoVal) return false;
      if (scadutiOn && !p.scaduto) return false;
      if (visitaOn) {
        if (visitaDa && (!p.ultima_visita || p.ultima_visita < visitaDa)) return false;
        if (visitaA && (!p.ultima_visita || p.ultima_visita > visitaA)) return false;
      }
      if (ritardoOn && ritardoMin !== '' && p.giorni_ritardo < Number(ritardoMin)) return false;
      if (cerca) {
        const q = cerca.toLowerCase();
        if (!p.nome.toLowerCase().includes(q) && !p.cellulare.includes(q) && !p.telefono.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === 'nome') { va = a.nome; vb = b.nome; }
      else if (sortCol === 'giorni_ritardo') { va = a.giorni_ritardo; vb = b.giorni_ritardo; }
      else { va = a.ultima_visita ?? ''; vb = b.ultima_visita ?? ''; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  const totPagine = Math.max(1, Math.ceil(filtrati.length / perPage));
  const slice = filtrati.slice((pagina - 1) * perPage, pagina * perPage);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sortIcon = (col: typeof sortCol) =>
    sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  const formatData = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('it-IT') : '—';

  return (
    <PageLayout>
      <PageLayout.Header title="Pazienti da Richiamare" />

      <PageLayout.ContentBody>
        <CRow className="g-3 align-items-start" style={{ height: 'calc(100vh - 250px)' }}>

          {/* Colonna sinistra: caricamento + filtri */}
          <CCol md={3} style={{ height: '100%', overflowY: 'auto' }}>

            {/* Card caricamento */}
            <CCard className="mb-3">
              <CCardHeader className="py-2 fw-bold small">Caricamento</CCardHeader>
              <CCardBody className="d-flex flex-column gap-3">
                <CFormCheck
                  id="cellulare"
                  label="Solo con cellulare"
                  checked={soloCellulare}
                  onChange={e => setSoloCellulare(e.target.checked)}
                />
                <CButton color="primary" onClick={carica} disabled={loading}>
                  {loading ? <CSpinner size="sm" /> : 'Carica pazienti'}
                </CButton>
                {caricato && !loading && (
                  <div className="text-muted small text-center">
                    {pazienti.length} pazienti caricati
                  </div>
                )}
              </CCardBody>
            </CCard>

            {/* Card filtri — visibile solo dopo il caricamento */}
            {caricato && !loading && pazienti.length > 0 && (
              <CCard>
                <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                  <span className="fw-bold small">
                    Filtri
                    {filtriAttivi > 0 && (
                      <CBadge color="primary" className="ms-2">{filtriAttivi}</CBadge>
                    )}
                  </span>
                  {filtriAttivi > 0 && (
                    <CButton color="ghost" size="sm" onClick={resetFiltri} className="text-muted p-0">
                      <CIcon icon={cilX} size="sm" /> Reset
                    </CButton>
                  )}
                </CCardHeader>
                <CCardBody className="d-flex flex-column gap-3">

                  {/* Tipo richiamo */}
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <CFormSwitch
                        id="sw-tipo"
                        checked={tipoOn}
                        onChange={e => { setTipoOn(e.target.checked); setPagina(1); }}
                      />
                      <CFormLabel htmlFor="sw-tipo" className="mb-0 small">Tipo richiamo</CFormLabel>
                    </div>
                    {tipoOn && (
                      <CFormSelect
                        size="sm"
                        value={tipoVal}
                        onChange={e => { setTipoVal(e.target.value); setPagina(1); }}
                      >
                        {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </CFormSelect>
                    )}
                  </div>

                  {/* Sesso */}
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <CFormSwitch
                        id="sw-sesso"
                        checked={sessoOn}
                        onChange={e => { setSessoOn(e.target.checked); setPagina(1); }}
                      />
                      <CFormLabel htmlFor="sw-sesso" className="mb-0 small">Sesso</CFormLabel>
                    </div>
                    {sessoOn && (
                      <div className="d-flex flex-column gap-1 ps-1">
                        {[{ v: '', l: 'Tutti' }, { v: 'M', l: 'Uomo' }, { v: 'F', l: 'Donna' }].map(opt => (
                          <CFormCheck
                            key={opt.v || 'tutti'}
                            type="radio"
                            id={`sesso-${opt.v || 'tutti'}`}
                            label={opt.l}
                            name="sesso-radio"
                            checked={sessoVal === opt.v}
                            onChange={() => { setSessoVal(opt.v); setPagina(1); }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Solo scaduti */}
                  <div className="d-flex align-items-center gap-2">
                    <CFormSwitch
                      id="sw-scaduti"
                      checked={scadutiOn}
                      onChange={e => { setScadutiOn(e.target.checked); setPagina(1); }}
                    />
                    <CFormLabel htmlFor="sw-scaduti" className="mb-0 small">Solo scaduti</CFormLabel>
                  </div>

                  {/* Ultima visita */}
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <CFormSwitch
                        id="sw-visita"
                        checked={visitaOn}
                        onChange={e => setVisitaOn(e.target.checked)}
                      />
                      <CFormLabel htmlFor="sw-visita" className="mb-0 small">Ultima visita</CFormLabel>
                    </div>
                    {visitaOn && (
                      <div className="d-flex flex-column gap-1">
                        <CFormInput
                          type="date"
                          size="sm"
                          value={visitaDa}
                          onChange={e => { setVisitaDa(e.target.value); setPagina(1); }}
                          placeholder="Da"
                        />
                        <CFormInput
                          type="date"
                          size="sm"
                          value={visitaA}
                          onChange={e => { setVisitaA(e.target.value); setPagina(1); }}
                          placeholder="A"
                        />
                      </div>
                    )}
                  </div>

                  {/* Ritardo minimo */}
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <CFormSwitch
                        id="sw-ritardo"
                        checked={ritardoOn}
                        onChange={e => setRitardoOn(e.target.checked)}
                      />
                      <CFormLabel htmlFor="sw-ritardo" className="mb-0 small">Ritardo minimo</CFormLabel>
                    </div>
                    {ritardoOn && (
                      <div className="d-flex align-items-center gap-2">
                        <CFormInput
                          type="number"
                          size="sm"
                          min={0}
                          value={ritardoMin}
                          onChange={e => { setRitardoMin(e.target.value); setPagina(1); }}
                          placeholder="gg"
                          style={{ width: 80 }}
                        />
                        <span className="text-muted small">giorni</span>
                      </div>
                    )}
                  </div>

                </CCardBody>
              </CCard>
            )}

          </CCol>

          {/* Colonna destra: tabella */}
          <CCol md={9} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {error && <div className="text-danger mb-3">{error}</div>}

            {!caricato && !loading && (
              <CCard>
                <CCardBody className="text-center text-muted py-5">
                  Clicca "Carica pazienti" per visualizzare i risultati
                </CCardBody>
              </CCard>
            )}

            {loading && (
              <CCard>
                <CCardBody className="text-center py-5">
                  <CSpinner color="primary" />
                </CCardBody>
              </CCard>
            )}

            {caricato && !loading && (
              <CCard className="d-flex flex-column flex-grow-1 overflow-hidden" style={{ minHeight: 0 }}>
                <CCardHeader className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">
                    {filtrati.length} pazienti
                    {filtriAttivi > 0 && (
                      <span className="text-muted fw-normal"> (su {pazienti.length} caricati)</span>
                    )}
                  </h6>
                  <CInputGroup style={{ width: 220 }}>
                    <CFormInput
                      placeholder="Cerca nome / telefono..."
                      value={cerca}
                      onChange={e => { setCerca(e.target.value); setPagina(1); }}
                      size="sm"
                    />
                  </CInputGroup>
                </CCardHeader>

                <div className="d-flex justify-content-between align-items-center px-3 pt-2">
                  <CFormSelect
                    size="sm"
                    style={{ width: 100 }}
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); setPagina(1); }}
                  >
                    {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / pag</option>)}
                  </CFormSelect>
                  <CPagination size="sm">
                    <CPaginationItem disabled={pagina === 1} onClick={() => setPagina(1)}>«</CPaginationItem>
                    <CPaginationItem disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹</CPaginationItem>
                    <CPaginationItem active>{pagina} / {totPagine}</CPaginationItem>
                    <CPaginationItem disabled={pagina === totPagine} onClick={() => setPagina(p => p + 1)}>›</CPaginationItem>
                    <CPaginationItem disabled={pagina === totPagine} onClick={() => setPagina(totPagine)}>»</CPaginationItem>
                  </CPagination>
                </div>

                <CCardBody className="p-0" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <CTable hover responsive striped small>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => toggleSort('nome')}>
                          Nome{sortIcon('nome')}
                        </CTableHeaderCell>
                        <CTableHeaderCell>Cellulare</CTableHeaderCell>
                        <CTableHeaderCell>Tipo richiamo</CTableHeaderCell>
                        <CTableHeaderCell>Ogni</CTableHeaderCell>
                        <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => toggleSort('ultima_visita')}>
                          Ultima visita{sortIcon('ultima_visita')}
                        </CTableHeaderCell>
                        <CTableHeaderCell>Scadenza</CTableHeaderCell>
                        <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => toggleSort('giorni_ritardo')}>
                          Ritardo{sortIcon('giorni_ritardo')}
                        </CTableHeaderCell>
                        <CTableHeaderCell>Stato</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {slice.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={8} className="text-center text-muted py-4">
                            Nessun paziente trovato
                          </CTableDataCell>
                        </CTableRow>
                      ) : (
                        slice.map(p => (
                          <CTableRow key={p.id}>
                            <CTableDataCell>
                              <strong>{p.nome}</strong>
                              {p.sesso && <small className="text-muted ms-1">({p.sesso})</small>}
                            </CTableDataCell>
                            <CTableDataCell>
                              {p.cellulare ? (
                                <span>
                                  <CIcon icon={cilPhone} size="sm" className="me-1 text-success" />
                                  {p.cellulare}
                                </span>
                              ) : (
                                <span className="text-muted">{p.telefono || '—'}</span>
                              )}
                            </CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex flex-wrap gap-1">
                                {p.tipo_richiamo_nomi.length > 0
                                  ? p.tipo_richiamo_nomi.map((nome, i) => (
                                    <CBadge
                                      key={i}
                                      style={{
                                        backgroundColor: TIPO_COLORS[p.tipo_richiamo[i]] ?? '#808080',
                                        color: 'white',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      {nome}
                                    </CBadge>
                                  ))
                                  : <span className="text-muted small">{p.tipo_richiamo || '—'}</span>
                                }
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>
                              {p.mesi_richiamo ? `${p.mesi_richiamo} mesi` : '—'}
                            </CTableDataCell>
                            <CTableDataCell>{formatData(p.ultima_visita)}</CTableDataCell>
                            <CTableDataCell>{formatData(p.data_richiamo_prevista)}</CTableDataCell>
                            <CTableDataCell>
                              {p.scaduto ? (
                                <span className="text-danger fw-bold">
                                  <CIcon icon={cilClock} size="sm" className="me-1" />
                                  {p.giorni_ritardo}gg
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </CTableDataCell>
                            <CTableDataCell>
                              {p.scaduto ? (
                                <CBadge color="danger">Scaduto</CBadge>
                              ) : (
                                <CBadge color="warning">Da richiamare</CBadge>
                              )}
                            </CTableDataCell>
                          </CTableRow>
                        ))
                      )}
                    </CTableBody>
                  </CTable>
                </CCardBody>

                <div className="d-flex justify-content-end px-3 pb-2">
                  <CPagination size="sm">
                    <CPaginationItem disabled={pagina === 1} onClick={() => setPagina(1)}>«</CPaginationItem>
                    <CPaginationItem disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹</CPaginationItem>
                    <CPaginationItem active>{pagina} / {totPagine}</CPaginationItem>
                    <CPaginationItem disabled={pagina === totPagine} onClick={() => setPagina(p => p + 1)}>›</CPaginationItem>
                    <CPaginationItem disabled={pagina === totPagine} onClick={() => setPagina(totPagine)}>»</CPaginationItem>
                  </CPagination>
                </div>
              </CCard>
            )}
          </CCol>

        </CRow>
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default RichiamiPage;
