import React, { useState, useEffect } from "react";
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CAlert,
  CSpinner,
  CRow,
  CCol,
  CBadge,
  CProgress,
  CTooltip,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilReload, cilChart, cilInfo } from "@coreui/icons";
import apiClient from '@/api/client';

interface FornitoriAnalytics {
  fornitori_per_tipo: Record<string, number>;
  fornitori_categorizzati: number;
  totale_fornitori_classificati: number;
  top_categorie: Array<{
    categoria_nome: string;
    count: number;
  }>;
}

interface FornitoreNonCategorizzato {
  codice_riferimento: string;
  tipo_di_costo: number;
  data_classificazione: string;
  data_modifica: string;
  nome?: string; // Nome del fornitore recuperato dall'API
}

const AnalyticsFornitori: React.FC = () => {
  const [analytics, setAnalytics] = useState<FornitoriAnalytics | null>(null);
  const [fornitoriNonCategorizzati, setFornitoriNonCategorizzati] = useState<FornitoreNonCategorizzato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [fornitori, setFornitori] = useState<Record<string, string>>({});

  useEffect(() => {
    caricaAnalytics();
  }, []);

  const caricaAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      // Carica analytics, fornitori non categorizzati e lista fornitori in parallelo
      const [analyticsResponse, nonCatResponse, fornitoriResponse] = await Promise.all([
        apiClient.get('/api/classificazioni/fornitori/analytics'),
        apiClient.get('/api/classificazioni/fornitori/non-categorizzati'),
        apiClient.get('/api/fornitori')
      ]);

      if (analyticsResponse.data.success) {
        setAnalytics(analyticsResponse.data.data);
      }

      // Crea mappa dei fornitori per lookup rapido
      if (fornitoriResponse.data.success) {
        const fornitoriMap: Record<string, string> = {};
        fornitoriResponse.data.data.forEach((fornitore: any) => {
          fornitoriMap[fornitore.id] = fornitore.nome || fornitore.ragione_sociale || fornitore.id;
        });
        setFornitori(fornitoriMap);
      }

      if (nonCatResponse.data.success) {
        setFornitoriNonCategorizzati(nonCatResponse.data.data);
      }
    } catch (err) {
      setError("Errore nel caricamento delle analytics");
      console.error("Errore caricamento analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo: number) => {
    switch (tipo) {
      case 1: return { label: 'Diretto', color: 'danger' };
      case 2: return { label: 'Indiretto', color: 'primary' };
      case 3: return { label: 'Non Deducibile', color: 'dark' };
      default: return { label: 'Sconosciuto', color: 'secondary' };
    }
  };

  const getPercentualeCategorizzazione = () => {
    if (!analytics || analytics.totale_fornitori_classificati === 0) return 0;
    return Math.round((analytics.fornitori_categorizzati / analytics.totale_fornitori_classificati) * 100);
  };

  // Helper per ottenere il nome del fornitore
  const getNomeFornitore = (codice: string): string => {
    return fornitori[codice] || codice;
  };

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center p-5">
          <CSpinner color="primary" />
          <p className="mt-2 mb-0">Caricamento analytics fornitori...</p>
        </CCardBody>
      </CCard>
    );
  }

  if (error) {
    return (
      <CAlert color="danger" dismissible>
        {error}
        <CButton
          color="danger"
          variant="outline"
          size="sm"
          className="ms-2"
          onClick={caricaAnalytics}
        >
          Riprova
        </CButton>
      </CAlert>
    );
  }

  return (
    <>
      <CCard>
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol md={8}>
              <h5 className="mb-0">📊 Analytics Fornitori</h5>
              <small className="text-muted">
                Statistiche e metriche di categorizzazione fornitori
              </small>
            </CCol>
            <CCol md={4} className="text-end">
              <CButton
                color="primary"
                variant="outline"
                onClick={caricaAnalytics}
                disabled={loading}
              >
                <CIcon icon={cilReload} className={loading ? "fa-spin" : ""} />
                Aggiorna
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>

        <CCardBody>
          {analytics && (
            <>
              {/* Overview Statistics */}
              <CRow className="mb-4">
                <CCol md={3}>
                  <div className="border-start border-start-4 border-start-info ps-3">
                    <div className="text-body-secondary">Fornitori Classificati</div>
                    <div className="fs-5 fw-semibold text-info">
                      {analytics.totale_fornitori_classificati}
                    </div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-start-4 border-start-success ps-3">
                    <div className="text-body-secondary">Con Categoria</div>
                    <div className="fs-5 fw-semibold text-success">
                      {analytics.fornitori_categorizzati}
                    </div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-start-4 border-start-warning ps-3">
                    <div className="text-body-secondary">Senza Categoria</div>
                    <div className="fs-5 fw-semibold text-warning">
                      {fornitoriNonCategorizzati.length}
                    </div>
                  </div>
                </CCol>
                <CCol md={3}>
                  <div className="border-start border-start-4 border-start-primary ps-3">
                    <div className="text-body-secondary">% Categorizzazione</div>
                    <div className="fs-5 fw-semibold text-primary">
                      {getPercentualeCategorizzazione()}%
                    </div>
                  </div>
                </CCol>
              </CRow>

              {/* Progress Bar */}
              <CRow className="mb-4">
                <CCol>
                  <h6>Progresso Categorizzazione</h6>
                  <CProgress
                    className="mb-2"
                    value={getPercentualeCategorizzazione()}
                    color="success"
                  />
                  <small className="text-muted">
                    {analytics.fornitori_categorizzati} di {analytics.totale_fornitori_classificati} fornitori hanno una categoria assegnata
                  </small>
                </CCol>
              </CRow>

              {/* Distribuzioni per Tipo */}
              <CRow className="mb-4">
                <CCol md={6}>
                  <h6>Fornitori per Tipo di Costo</h6>
                  <div className="d-flex flex-column gap-2">
                    {Object.entries(analytics.fornitori_per_tipo).map(([tipo, count]) => (
                      <div key={tipo} className="d-flex justify-content-between align-items-center">
                        <span>{tipo}</span>
                        <CBadge color="secondary" className="px-2 py-1">
                          {count}
                        </CBadge>
                      </div>
                    ))}
                  </div>
                </CCol>
                <CCol md={6}>
                  <h6>Top Categorie Utilizzate</h6>
                  <div className="d-flex flex-column gap-2">
                    {analytics.top_categorie.length === 0 ? (
                      <small className="text-muted">Nessuna categoria assegnata ancora. Le statistiche si popoleranno man mano che classifichi i fornitori.</small>
                    ) : (
                      analytics.top_categorie.slice(0, 5).map((cat) => (
                        <div key={cat.categoria_nome} className="d-flex justify-content-between align-items-center">
                          <span>{cat.categoria_nome}</span>
                          <CBadge color="primary" className="px-2 py-1">
                            {cat.count}
                          </CBadge>
                        </div>
                      ))
                    )}
                  </div>
                </CCol>
              </CRow>
            </>
          )}

          {/* Fornitori Non Categorizzati */}
          <CRow>
            <CCol>
              <h6 className="d-flex align-items-center gap-2">
                <CIcon icon={cilInfo} />
                Fornitori da Categorizzare
                <CBadge color="warning">{fornitoriNonCategorizzati.length}</CBadge>
              </h6>
              
              {fornitoriNonCategorizzati.length === 0 ? (
                <CAlert color="success">
                  🎉 Ottimo lavoro! Tutti i fornitori classificati hanno una categoria assegnata.
                </CAlert>
              ) : (
                <CTable striped hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Fornitore</CTableHeaderCell>
                      <CTableHeaderCell>Tipo Costo</CTableHeaderCell>
                      <CTableHeaderCell>Data Classificazione</CTableHeaderCell>
                      <CTableHeaderCell>Azioni</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {fornitoriNonCategorizzati.slice(0, 10).map((fornitore) => {
                      const tipoInfo = getTipoLabel(fornitore.tipo_di_costo);
                      return (
                        <CTableRow key={fornitore.codice_riferimento}>
                          <CTableDataCell>
                            <div>
                              <strong>{getNomeFornitore(fornitore.codice_riferimento)}</strong>
                              <br />
                              <small className="text-muted"><code>{fornitore.codice_riferimento}</code></small>
                            </div>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={tipoInfo.color}>
                              {tipoInfo.label}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <small className="text-muted">
                              {new Date(fornitore.data_classificazione).toLocaleDateString('it-IT')}
                            </small>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CTooltip content="Vai alla pagina fornitori per categorizzare">
                              <CButton
                                color="primary"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Navigate to fornitori page
                                  window.location.href = '/fornitori';
                                }}
                              >
                                <CIcon icon={cilChart} size="sm" />
                                Categorizza
                              </CButton>
                            </CTooltip>
                          </CTableDataCell>
                        </CTableRow>
                      );
                    })}
                  </CTableBody>
                </CTable>
              )}
              
              {fornitoriNonCategorizzati.length > 10 && (
                <div className="text-center mt-3">
                  <small className="text-muted">
                    Mostrati i primi 10 di {fornitoriNonCategorizzati.length} fornitori non categorizzati
                  </small>
                </div>
              )}
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    </>
  );
};

export default AnalyticsFornitori;