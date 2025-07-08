import React, { useState } from 'react';
import { getIncassiByPeriodo } from '../services/incassi.service';
import { CAlert, CSpinner, CButton, CFormInput, CFormSelect, CBadge } from '@coreui/react';
import IncassiTable from './IncassiTable';

const IncassiDashboard: React.FC = () => {
  const [anno, setAnno] = useState('');
  const [tipo, setTipo] = useState('Mese');
  const [numero, setNumero] = useState('');
  const [dati, setDati] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errore, setErrore] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrore(null);
    try {
      const res = await getIncassiByPeriodo(anno, tipo, numero);
      setDati(res.data.data);
    } catch (err: any) {
      setErrore(err?.response?.data?.error || 'Errore nella richiesta');
      setDati(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="d-flex align-items-end gap-3 flex-wrap mb-4">
        <div>
          <label className="form-label">Anno</label>
          <CFormInput value={anno} onChange={e => setAnno(e.target.value)} placeholder="Anno" />
        </div>
        <div>
          <label className="form-label">Tipo</label>
          <CFormSelect value={tipo} onChange={e => setTipo(e.target.value)}>
            <option>Mese</option>
            <option>Trimestre</option>
            <option>Quadrimestre</option>
          </CFormSelect>
        </div>
        <div>
          <label className="form-label">Numero</label>
          <CFormInput value={numero} onChange={e => setNumero(e.target.value)} placeholder="Numero" />
        </div>
        <CButton color="primary" type="submit" className="mb-1">
          <i className="bi bi-search me-1" /> Cerca
        </CButton>
        {dati && (
          <>
            <CBadge color="primary" className="ms-2" style={{ fontSize: '1em' }}>
              Fatture: {dati.numero_fatture}
            </CBadge>
            <CBadge color="success" className="ms-2" style={{ fontSize: '1em' }}>
              Totale: € {dati.importo_totale?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </CBadge>
          </>
        )}
      </form>
      {loading && (
        <div className="text-center py-2">
          <CSpinner color="primary" />
          <span className="ms-2">Caricamento...</span>
        </div>
      )}
      {errore && <CAlert color="danger">{errore}</CAlert>}
      {dati && (
        <IncassiTable incassi={dati.incassi} />
      )}
    </>
  );
};

export default IncassiDashboard; 