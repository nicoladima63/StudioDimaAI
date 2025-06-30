import React, { useEffect, useState, useMemo } from 'react';
import { getAllFatture } from '@/api/apiClient';
import DashboardCard from '@/components/DashboardCard';
import StatWidget from '@/components/StatWidget';
import { CRow, CCol, CButton, CSpinner, CPagination, CPaginationItem, CFormSelect } from '@coreui/react';
import { cilCreditCard, cilMoney } from '@coreui/icons';

interface Fattura {
  id: string;
  data_incasso: string;
  importo: number;
  metodo: string;
  banca_cassa: string;
  esenzione_iva: boolean;
  marca_bollo: number;
}

const ORE_OBSOLESCENZA = 48;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const MONTHS = [
  { value: '', label: 'Tutti i mesi' },
  { value: '1', label: 'Gennaio' },
  { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' },
  { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' },
  { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Dicembre' },
];

function formatDateIT(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT');
}

const FatturePage: React.FC = () => {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [obsoleto, setObsoleto] = useState(false);
  const [anno, setAnno] = useState<number | null>(null);
  const [mese, setMese] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Statistiche rapide
  const totaleFatture = fatture.length;
  const totaleIncassi = fatture.reduce((sum, f) => sum + (f.importo || 0), 0);

  // Anni disponibili (solo anni validi)
  const anniDisponibili = useMemo(() => {
    const anni = new Set<number>();
    fatture.forEach(f => {
      const d = new Date(f.data_incasso);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) anni.add(d.getFullYear());
    });
    return Array.from(anni).sort((a, b) => b - a);
  }, [fatture]);

  // Imposta anno di default appena arrivano i dati
  useEffect(() => {
    if (anniDisponibili.length > 0 && (anno === null || !anniDisponibili.includes(anno))) {
      setAnno(anniDisponibili[0]);
    }
  }, [anniDisponibili, anno]);

  // Filtro e ordinamento
  const fattureFiltrate = useMemo(() => {
    let filtered = fatture;
    if (anno) {
      filtered = filtered.filter(f => {
        const d = new Date(f.data_incasso);
        return !isNaN(d.getTime()) && d.getFullYear() === anno;
      });
    }
    if (mese) {
      filtered = filtered.filter(f => {
        const d = new Date(f.data_incasso);
        return !isNaN(d.getTime()) && (d.getMonth() + 1) === parseInt(mese);
      });
    }
    // Ordina decrescente per data
    filtered = filtered.slice().sort((a, b) => {
      const da = new Date(a.data_incasso).getTime();
      const db = new Date(b.data_incasso).getTime();
      return db - da;
    });
    return filtered;
  }, [fatture, anno, mese]);

  // Paginazione
  const totalPages = Math.ceil(fattureFiltrate.length / pageSize) || 1;
  const paginatedFatture = fattureFiltrate.slice((page - 1) * pageSize, page * pageSize);

  const aggiorna = () => {
    setLoading(true);
    setErrore(null);
    getAllFatture()
      .then(({ fatture, last_update }) => {
        setFatture(fatture);
        setLastUpdate(last_update);
        setLoading(false);
        if (last_update) {
          const diffOre = (Date.now() - new Date(last_update).getTime()) / 1000 / 3600;
          setObsoleto(diffOre > ORE_OBSOLESCENZA);
        }
      })
      .catch(() => {
        setErrore('Errore nel recupero delle fatture');
        setLoading(false);
      });
  };

  useEffect(() => {
    aggiorna();
    // eslint-disable-next-line
  }, []);

  // Reset pagina quando cambiano filtri
  useEffect(() => {
    setPage(1);
  }, [anno, mese, pageSize]);

  return (
    <DashboardCard
      title="Fatture"
      headerAction={
        <CButton color="primary" size="sm" onClick={aggiorna} disabled={loading}>
          Aggiorna
        </CButton>
      }
    >
      <CRow className="mb-4">
        <CCol sm={6} lg={3}>
          <StatWidget color="primary" value={fattureFiltrate.length} title="Numero fatture" icon={cilCreditCard} />
        </CCol>
        <CCol sm={6} lg={3}>
          <StatWidget color="success" value={fattureFiltrate.reduce((sum, f) => sum + (f.importo || 0), 0).toFixed(2) + ' €'} title="Totale incassi" icon={cilMoney} />
        </CCol>
      </CRow>
      <CRow className="mb-3">
        <CCol xs={12} md={3}>
          <CFormSelect
            label="Anno"
            value={anno || ''}
            onChange={e => setAnno(Number(e.target.value))}
          >
            {anniDisponibili.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={3}>
          <CFormSelect
            label="Mese"
            value={mese}
            onChange={e => setMese(e.target.value)}
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={3}>
          <CFormSelect
            label="Righe per pagina"
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>
      {obsoleto && <div className="alert alert-warning">I dati potrebbero essere obsoleti (ultimo aggiornamento: {lastUpdate})</div>}
      {errore && <div className="alert alert-danger">{errore}</div>}
      {loading ? (
        <div className="text-center py-4">
          <CSpinner color="primary" />
          <p>Caricamento dati in corso...</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data incasso</th>
                  <th>Importo</th>
                  <th>Metodo</th>
                  <th>Banca/Cassa</th>
                  <th>Esenzione IVA</th>
                  <th>Marca bollo</th>
                </tr>
              </thead>
              <tbody>
                {paginatedFatture.map((f, idx) => (
                  <tr key={`${f.id || 'noid'}_${f.data_incasso || 'nodate'}_${idx}`} className={f.importo === 0 ? 'table-danger' : ''}>
                    <td>{f.id}</td>
                    <td>{formatDateIT(f.data_incasso)}</td>
                    <td>{f.importo.toFixed(2)}</td>
                    <td>{f.metodo}</td>
                    <td>{f.banca_cassa}</td>
                    <td>{f.esenzione_iva ? 'Sì' : 'No'}</td>
                    <td>{f.marca_bollo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span>Pagina {page} di {totalPages}</span>
            <CPagination align="end">
              <CPaginationItem disabled={page === 1} onClick={() => setPage(page - 1)}>&laquo;</CPaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <CPaginationItem key={i} active={i + 1 === page} onClick={() => setPage(i + 1)}>{i + 1}</CPaginationItem>
              ))}
              <CPaginationItem disabled={page === totalPages} onClick={() => setPage(page + 1)}>&raquo;</CPaginationItem>
            </CPagination>
          </div>
        </>
      )}
    </DashboardCard>
  );
};

export default FatturePage; 