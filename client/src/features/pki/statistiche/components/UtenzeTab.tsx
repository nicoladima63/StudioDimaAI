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
  CButton,
  CProgress
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilLightbulb, cilChart, cilTruck, cilPhone, cilGlobeAlt } from '@coreui/icons';
import statisticheService, { type UtenzaStats } from '../services/statistiche.service';

const UtenzeTab: React.FC = () => {
  const [stats, setStats] = useState<UtenzaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('anno_corrente');

  useEffect(() => {
    fetchUtenzeStats();
  }, [periodo]);

  const fetchUtenzeStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await statisticheService.apiGetUtenze(periodo);
      
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Errore nel caricamento statistiche');
      }
    } catch (err) {
      console.error('Errore fetch statistiche utenze:', err);
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

  const getUtenzaIcon = (tipo: string) => {
    const tipoLower = tipo?.toLowerCase();
    if (tipoLower.includes('energia') || tipoLower.includes('elettrica') || tipoLower.includes('luce')) {
      return cilLightbulb;
    } else if (tipoLower.includes('gas') || tipoLower.includes('riscaldamento')) {
      return cilTruck;
    } else if (tipoLower.includes('telefono') || tipoLower.includes('mobile')) {
      return cilPhone;
    } else if (tipoLower.includes('internet') || tipoLower.includes('fibra') || tipoLower.includes('adsl')) {
      return cilGlobeAlt;
    }
    return cilChart;
  };

  const getUtenzaColor = (tipo: string) => {
    const tipoLower = tipo?.toLowerCase();
    if (tipoLower.includes('energia') || tipoLower.includes('elettrica')) {
      return 'warning';
    } else if (tipoLower.includes('gas')) {
      return 'danger';
    } else if (tipoLower.includes('telefono')) {
      return 'info';
    } else if (tipoLower.includes('internet')) {
      return 'primary';
    }
    return 'secondary';
  };

  const totaleGenerale = stats.reduce((sum, item) => sum + item.spesa_totale, 0);

  return (
    <CRow>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">
                <CIcon icon={cilLightbulb} className="me-2" />
                Utenze e Servizi
              </h5>
              <small className="text-muted">
                Analisi costi utenze e servizi ricorrenti
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
                onClick={fetchUtenzeStats}
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
                <div className="mt-2">Caricamento statistiche utenze...</div>
              </div>
            )}
            
            {error && (
              <CAlert color="danger">
                <strong>Errore:</strong> {error}
              </CAlert>
            )}
            
            {!loading && !error && stats.length === 0 && (
              <CAlert color="info">
                <CIcon icon={cilLightbulb} className="me-2" />
                Nessuna spesa per utenze trovata nel periodo selezionato.
              </CAlert>
            )}
            
            {!loading && !error && stats.length > 0 && (
              <>
                {/* Riepilogo generale */}
                <CRow className="mb-4">
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-primary">{formatCurrency(totaleGenerale)}</h4>
                      <small className="text-muted">Totale Utenze</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-info">{stats.length}</h4>
                      <small className="text-muted">Utenze Attive</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-success">
                        {formatCurrency(totaleGenerale / 12)}
                      </h4>
                      <small className="text-muted">Costo Mensile Medio</small>
                    </div>
                  </CCol>
                  <CCol sm={6} md={3}>
                    <div className="text-center p-3 bg-light rounded">
                      <h4 className="mb-1 text-warning">
                        {stats.reduce((sum, item) => sum + item.numero_fatture, 0)}
                      </h4>
                      <small className="text-muted">Bollette Totali</small>
                    </div>
                  </CCol>
                </CRow>

                {/* Tabella dettagliata */}
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Tipo Utenza</CTableHeaderCell>
                      <CTableHeaderCell>Fornitore</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Spesa Totale</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Spesa Mensile Media</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Consumo Medio</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Variazione</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">% sul Totale</CTableHeaderCell>
                      <CTableHeaderCell>Ultimo Pagamento</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {stats
                      .sort((a, b) => b.spesa_totale - a.spesa_totale)
                      .map((item, index) => (
                        <CTableRow key={`${item.tipo_utenza}-${item.fornitore}-${index}`}>
                          <CTableDataCell>
                            <div className="d-flex align-items-center">
                              <CIcon 
                                icon={getUtenzaIcon(item.tipo_utenza)} 
                                className="me-2"
                                style={{ color: `var(--cui-${getUtenzaColor(item.tipo_utenza)})` }}
                              />
                              <CBadge color={getUtenzaColor(item.tipo_utenza)}>
                                {item.tipo_utenza}
                              </CBadge>
                            </div>
                          </CTableDataCell>
                          <CTableDataCell>
                            <strong>{item.fornitore}</strong>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <strong className="text-primary">
                              {formatCurrency(item.spesa_totale)}
                            </strong>
                            <div className="mt-1">
                              <CProgress
                                height={4}
                                value={(item.spesa_totale / totaleGenerale) * 100}
                                color={getUtenzaColor(item.tipo_utenza)}
                              />
                            </div>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            {formatCurrency(item.spesa_media_mensile)}
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            {item.consumo_medio > 0 && (
                              <span>
                                {item.consumo_medio.toFixed(1)} <small>{item.unita_misura}</small>
                              </span>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <CBadge 
                              color={item.variazione_percentuale > 10 ? 'danger' : 
                                    item.variazione_percentuale < -10 ? 'success' : 'secondary'}
                            >
                              {item.variazione_percentuale > 0 ? '+' : ''}
                              {item.variazione_percentuale.toFixed(1)}%
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <CBadge color="outline">
                              {item.percentuale_sul_totale.toFixed(1)}%
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <small className="text-muted">
                              {formatDate(item.ultimo_pagamento)}
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

export default UtenzeTab;