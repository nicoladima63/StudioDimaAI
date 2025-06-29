import React, { useState, useMemo } from 'react';
import { CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton, CFormInput, CFormSelect, CRow, CCol } from '@coreui/react';

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

const PazientiTable: React.FC<PazientiTableProps> = ({ pazienti }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<'nome' | 'ultima_visita'>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    return pazienti.filter(p =>
      p.DB_PANOME.toLowerCase().includes(search.toLowerCase()) ||
      p.DB_CODE.toLowerCase().includes(search.toLowerCase()) ||
      (p.DB_PAEMAIL && p.DB_PAEMAIL.toLowerCase().includes(search.toLowerCase()))
    );
  }, [pazienti, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === 'nome') {
      arr.sort((a, b) => sortDir === 'asc'
        ? a.DB_PANOME.localeCompare(b.DB_PANOME)
        : b.DB_PANOME.localeCompare(a.DB_PANOME));
    } else if (sortBy === 'ultima_visita') {
      arr.sort((a, b) => {
        const dA = a.DB_PAULTVI || '';
        const dB = b.DB_PAULTVI || '';
        return sortDir === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
      });
    }
    return arr;
  }, [filtered, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  return (
    <div>
      <CRow className="mb-2">
        <CCol md={4}>
          <CFormInput
            placeholder="Cerca per nome, codice o email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </CCol>
        <CCol md={2}>
          <CFormSelect
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} per pagina</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={3}>
          <CFormSelect
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'nome' | 'ultima_visita')}
          >
            <option value="nome">Ordina per nome</option>
            <option value="ultima_visita">Ordina per ultima visita</option>
          </CFormSelect>
        </CCol>
        <CCol md={2}>
          <CFormSelect
            value={sortDir}
            onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </CFormSelect>
        </CCol>
      </CRow>
      <CTable hover responsive bordered small>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Codice</CTableHeaderCell>
            <CTableHeaderCell>Nome</CTableHeaderCell>
            <CTableHeaderCell>Indirizzo</CTableHeaderCell>
            <CTableHeaderCell>Comune</CTableHeaderCell>
            <CTableHeaderCell>CAP</CTableHeaderCell>
            <CTableHeaderCell>Provincia</CTableHeaderCell>
            <CTableHeaderCell>Telefono</CTableHeaderCell>
            <CTableHeaderCell>Cellulare</CTableHeaderCell>
            <CTableHeaderCell>Data nascita</CTableHeaderCell>
            <CTableHeaderCell>Ultima visita</CTableHeaderCell>
            <CTableHeaderCell>Richiamo</CTableHeaderCell>
            <CTableHeaderCell>Mesi richiamo</CTableHeaderCell>
            <CTableHeaderCell>Tipo richiamo</CTableHeaderCell>
            <CTableHeaderCell>Non in cura</CTableHeaderCell>
            <CTableHeaderCell>Email</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {paginated.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={15} className="text-center py-4">
                Nessun paziente trovato
              </CTableDataCell>
            </CTableRow>
          ) : (
            paginated.map((p, idx) => (
              <CTableRow key={idx}>
                <CTableDataCell>{p.DB_CODE}</CTableDataCell>
                <CTableDataCell>{p.DB_PANOME}</CTableDataCell>
                <CTableDataCell>{p.DB_PAINDIR}</CTableDataCell>
                <CTableDataCell>{p.DB_PACITTA}</CTableDataCell>
                <CTableDataCell>{p.DB_PACAP}</CTableDataCell>
                <CTableDataCell>{p.DB_PAPROVI}</CTableDataCell>
                <CTableDataCell>{p.DB_PATELEF}</CTableDataCell>
                <CTableDataCell>{p.DB_PACELLU}</CTableDataCell>
                <CTableDataCell>{p.DB_PADANAS}</CTableDataCell>
                <CTableDataCell>{p.DB_PAULTVI}</CTableDataCell>
                <CTableDataCell>{p.DB_PARICHI}</CTableDataCell>
                <CTableDataCell>{p.DB_PARITAR}</CTableDataCell>
                <CTableDataCell>{p.DB_PARIMOT}</CTableDataCell>
                <CTableDataCell>{p.DB_PANONCU}</CTableDataCell>
                <CTableDataCell>{p.DB_PAEMAIL}</CTableDataCell>
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
            &lt; Prev
          </CButton>
          <span className="mx-2">Pagina {page} di {totalPages}</span>
          <CButton
            color="light"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </CButton>
        </div>
        <div>
          <small className="text-muted">
            {filtered.length} pazienti totali
          </small>
        </div>
      </div>
    </div>
  );
};

export default PazientiTable; 