import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CBadge,
  CFormSelect,
  CButton
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilChart } from '@coreui/icons';

import statisticheService, { type MaterialiStats } from '../services/statistiche.service';

const MaterialiDentaliTab: React.FC = () => {
  const [stats, setStats] = useState<MaterialiStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('anno_corrente');

  useEffect(() => {
    fetchMaterialiStats();
  }, [periodo]);

  const fetchMaterialiStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await statisticheService.apiGetMaterialiDentali(periodo);
      
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Errore nel caricamento statistiche');
      }
    } catch (err) {
      console.error('Errore fetch statistiche materiali:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const totaleGenerale = stats.reduce((sum, item) => sum + item.totale_spesa, 0);

  return (
    <CRow>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">Materiali Dentali - Resoconto Spese</h5>
              <small className="text-muted">
                Analisi spese per macro categoria materiali dentali
              </small>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <CFormSelect
                size="sm"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="mese_corrente">Mese corrente</option>
                <option value="ultimi_3_mesi">Ultimi 3 mesi</option>
                <option value="ultimi_6_mesi">Ultimi 6 mesi</option>
                <option value="anno_corrente">Anno corrente</option>
                <option value="anno_precedente">Anno precedente</option>
              </CFormSelect>
              <CButton 
                size="sm" 
                color="primary" 
                variant="outline"
                onClick={fetchMaterialiStats}
              >
                <CIcon icon={cilChart} size="sm" className="me-1" />
                Aggiorna
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {loading && (
              <div className="text-center p-4">
                <CSpinner />
                <div className="mt-2">Caricamento statistiche...</div>
              </div>
            )}
            
            {error && (
              <CAlert color="danger">
                <strong>Errore:</strong> {error}
              </CAlert>
            )}
            
            {!loading && !error && stats.length === 0 && (
              <CAlert color="info">
                <CIcon icon={cilCalendar} className="me-2" />
                Nessuna spesa per materiali dentali trovata nel periodo selezionato.
              </CAlert>
            )}
            
            {!loading && !error && stats.length > 0 && (
              <>
                {/* Riepilogo generale */}
                <CRow className="mb-4">
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-primary">{formatCurrency(totaleGenerale)}</h4>
                      <small className="text-muted">Totale Speso</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-info">{stats.length}</h4>
                      <small className="text-muted">Categorie Attive</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-success">
                        {stats.reduce((sum, item) => sum + item.numero_fatture, 0)}
                      </h4>
                      <small className="text-muted">Fatture Totali</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-warning">
                        {formatCurrency(totaleGenerale / stats.reduce((sum, item) => sum + item.numero_fatture, 0) || 0)}
                      </h4>
                      <small className="text-muted">Spesa Media</small>
                    </div>
                  </CCol>
                </CRow>

                {/* Tabella dettagliata */}
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Categoria</CTableHeaderCell>
                      <CTableHeaderCell>Sottocategoria</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Totale Spesa</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">N. Fatture</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Spesa Media</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">% sul Totale</CTableHeaderCell>
                      <CTableHeaderCell>Ultimo Acquisto</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {stats
                      .sort((a, b) => b.totale_spesa - a.totale_spesa)
                      .map((item, index) => (
                        <CTableRow key={`${item.conto_nome}-${item.branca_nome}-${index}`}>
                          <CTableDataCell>
                            <strong>{item.conto_nome}</strong>
                          </CTableDataCell>
                          <CTableDataCell>
                            {item.branca_nome && (
                              <CBadge color="info" className="me-1">
                                {item.branca_nome}
                              </CBadge>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <strong className="text-primary">
                              {formatCurrency(item.totale_spesa)}
                            </strong>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <CBadge color="secondary">
                              {item.numero_fatture}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            {formatCurrency(item.spesa_media)}
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <CBadge 
                              color={item.percentuale_sul_totale > 20 ? 'danger' : 
                                    item.percentuale_sul_totale > 10 ? 'warning' : 'success'}
                            >
                              {item.percentuale_sul_totale.toFixed(1)}%
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <small className="text-muted">
                              {formatDate(item.ultimo_acquisto)}
                            </small>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                  </CTableBody>
                </CTable>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default MaterialiDentaliTab;