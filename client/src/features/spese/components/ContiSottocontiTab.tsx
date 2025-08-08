import React, { useState, useEffect, useCallback } from "react";
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
  CPagination,
  CPaginationItem,
  CRow,
  CCol,
  CFormSelect,
  CInputGroup,
  CButton,
  CBadge,
  CSpinner,
  CAlert,
  CProgress,
  CToast,
  CToastBody,
  CToastClose,
  CToaster,
  CTooltip,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import {
  cilReload,
  cilFilter,
  cilCheckCircle,
  cilWarning,
  cilXCircle,
} from "@coreui/icons";
import SelectSmart from "./SelectSmart";
import materialiClassificazioniService from "../services/materialiClassificazioni.service";
import { confirmTuttiDaVerificare } from "@/api/services/materiali.service";
import type { MaterialeClassificazione, FiltriMateriali, MaterialiDaClassificareResponse } from "../services/materialiClassificazioni.service";
import { useContiStore } from "../../../store/contiStore";
import { useBrancheStore } from "../../../store/brancheStore";
// lettura/salvataggio: si usa il servizio materialiClassificazioniService (DBF + classificazioni)

const ContiSottocontiTab: React.FC = () => {
  const [materiali, setMateriali] = useState<MaterialeClassificazione[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  // rimosso success non utilizzato

  // Store per conti e sottoconti
  const { conti, checkAndUpdateCache } = useContiStore();
  
  // Store per branche
  const { brancheByParent, checkAndUpdateCache: checkBrancheCache } = useBrancheStore();

  // Paginazione e filtri
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filtri, setFiltri] = useState<FiltriMateriali>({
    stato: "tutti",
    limit: 50,
  });

  // Stats
  const [stats, setStats] = useState({
    classificati: 0,
    non_classificati: 0,
    da_verificare: 0,
  });

  // Toast notifications
  type ToastItem = { id: number; color: "success" | "danger"; title: string; message: string };
  const [toast, setToast] = useState<ToastItem[]>([]);
  const addToast = (item: ToastItem) => setToast((prev) => [...prev, item]);

  // Funzioni helper per lookup nomi
  const getContoNome = (codice: string | null | undefined): string => {
    if (!codice) return "-";
    const conto = conti.find((c) => c.codice_conto === codice);
    return conto ? `${codice} - ${conto.descrizione}` : codice;
  };

  // (rimosso helper sottoconto non usato)

  const getBrancaNome = (codice: string | null | undefined, contoId?: number): string => {
    if (!codice) return "-";
    
    // Se abbiamo il contoId, cerca nelle branche di quel conto
    if (contoId) {
      const branche = brancheByParent[contoId] || [];
      const branca = branche.find((b) => b.id.toString() === codice);
      return branca ? `${codice} - ${branca.nome}` : codice;
    }
    
    // Altrimenti cerca in tutte le branche
    for (const [, branche] of Object.entries(brancheByParent)) {
      const branca = branche.find((b) => b.id.toString() === codice);
      if (branca) {
        return `${codice} - ${branca.nome}`;
      }
    }
    
    return codice;
  };

  // Carica materiali (DBF derivati) con suggerimenti
  const caricaMateriali = useCallback(async (page = 1, nuoviFiltri = filtri) => {
    try {
      setLoading(true);
      setError("");
      const response: MaterialiDaClassificareResponse =
        await materialiClassificazioniService.apiGetMaterialiDaClassificare({
          ...nuoviFiltri,
          page,
        });

      if (response.success) {
        setMateriali(response.data);
        setCurrentPage(response.page);
        setTotalPages(response.total_pages);
        setTotal(response.total);
        setStats(response.stats);
      } else {
        setError("Errore nel caricamento dei materiali");
      }
    } catch (err) {
      setError("Errore di connessione al server");
      console.error("Errore caricamento materiali:", err);
    } finally {
      setLoading(false);
    }
  }, [filtri]);

  // Carica materiali al mount
  useEffect(() => {
    caricaMateriali();
  }, [caricaMateriali]);

  // Carica conti, sottoconti e branche al mount
  useEffect(() => {
    checkAndUpdateCache();
    checkBrancheCache();
  }, [checkAndUpdateCache, checkBrancheCache]);

  // Handler per filtri
  const handleFiltroChange = (key: keyof FiltriMateriali, value: string | number) => {
    const nuoviFiltri = { ...filtri, [key]: value };
    setFiltri(nuoviFiltri);
    setCurrentPage(1);
    caricaMateriali(1, nuoviFiltri);
  };

  // Handler per paginazione
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    caricaMateriali(page);
  };

  // Handler per classificazione aggiornata
  const handleClassificazioneAggiornataForRow = async (
    _materialeId: number,
    materialeAggiornato: MaterialeClassificazione
  ) => {
    // Aggiorna il materiale nella lista
    setMateriali((prev) =>
      prev.map((m) =>
        m.codice_articolo === materialeAggiornato.codice_articolo &&
        m.descrizione === materialeAggiornato.descrizione &&
        m.codice_fornitore === materialeAggiornato.codice_fornitore
          ? ({ ...m, ...materialeAggiornato } as MaterialeClassificazione)
          : m
      )
    );

    // Aggiorna stats
    setStats((prev) => ({
      classificati: prev.classificati + 1,
      non_classificati: Math.max(0, prev.non_classificati - 1),
      da_verificare: prev.da_verificare,
    }));

    // Toast di successo
    addToast({
      id: Date.now(),
      color: "success",
      title: "Classificazione Salvata",
      message: `${materialeAggiornato.descrizione} classificato come ${materialeAggiornato.categoria_contabile}`,
    });

    // Il salvataggio effettivo è demandato al servizio chiamato da SelectSmart
  };

  // Handler per errori
  const handleError = (errorMessage: string) => {
    addToast({
      id: Date.now(),
      color: "danger",
      title: "Errore",
      message: errorMessage,
    });
  };

  // Handler conferma tutti da verificare
  const handleConfermaTuttiDaVerificare = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await confirmTuttiDaVerificare();

      if (response.success) {
        // Ricarica la tabella per aggiornare i dati
        await caricaMateriali(currentPage);

        // Toast di successo
        addToast({
          id: Date.now(),
          color: "success",
          title: "Conferma Completata",
          message: `Confermate ${response.materiali_confermati} classificazioni automatiche`,
        });
      } else {
        setError("Errore nella conferma delle classificazioni");
      }
    } catch (error) {
      setError("Errore di connessione al server");
      console.error("Errore conferma tutti da verificare:", error);
    } finally {
      setLoading(false);
    }
  };

  // Badge per stato
  const getBadgeStato = (stato: string) => {
    switch (stato) {
      case "classificato":
        return (
          <CBadge color="success">
            <CIcon icon={cilCheckCircle} size="sm" /> Classificato
          </CBadge>
        );
      case "da_verificare":
        return (
          <CBadge color="warning">
            <CIcon icon={cilWarning} size="sm" /> Da Verificare
          </CBadge>
        );
      case "non_classificato":
        return (
          <CBadge color="danger">
            <CIcon icon={cilXCircle} size="sm" /> Non Classificato
          </CBadge>
        );
      default:
        return <CBadge color="secondary">-</CBadge>;
    }
  };

  // Progress bar generale
  const getProgressPercentage = () => {
    const totale =
      stats.classificati + stats.non_classificati + stats.da_verificare;
    return totale > 0 ? Math.round((stats.classificati / totale) * 100) : 0;
  };

  return (
    <>
      <CCard>
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol md={8}>
              <h5 className="mb-0">🎯 Gestione Classificazioni Materiali</h5>
              <small className="text-muted">
                Classifica i materiali per conto e sottoconto contabile
              </small>
            </CCol>
            <CCol md={4} className="text-end">
              <CButton
                color="primary"
                variant="outline"
                onClick={() => caricaMateriali(currentPage)}
                disabled={loading}
              >
                <CIcon icon={cilReload} className={loading ? "fa-spin" : ""} />
                Ricarica
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>

        <CCardBody>
          {/* Progress & Stats */}
          <CRow className="mb-4">
            <CCol md={8}>
              <CProgress
                className="mb-2"
                value={getProgressPercentage()}
                color="success"
              />
              <small>
                Progresso Classificazione: {stats.classificati} su {total}{" "}
                materiali ({getProgressPercentage()}%)
              </small>
            </CCol>
            <CCol md={4}>
              <div className="d-flex gap-2 justify-content-end">
                <CBadge color="success" className="px-2 py-1">
                  ✅ {stats.classificati}
                </CBadge>
                <CBadge color="warning" className="px-2 py-1">
                  ⚠️ {stats.da_verificare}
                </CBadge>
                <CBadge color="danger" className="px-2 py-1">
                  ❌ {stats.non_classificati}
                </CBadge>
              </div>
            </CCol>
          </CRow>

          {/* Filtri */}
          <CRow className="mb-3">
            <CCol md={3}>
              <CInputGroup>
                <CFormSelect
                  value={filtri.stato}
                  onChange={(e) => handleFiltroChange("stato", e.target.value)}
                >
                  <option value="tutti">🔍 Tutti i Materiali</option>
                  <option value="non_classificati">❌ Non Classificati</option>
                  <option value="da_verificare">⚠️ Da Verificare</option>
                  <option value="classificati">✅ Classificati</option>
                </CFormSelect>
              </CInputGroup>
            </CCol>
            <CCol md={3}>
              <CFormSelect
                value={filtri.limit}
                onChange={(e) =>
                  handleFiltroChange("limit", parseInt(e.target.value))
                }
              >
                <option value={25}>25 per pagina</option>
                <option value={50}>50 per pagina</option>
                <option value={100}>100 per pagina</option>
              </CFormSelect>
            </CCol>
            <CCol md={6} className="d-flex gap-2 align-items-center">
              <CBadge color="info" className="p-2">
                <CIcon icon={cilFilter} className="me-1" />
                {total} materiali trovati
              </CBadge>

              {stats.da_verificare > 0 && (
                <CTooltip
                  content={`Conferma tutte le ${stats.da_verificare} classificazioni automatiche`}
                >
                  <CButton
                    color="success"
                    variant="outline"
                    size="sm"
                    onClick={handleConfermaTuttiDaVerificare}
                    disabled={loading}
                  >
                    <CIcon icon={cilCheckCircle} className="me-1" />
                    Conferma Tutti ({stats.da_verificare})
                  </CButton>
                </CTooltip>
              )}
            </CCol>
          </CRow>

          {/* Error Alert */}
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError("")}>
              {error}
            </CAlert>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center p-4">
              <CSpinner color="primary" />
              <p className="mt-2">Caricamento materiali...</p>
            </div>
          )}

          {/* Tabella Materiali */}
          {!loading && (
            <>
              <CTable striped hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: "100px" }}>
                      Stato
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "120px" }}>
                      Codice Prodotto
                    </CTableHeaderCell>
                    <CTableHeaderCell>Descrizione</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "350px" }}>
                      Fornitore
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "200px" }}>
                      Conto
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "180px" }}>
                      Branca
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "140px" }}>
                      Sottoconto
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "60px" }}>
                      Occ.
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: "300px" }}>
                      Azioni
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {materiali.map((materiale) => (
                    <CTableRow
                      key={`${materiale.codice_articolo}-${materiale.descrizione}-${materiale.codice_fornitore}`}
                    >
                      <CTableDataCell>
                        {getBadgeStato(materiale.stato_classificazione)}
                      </CTableDataCell>

                      <CTableDataCell>
                        <code className="text-muted small">
                          {materiale.codice_articolo || "-"}
                        </code>
                      </CTableDataCell>

                      <CTableDataCell>
                        <div className="fw-medium">
                          {materiale.descrizione.length > 50
                            ? `${materiale.descrizione.substring(0, 50)}...`
                            : materiale.descrizione}
                        </div>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>{materiale.nome_fornitore}</strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>
                            {materiale.conto_codice
                              ? (() => {
                                  const nomeCompleto = getContoNome(materiale.conto_codice);
                                  const parti = nomeCompleto.split(" - ");
                                  return parti.length > 1 ? parti[1] : nomeCompleto;
                                })()
                              : "-"}
                          </strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        {materiale.branca_codice ? (
                          <small>
                            <strong>
                              {getBrancaNome(materiale.branca_codice).split(" - ")[1] ||
                                materiale.branca_codice}
                            </strong>
                          </small>
                        ) : (
                          <small><strong>ND</strong></small>
                        )}
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>
                            {materiale.sottoconto_codice || "-"}
                          </strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <CBadge color="secondary" shape="rounded-pill">
                          {materiale.occorrenze}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        {/* passiamo l'id materiale nel callback per aggiornare la tabella materiali */}
                        <SelectSmart
                          materiale={materiale}
                          onClassificazioneAggiornata={(m) =>
                            handleClassificazioneAggiornataForRow(0, m)
                          }
                          onError={handleError}
                        />
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              {/* Paginazione */}
              {totalPages > 1 && (
                <CPagination className="justify-content-center">
                  <CPaginationItem
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Precedente
                  </CPaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page =
                      Math.max(1, Math.min(totalPages - 4, currentPage - 2)) +
                      i;
                    return (
                      <CPaginationItem
                        key={page}
                        active={page === currentPage}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </CPaginationItem>
                    );
                  })}

                  <CPaginationItem
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Successiva
                  </CPaginationItem>
                </CPagination>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      {/* Toast Container */}
      <CToaster className="p-3" placement="top-end">
        {toast.map((toast: ToastItem) => (
          <CToast
            key={toast.id}
            color={toast.color}
            className="text-white align-items-center"
            autohide
          >
            <div className="d-flex">
              <CToastBody className="mx-auto">
                <strong>{toast.title}</strong>
                <br />
                {toast.message}
              </CToastBody>
              <CToastClose className="me-2 m-auto" white />
            </div>
          </CToast>
        ))}
      </CToaster>
    </>
  );
};

export default ContiSottocontiTab;
