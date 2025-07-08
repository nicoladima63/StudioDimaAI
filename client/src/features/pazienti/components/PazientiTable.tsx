import React, { useState, useMemo } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton, CFormInput, CFormSelect, CRow, CCol, CTooltip, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react';
import { cilCheck, cilX, cilCheckCircle, cilXCircle } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

export interface Paziente {
  DB_CODE: string;
  DB_PANOME: string;
  DB_PAINDIR: string;
  DB_PACITTA: string;
  DB_PACAP: string;
  DB_PAPROVI: string;
  DB_PATELEF: string;
  DB_PACELLU: string;
  DB_PADANAS: string;
  DB_PAULTVI: string;
  DB_PARICHI: string;
  DB_PARITAR: string;
  DB_PARIMOT: string;
  DB_PANONCU: string;
  DB_PAEMAIL: string;
}

interface PazientiTableProps {
  pazienti: Paziente[];
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

function formatDate(dateString: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

const PazientiTable: React.FC<PazientiTableProps> = ({ pazienti }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<'nome' | 'ultima_visita' | 'da_richiamare' | 'ogni' | 'in_cura'>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Paziente | null>(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    return pazienti.filter(p =>
      p.DB_PANOME.toLowerCase().includes(search.toLowerCase()) ||
      p.DB_CODE.toLowerCase().includes(search.toLowerCase()) ||
      (p.DB_PAEMAIL && p.DB_PAEMAIL.toLowerCase().includes(search.toLowerCase()))
    );
  }, [pazienti, search]);

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

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <CTable hover responsive bordered small>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell className="text-center">Codice</CTableHeaderCell>
            <CTableHeaderCell style={{ cursor: 'pointer' }} onClick={() => handleSort('nome')}>
              Nome {sortBy === 'nome' && (sortDir === 'asc' ? '▲' : '▼')}
            </CTableHeaderCell>
            <CTableHeaderCell className="text-center">Cellulare</CTableHeaderCell>
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
            <CTableHeaderCell>Email</CTableHeaderCell>
            <CTableHeaderCell></CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {paginated.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={11} className="text-center py-4">
                Nessun paziente trovato
              </CTableDataCell>
            </CTableRow>
          ) : (
            paginated.map((p, idx) => (
              <CTableRow key={idx}>
                <CTableDataCell className="text-center">{p.DB_CODE}</CTableDataCell>
                <CTableDataCell>{p.DB_PANOME}</CTableDataCell>
                <CTableDataCell className="text-center">{p.DB_PACELLU}</CTableDataCell>
                <CTableDataCell className="text-center">{formatDate(p.DB_PADANAS)}</CTableDataCell>
                <CTableDataCell className="text-center">{formatDate(p.DB_PAULTVI)}</CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.DB_PARICHI === 'S' ? <CIcon icon={cilCheckCircle} style={{ color: 'green', fontSize: 22 }} /> : ''}
                </CTableDataCell>
                <CTableDataCell className="text-center">{p.DB_PARITAR}</CTableDataCell>
                <CTableDataCell className="text-center">
                  <div className="d-flex justify-content-center align-items-center gap-1">
                    {(p.DB_PARIMOT || '').replace(/[^1-6]/g, '').split('').map((codice, i) => {
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
                    })}
                  </div>
                </CTableDataCell>
                <CTableDataCell className="text-center">
                  {p.DB_PANONCU === 'S' ? (
                    <CIcon icon={cilXCircle} style={{ color: 'red', fontSize: 22 }} />
                  ) : (
                    <CIcon icon={cilCheckCircle} style={{ color: 'green', fontSize: 22 }} />
                  )}
                </CTableDataCell>
                <CTableDataCell>{p.DB_PAEMAIL}</CTableDataCell>
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
            {filtered.length} pazienti totali
          </small>
        </div>
      </div>
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>{selected?.DB_PANOME || 'Dettagli paziente'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selected && (
            <CRow>
              <CCol md={6}>
                <ul className="list-unstyled">
                  <li><b>Codice:</b> {selected.DB_CODE}</li>
                  <li><b>Nome:</b> {selected.DB_PANOME}</li>
                  <li><b>Indirizzo:</b> {selected.DB_PAINDIR}</li>
                  <li><b>Comune:</b> {selected.DB_PACITTA}</li>
                  <li><b>CAP:</b> {selected.DB_PACAP}</li>
                  <li><b>Provincia:</b> {selected.DB_PAPROVI}</li>
                  <li><b>Telefono:</b> {selected.DB_PATELEF}</li>
                  <li><b>Cellulare:</b> {selected.DB_PACELLU}</li>
                  <li><b>Email:</b> {selected.DB_PAEMAIL}</li>
                </ul>
              </CCol>
              <CCol md={6}>
                <ul className="list-unstyled">
                  <li><b>Data nascita:</b> {formatDate(selected.DB_PADANAS)}</li>
                  <li><b>Ultima visita:</b> {formatDate(selected.DB_PAULTVI)}</li>
                  <li><b>Da richiamare:</b> {selected.DB_PARICHI === 'S' ? 'Sì' : 'No'}</li>
                  <li><b>Ogni:</b> {selected.DB_PARITAR}</li>
                  <li><b>Tipo richiamo:</b> {selected.DB_PARIMOT}</li>
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