import React, { useState, useMemo } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton, CFormInput, CFormSelect, CRow, CCol, CTooltip, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CDropdown, CDropdownToggle, CDropdownMenu, CDropdownItem, CInputGroup, CInputGroupText } from '@coreui/react';
import { cilCheckCircle, cilXCircle, cilSearch, cilLocationPin, cilFilter, cilReload, cilCloudDownload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { PazienteCompleto } from '@/lib/types';

interface PazientiTableProps {
  pazienti: PazienteCompleto[];
  loading?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Mappa decodifica tipo richiamo (come RecallsTable/backend)
const TIPO_RICHIAMI_LABEL: Record<string, string> = {
  '1': 'Generico',
  '2': 'Igiene',
  '3': 'Rx Impianto',
  '4': 'Controllo',
  '5': 'Impianto',
  '6': 'Ortodonzia',
};

const COLORI_RICHIAMI: Record<string, string> = {
  'Generico': '#008000', // verde
  'Igiene': '#800080',   // violetto
  'Rx Impianto': '#FFFF00', // giallo
  'Controllo': '#ADD8E6', // azzurro
  'Impianto': '#00BFFF', // indaco
  'Ortodonzia': '#FFC0CB', // rosa
};

const getTipoColor = (tipo: string) => COLORI_RICHIAMI[tipo] || '#888';

function formatDate(dateString: string | null) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

const PazientiTable: React.FC<PazientiTableProps> = ({ pazienti, loading = false }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<'nome' | 'ultima_visita' | 'da_richiamare' | 'ogni' | 'in_cura'>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<PazienteCompleto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [cittaFilter, setCittaFilter] = useState<string>('');
  const [prioritaFilter, setPrioritaFilter] = useState<string>('');
  const [statoFilter, setStatoFilter] = useState<string>('');

  const filtered = useMemo(() => {
    return pazienti.filter(p => {
      // Filtro testo
      const matchText = p.DB_PANOME.toLowerCase().includes(search.toLowerCase()) ||
        p.DB_CODE.toLowerCase().includes(search.toLowerCase()) ||
        p.nome_completo.toLowerCase().includes(search.toLowerCase()) ||
        p.citta_clean.toLowerCase().includes(search.toLowerCase()) ||
        (p.DB_PAEMAIL && p.DB_PAEMAIL.toLowerCase().includes(search.toLowerCase())) ||
        (p.DB_PACELLU && String(p.DB_PACELLU).toLowerCase().includes(search.toLowerCase())) ||
        (p.DB_PATELEF && String(p.DB_PATELEF).toLowerCase().includes(search.toLowerCase())) ||
        (p.numero_contatto && String(p.numero_contatto).toLowerCase().includes(search.toLowerCase()));
      
      // Filtro città
      const matchCitta = !cittaFilter || p.citta_clean === cittaFilter;
      
      // Filtro priorità
      const matchPriorita = !prioritaFilter || p.recall_priority === prioritaFilter;
      
      // Filtro stato
      const matchStato = !statoFilter || p.recall_status === statoFilter;
      
      return matchText && matchCitta && matchPriorita && matchStato;
    });
  }, [pazienti, search, cittaFilter, prioritaFilter, statoFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'nome':
        arr.sort((a, b) => sortDir === 'asc'
          ? a.DB_PANOME.localeCompare(b.DB_PANOME)
          : b.DB_PANOME.localeCompare(a.DB_PANOME));
        break;
      case 'ultima_visita':
        arr.sort((a, b) => {
          const dA = a.DB_PAULTVI || '';
          const dB = b.DB_PAULTVI || '';
          return sortDir === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        });
        break;
      case 'da_richiamare':
        arr.sort((a, b) => {
          const vA = a.DB_PARICHI === 'S' ? 1 : 0;
          const vB = b.DB_PARICHI === 'S' ? 1 : 0;
          return sortDir === 'asc' ? vA - vB : vB - vA;
        });
        break;
      case 'ogni':
        arr.sort((a, b) => {
          const nA = Number(a.DB_PARITAR) || 0;
          const nB = Number(b.DB_PARITAR) || 0;
          return sortDir === 'asc' ? nA - nB : nB - nA;
        });
        break;
      case 'in_cura':
        arr.sort((a, b) => {
          const vA = a.DB_PANONCU === 'S' ? 0 : 1;
          const vB = b.DB_PANONCU === 'S' ? 0 : 1;
          return sortDir === 'asc' ? vA - vB : vB - vA;
        });
        break;
      default:
        break;
    }
    return arr;
  }, [filtered, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  // Lista città uniche per il dropdown
  const cittaOptions = useMemo(() => {
    const citta = [...new Set(pazienti.map(p => p.citta_clean))].filter(Boolean).sort();
    return citta;
  }, [pazienti]);

  // Opzioni priorità
  const prioritaOptions = ['high', 'medium', 'low'];
  
  // Opzioni stato
  const statoOptions = ['scaduto', 'in_scadenza', 'futuro'];

  // Funzioni
  const handleRefresh = () => {
    alert('Funzione aggiorna: qui andrà la chiamata API per ricaricare i pazienti');
  };

  const handleExport = () => {
    alert('Funzione esporta: qui andrà l\'esportazione dei dati filtrati');
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Caricamento pazienti...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Barra di ricerca */}
      <CRow className="mb-3 align-items-center">
        <CCol md={6}>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <CFormInput
              placeholder="Cerca per nome, codice, email, città, telefono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <CButton
                color="outline-secondary"
                onClick={() => setSearch('')}
                style={{ borderLeft: 'none' }}
              >
                ✕
              </CButton>
            )}
          </CInputGroup>
        </CCol>
        <CCol md="auto" className="d-flex gap-2 align-items-center">
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilLocationPin} className="me-1" /> 
              {cittaFilter || 'Città'}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem onClick={() => setCittaFilter('')}>Tutte le città</CDropdownItem>
              {cittaOptions.map(citta => (
                <CDropdownItem 
                  key={citta} 
                  onClick={() => setCittaFilter(citta)}
                  active={cittaFilter === citta}
                >
                  {citta}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilFilter} className="me-1" /> 
              {prioritaFilter || 'Priorità'}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem onClick={() => setPrioritaFilter('')}>Tutte</CDropdownItem>
              {prioritaOptions.map(priorita => (
                <CDropdownItem 
                  key={priorita} 
                  onClick={() => setPrioritaFilter(priorita)}
                  active={prioritaFilter === priorita}
                >
                  {priorita.charAt(0).toUpperCase() + priorita.slice(1)}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <CDropdown>
            <CDropdownToggle color="outline-secondary" size="sm">
              <CIcon icon={cilFilter} className="me-1" /> 
              {statoFilter || 'Stato'}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem onClick={() => setStatoFilter('')}>Tutti</CDropdownItem>
              {statoOptions.map(stato => (
                <CDropdownItem 
                  key={stato} 
                  onClick={() => setStatoFilter(stato)}
                  active={statoFilter === stato}
                >
                  {stato.charAt(0).toUpperCase() + stato.slice(1)}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <CButton color="outline-primary" size="sm" onClick={handleRefresh}>
            <CIcon icon={cilReload} className="me-1" /> Aggiorna
          </CButton>
          <CButton color="outline-primary" size="sm" onClick={handleExport}>
            <CIcon icon={cilCloudDownload} className="me-1" /> Esporta
          </CButton>
        </CCol>
        <CCol className="d-flex justify-content-end align-items-center gap-2">
          <CFormSelect
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ width: 140 }}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size} per pagina</option>
            ))}
          </CFormSelect>
          <CButton
            color="light"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            &lt;
          </CButton>
          <span className="mx-1">{page} / {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            &gt;
          </CButton>
        </CCol>
      </CRow>

      <CTable hover responsive bordered small>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell className="text-center">Codice</CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('nome')}>
              Nome {sortBy === 'nome' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Città</CTableHeaderCell>
            <CTableHeaderCell className="text-center">Contatto</CTableHeaderCell>
            <CTableHeaderCell className="text-center">Data nascita</CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('ultima_visita')}>
              Ultima visita {sortBy === 'ultima_visita' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('da_richiamare')}>
              Da richiamare {sortBy === 'da_richiamare' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('ogni')}>
              Ogni {sortBy === 'ogni' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Tipo richiamo</CTableHeaderCell>
            <CTableHeaderCell className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleSort('in_cura')}>
              In cura {sortBy === 'in_cura' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Priorità</CTableHeaderCell>
            <CTableHeaderCell></CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {paginated.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={12} className="text-center py-4">
                Nessun paziente trovato
              </CTableDataCell>
            </CTableRow>
          ) : (
            paginated.map((p) => (
              <CTableRow key={p.DB_CODE}>
                <CTableDataCell className="text-center">{p.DB_CODE}</CTableDataCell>
                <CTableDataCell>
                  <strong>{p.nome_completo}</strong>
                </CTableDataCell>
                <CTableDataCell className="text-center">{p.citta_clean}</CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.numero_contatto ? (
                    <span className="text-success">{p.numero_contatto}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">{formatDate(p.DB_PADANAS)}</CTableDataCell>
                <CTableDataCell className="text-center">
                  {formatDate(p.DB_PAULTVI)}
                  {p.giorni_ultima_visita && (
                    <small className="text-muted"><br />{p.giorni_ultima_visita} giorni fa</small>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.needs_recall ? (
                    <CIcon icon={cilCheckCircle} style={{ color: 'green', fontSize: 22 }} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">{p.DB_PARITAR}</CTableDataCell>
                <CTableDataCell className="text-center">
                  <div className="d-flex justify-content-center align-items-center gap-1 flex-wrap">
                    {p.tipo_richiamo_desc && p.tipo_richiamo_desc !== 'Sconosciuto' ? (
                      <span
                        style={{
                          background: getTipoColor(p.tipo_richiamo_desc),
                          color: '#fff',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontSize: '0.85em',
                          fontWeight: 500,
                          display: 'inline-block',
                        }}
                      >
                        {p.tipo_richiamo_desc}
                      </span>
                    ) : (
                      // Fallback per codici multipli (come nel vecchio sistema)
                      (p.DB_PARIMOT || '').replace(/[^1-6]/g, '').split('').map((codice, i) => {
                        const label = TIPO_RICHIAMI_LABEL[codice] || codice;
                        return (
                          <CTooltip content={label} key={i} placement="top">
                            <span
                              style={{
                                background: getTipoColor(label),
                                borderRadius: '12px',
                                width: 22,
                                height: 22,
                                display: 'inline-block',
                                marginRight: 2,
                                marginBottom: 2,
                                cursor: 'pointer',
                              }}
                            />
                          </CTooltip>
                        );
                      })
                    )}
                  </div>
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.DB_PANONCU === 'S' ? (
                    <CIcon icon={cilXCircle} style={{ color: 'red', fontSize: 22 }} />
                  ) : (
                    <CIcon icon={cilCheckCircle} style={{ color: 'green', fontSize: 22 }} />
                  )}
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.needs_recall && (
                    <span className={`badge bg-${
                      p.recall_priority === 'high' ? 'danger' : 
                      p.recall_priority === 'medium' ? 'warning' : 
                      p.recall_priority === 'low' ? 'info' : 'secondary'
                    }`}>
                      {p.recall_priority}
                    </span>
                  )}
                </CTableDataCell>
                <CTableDataCell className="p-1 w-auto text-center" style={{ minWidth: 0, width: 1 }}>
                  <CButton size="sm" color="info" onClick={() => { setSelected(p); setShowModal(true); }}>
                    Dettagli
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))
          )}
        </CTableBody>
      </CTable>

      {/* Paginazione */}
      <div className="d-flex justify-content-between align-items-center mt-2">
        <div>
          <CButton
            color="light"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            &lt; Prec
          </CButton>
          <span className="mx-2">Pagina {page} di {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Succ &gt;
          </CButton>
        </div>
        <div>
          <small className="text-muted">
            Mostrando {paginated.length} di {filtered.length} pazienti
            {search && ' (filtrati)'}
          </small>
        </div>
      </div>

      {/* Modal dettagli */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>{selected?.nome_completo || 'Dettagli paziente'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selected && (
            <CRow>
              <CCol md={6}>
                <ul className="list-unstyled">
                  <li><b>Codice:</b> {selected.DB_CODE}</li>
                  <li><b>Nome:</b> {selected.nome_completo}</li>
                  <li><b>Indirizzo:</b> {selected.DB_PAINDIR}</li>
                  <li><b>Città:</b> {selected.citta_clean}</li>
                  <li><b>CAP:</b> {selected.cap_clean}</li>
                  <li><b>Provincia:</b> {selected.provincia_clean}</li>
                  <li><b>Contatto:</b> {selected.numero_contatto}</li>
                  <li><b>Email:</b> {selected.DB_PAEMAIL}</li>
                </ul>
              </CCol>
              <CCol md={6}>
                <ul className="list-unstyled">
                  <li><b>Data nascita:</b> {formatDate(selected.DB_PADANAS)}</li>
                  <li><b>Ultima visita:</b> {formatDate(selected.DB_PAULTVI)}</li>
                  <li><b>Giorni ultima visita:</b> {selected.giorni_ultima_visita || '-'}</li>
                  <li><b>Necessita richiamo:</b> {selected.needs_recall ? 'Sì' : 'No'}</li>
                  <li><b>Priorità richiamo:</b> {selected.recall_priority}</li>
                  <li><b>Stato richiamo:</b> {selected.recall_status}</li>
                  <li><b>Tipo richiamo:</b> {selected.tipo_richiamo_desc}</li>
                  <li><b>In cura:</b> {selected.DB_PANONCU === 'S' ? 'No' : 'Sì'}</li>
                </ul>
              </CCol>
            </CRow>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowModal(false)}>Chiudi</CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default PazientiTable;