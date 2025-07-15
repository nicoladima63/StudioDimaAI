import React, { useEffect, useState, useMemo } from 'react';
import { getAllFatture, getAnniFatture } from '@/api/services/fatture.service';
import { Card, StatWidget } from '@/components/ui';
import { CRow, CCol, CButton, CSpinner, CPagination, CPaginationItem, CFormSelect } from '@coreui/react';
import { cilCreditCard, cilMoney } from '@coreui/icons';

interface Fattura {
  fatturaid: string;
  fatturadata: string;
  fatturaimporto: number;
  fatturamodopagamento: string;
  fatturabanca: string;
  fatturabollo: number;
  // Aggiungi altri campi se necessario, basandoti su `COLONNE`
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
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);

  // Carica gli anni disponibili all'avvio
  useEffect(() => {
    setLoading(true);
    getAnniFatture()
      .then(anni => {
        setAnniDisponibili(anni);
        if (anni.length > 0) {
          setAnno(anni[0]); // Imposta l'anno più recente come default
        }
        setLoading(false);
      })
      .catch(() => {
        setErrore('Errore nel recupero degli anni');
        setLoading(false);
      });
  }, []);

  // Filtro e ordinamento
  const fattureFiltrate = useMemo(() => {
    let filtered = fatture;
    if (anno) {
      filtered = filtered.filter(f => {
        const d = new Date(f.fatturadata);
        return !isNaN(d.getTime()) && d.getFullYear() === anno;
      });
    }
    if (mese) {
      filtered = filtered.filter(f => {
        const d = new Date(f.fatturadata);
        return !isNaN(d.getTime()) && (d.getMonth() + 1) === parseInt(mese);
      });
    }
    // Ordina decrescente per data
    filtered = filtered.slice().sort((a, b) => {
      const da = new Date(a.fatturadata).getTime();
      const db = new Date(b.fatturadata).getTime();
      return db - da;
    });
    return filtered;
  }, [fatture, anno, mese]);

  // Paginazione
  const totalPages = Math.ceil(fattureFiltrate.length / pageSize) || 1;
  const paginatedFatture = fattureFiltrate.slice((page - 1) * pageSize, page * pageSize);

  const aggiorna = () => {
    if (!anno) {
      setErrore("Seleziona un anno per aggiornare i dati.");
      return;
    }
    setLoading(true);
    setErrore(null);
    getAllFatture(anno, mese)
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

  // Non caricare tutto all'inizio, ma solo su richiesta
  // useEffect(() => {
  //   aggiorna();
  //   // eslint-disable-next-line
  // }, []);

  // Reset pagina quando cambiano filtri
  useEffect(() => {
    setPage(1);
  }, [anno, mese, pageSize]);

  return (
    <Card
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
          <StatWidget color="success" value={fattureFiltrate.reduce((sum, f) => sum + (f.fatturaimporto || 0), 0).toFixed(2) + ' €'} title="Totale incassi" icon={cilMoney} />
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
                  <th>Data</th>
                  <th>Importo</th>
                  <th>Metodo</th>
                  <th>Banca/Cassa</th>
                  <th>Bollo</th>
                </tr>
              </thead>
              <tbody>
                {paginatedFatture.map((f, idx) => (
                  <tr key={`${f.fatturaid || 'noid'}_${f.fatturadata || 'nodate'}_${idx}`} className={f.fatturaimporto === 0 ? 'table-danger' : ''}>
                    <td>{f.fatturaid}</td>
                    <td>{formatDateIT(f.fatturadata)}</td>
                    <td>{f.fatturaimporto.toFixed(2)}</td>
                    <td>{f.fatturamodopagamento}</td>
                    <td>{f.fatturabanca}</td>
                    <td>{f.fatturabollo}</td>
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
    </Card>
  );
};

export default FatturePage; 