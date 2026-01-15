import React, { useState, useEffect } from "react";
import {
  CCol,
  CAlert,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CRow,
  CCard,
  CCardHeader,
  CCardBody,
  CPagination,
  CPaginationItem,
  CButton,
} from "@coreui/react";
import SpeseFilters from "../components/SpeseFilters";
import SpeseStats from "../components/SpeseStats";
import SpeseTable from "../components/SpeseTable";
import SpeseAggregatedTable from "../components/SpeseAggregatedTable";
import RiepilogoSpeseTab from "../components/RiepilogoSpeseTab";
import { speseFornitioriService } from "../services/spese.service";
import type {
  FiltriSpese,
  SpesaFornitore,
} from "../types";

const SpesePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("fatture");
  const [filtri, setFiltri] = useState<FiltriSpese>({
    anno: new Date().getFullYear(),
    limit: 50,
    page: 1,
  });

  // State for Data
  const [aggregatedData, setAggregatedData] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<SpesaFornitore[]>([]);

  // State for Navigation/Drill-down
  const [selectedSupplier, setSelectedSupplier] = useState<{ ids: string, name: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // Load Aggregated Data (Main View)
  const loadAggregatedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await speseFornitioriService.getRiepilogoSpese(filtri);
      if (response.success) {
        setAggregatedData(response.data);
      } else {
        setError("Errore nel caricamento del riepilogo fornitori");
      }
    } catch (err: any) {
      console.error("Errore caricamento riepilogo:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  // Load Invoices Data (Drill-down View)
  const loadInvoices = async () => {
    if (!selectedSupplier) return;

    setLoading(true);
    setError(null);
    try {
      // Merge current filters with selected supplier
      const invoiceFilters: FiltriSpese = {
        ...filtri,
        codice_fornitore: selectedSupplier.ids, // Pass comma-separated IDs
        page: filtri.page,
        limit: filtri.limit || 50
      };

      const response = await speseFornitioriService.getSpeseFornitori(invoiceFilters);

      if (response.success) {
        setInvoicesData(response.data);
        setTotalInvoices(response.total);
      }
    } catch (err: any) {
      console.error("Errore caricamento fatture:", err);
      setError(err.message || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  // Effect: Reload Aggregated Data when filters change (and we are NOT in drill-down)
  useEffect(() => {
    setSelectedSupplier(null); // Reset drill-down on filter change
    loadAggregatedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtri.anno, filtri.conto_id, filtri.branca_id, filtri.sottoconto_id]); // Only major filters reset view

  // Effect: Load invoices when supplier is selected or page changes
  useEffect(() => {
    if (selectedSupplier) {
      loadInvoices();
    }
  }, [selectedSupplier, filtri.page, filtri.limit]);

  const handleFiltriChange = (nuoviFiltri: FiltriSpese) => {
    setFiltri(nuoviFiltri);
  };

  const handleSelectSupplier = (ids: string, name: string) => {
    setSelectedSupplier({ ids, name });
    setFiltri(prev => ({ ...prev, page: 1 })); // Reset to page 1 for details
  };

  const handleBackToAggregated = () => {
    setSelectedSupplier(null);
    setFiltri(prev => ({ ...prev, page: 1 }));
  };

  return (
    <CCard>
      <CCardHeader>
        <h5>Spese Fornitori {selectedSupplier ? `- Dettaglio: ${selectedSupplier.name}` : '- Riepilogo per Fornitore'}</h5>
      </CCardHeader>
      <CCardBody>
        {/* Navigation Tabs */}
        <CNav variant="tabs" className="mb-4">
          <CNavItem>
            <CNavLink
              active={activeTab === "fatture"}
              onClick={() => setActiveTab("fatture")}
              style={{ cursor: "pointer" }}
            >
              📋 {selectedSupplier ? 'Dettaglio Fornitore' : 'Riepilogo Fornitori'}
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink
              active={activeTab === "statistiche"}
              onClick={() => setActiveTab("statistiche")}
              style={{ cursor: "pointer" }}
            >
              📊 Analisi Avanzata
            </CNavLink>
          </CNavItem>
        </CNav>

        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <CTabContent>
          <CTabPane visible={activeTab === "fatture"} role="tabpanel">

            {/* Filters always visible */}
            <CRow className="mt-4">
              <CCol md={12}>
                <SpeseFilters
                  filtri={filtri}
                  onFiltriChange={handleFiltriChange}
                  loading={loading}
                />
              </CCol>
            </CRow>

            <SpeseStats filtri={filtri} />

            <CRow className="mt-3">
              <CCol md={12}>
                {selectedSupplier ? (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5>Fatture: {selectedSupplier.name}</h5>
                      <CButton color="secondary" onClick={handleBackToAggregated}>
                        ← Torna al Riepilogo
                      </CButton>
                    </div>
                    <SpeseTable spese={invoicesData} loading={loading} />

                    {/* Pagination for Invoices */}
                    {totalInvoices > 0 && (
                      <CRow className="mt-3">
                        <CCol className="d-flex justify-content-center">
                          <CPagination>
                            <CPaginationItem
                              disabled={filtri.page === 1 || loading}
                              onClick={() => handleFiltriChange({ ...filtri, page: (filtri.page || 1) - 1 })}
                              style={{ cursor: 'pointer' }}
                            >
                              Precedente
                            </CPaginationItem>
                            <CPaginationItem active>
                              Pagina {filtri.page || 1}
                            </CPaginationItem>
                            <CPaginationItem
                              disabled={invoicesData.length < (filtri.limit || 50) || loading}
                              onClick={() => handleFiltriChange({ ...filtri, page: (filtri.page || 1) + 1 })}
                              style={{ cursor: 'pointer' }}
                            >
                              Successiva
                            </CPaginationItem>
                          </CPagination>
                        </CCol>
                      </CRow>
                    )}
                  </>
                ) : (
                  <SpeseAggregatedTable
                    data={aggregatedData}
                    loading={loading}
                    onSelectSupplier={handleSelectSupplier}
                  />
                )}
              </CCol>
            </CRow>

          </CTabPane>

          <CTabPane visible={activeTab === "statistiche"} role="tabpanel">
            <RiepilogoSpeseTab />
          </CTabPane>

        </CTabContent>
      </CCardBody>
    </CCard>
  );
};

export default SpesePage;
