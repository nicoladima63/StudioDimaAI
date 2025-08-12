import React, { useState, useCallback } from "react";
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
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import {
  cilReload,
  cilFilter,
  cilCheckCircle,
  cilWarning,
  cilXCircle,
} from "@coreui/icons";
//import SelectSmart from "./SelectSmart";
import materialiClassificazioniService from "../services/materialiClassificazioni.service";
import { confirmListaMateriali } from "@/api/services/materiali.service";
import type { MaterialeClassificazione, FiltriMateriali, MaterialiDaClassificareResponse } from "../services/materialiClassificazioni.service";
// import { useConti, useBranche, useSottoconti } from "../../../store/contiStore"; // Not used in this component
// lettura/salvataggio: si usa il servizio materialiClassificazioniService (DBF + classificazioni)
import SelectConto from "@/components/selects/SelectConto";
import { SelectBranca } from "@/components/selects/SelectBranca";
import { SelectSottoconto } from "@/components/selects/SelectSottoconto";
import AnalyticsFornitori from "./AnalyticsFornitori";

const ContiSottocontiTab: React.FC = () => {
  // Stato per le tabs
  const [activeTab, setActiveTab] = useState("materiali");
  
  const [materiali, setMateriali] = useState<MaterialeClassificazione[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  // rimosso success non utilizzato

  // Cache locale per evitare chiamate server ripetute
  const [materialiCache, setMaterialiCache] = useState<Map<string, {
    data: MaterialeClassificazione[];
    total: number;
    total_pages: number;
    stats: { classificati: number; non_classificati: number; da_verificare: number };
    timestamp: number;
  }>>(new Map());

  // Store per conti, branche e sottoconti
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  // Paginazione e filtri
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filtri, setFiltri] = useState<FiltriMateriali>({
    stato: "tutti",
    limit: 50,
  });
  
  
  // Stato per tenere traccia dei materiali esclusi dall'utente
  const [materialiEsclusi, setMaterialiEsclusi] = useState<Set<string>>(new Set());

  // Stats
  const [stats, setStats] = useState({
    classificati: 0,
    non_classificati: 0,
    da_verificare: 0,
  });

  // Toast notifications
  type ToastItem = { id: number; color: "success" | "danger" | "warning"; title: string; message: string };
  const [toast, setToast] = useState<ToastItem[]>([]);
  const addToast = (item: ToastItem) => setToast((prev) => [...prev, item]);


  // Genera chiave cache per stato filtro
  const getCacheKey = (filtroStato: string) => {
    return `materiali_${filtroStato}`;
  };

  // Carica materiali con cache intelligente
  const caricaMateriali = useCallback(async (page = 1, nuoviFiltri = filtri, forceReload = false) => {
    try {
      setLoading(true);
      setError("");

      // Chiave cache basata solo sullo stato (non su page/limit)
      const cacheKey = getCacheKey(nuoviFiltri.stato || "tutti");
      const cachedData = materialiCache.get(cacheKey);
      const cacheAge = cachedData ? Date.now() - cachedData.timestamp : Infinity;
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

      // Usa cache se disponibile, recente e non è un reload forzato
      if (!forceReload && cachedData && cacheAge < CACHE_DURATION) {
        // Applica paginazione locale sui dati cached
        const startIdx = (page - 1) * (nuoviFiltri.limit || 50);
        const endIdx = startIdx + (nuoviFiltri.limit || 50);
        const paginatedData = cachedData.data.slice(startIdx, endIdx);
        
        setMateriali(paginatedData);
        setCurrentPage(page);
        setTotalPages(Math.ceil(cachedData.data.length / (nuoviFiltri.limit || 50)));
        setTotal(cachedData.data.length);
        setStats(cachedData.stats);
        setLoading(false);
        return;
      }

      // Carica TUTTI i dati dal server (senza paginazione server-side)
      const response: MaterialiDaClassificareResponse =
        await materialiClassificazioniService.apiGetMaterialiDaClassificare({
          stato: nuoviFiltri.stato,
          limit: 10000, // Carica tutto
          page: 1
        });

      if (response.success) {
        // Salva in cache
        setMaterialiCache(prev => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, {
            data: response.data,
            total: response.total,
            total_pages: response.total_pages,
            stats: response.stats,
            timestamp: Date.now()
          });
          return newCache;
        });

        // Applica paginazione locale
        const startIdx = (page - 1) * (nuoviFiltri.limit || 50);
        const endIdx = startIdx + (nuoviFiltri.limit || 50);
        const paginatedData = response.data.slice(startIdx, endIdx);
        
        setMateriali(paginatedData);
        setCurrentPage(page);
        setTotalPages(Math.ceil(response.data.length / (nuoviFiltri.limit || 50)));
        setTotal(response.data.length);
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
  }, [filtri, materialiCache]);



  // Handler per filtri
  const handleFiltroChange = (key: keyof FiltriMateriali, value: string | number) => {
    const nuoviFiltri = { ...filtri, [key]: value };
    setFiltri(nuoviFiltri);
    setCurrentPage(1);
    
    // Solo per cambio di stato ricarica dal server/cache
    if (key === 'stato') {
      caricaMateriali(1, nuoviFiltri, false);
    } else {
      // Per limit, usa la cache esistente con nuova paginazione
      caricaMateriali(1, nuoviFiltri, false);
    }
  };

  // Handler per reset a cascata
  const handleContoChange = (newContoId: number | null) => {
    setContoId(newContoId);
    setBrancaId(null);
    setSottocontoId(null);
  };

  const handleBrancaChange = (newBrancaId: number | null) => {
    setBrancaId(newBrancaId);
    setSottocontoId(null);
  };

  // Handler per escludere un materiale dalla vista
  const handleEscludiMateriale = (materiale: MaterialeClassificazione) => {
    const chiaveMateriale = `${materiale.codicearticolo || ''}-${materiale.nome}-${materiale.fornitoreid}`;
    setMaterialiEsclusi(prev => new Set([...prev, chiaveMateriale]));
  };

  // Handler per ripulire i materiali esclusi quando cambiano i filtri
  const handlePulisciEsclusi = () => {
    setMaterialiEsclusi(new Set());
  };

  // Materiali filtrati con le select in cascata (usa i campi ID corretti del BE)
  const materialiFiltrati = materiali.filter(materiale => {
    // Escludi materiali rimossi dall'utente (aggiornato con campi corretti)
    const chiaveMateriale = `${materiale.codicearticolo || ''}-${materiale.nome}-${materiale.fornitoreid}`;
    if (materialiEsclusi.has(chiaveMateriale)) {
      return false;
    }
    
    // Filtro per conto - confronta ID numerico con ID numerico
    if (contoId && materiale.contoid !== contoId) {
      return false;
    }
    
    // Filtro per branca - confronta ID numerico con ID numerico  
    if (brancaId && materiale.brancaid !== brancaId) {
      return false;
    }
    
    // Filtro per sottoconto - confronta ID numerico con ID numerico
    if (sottocontoId && materiale.sottocontoid !== sottocontoId) {
      return false;
    }
    
    return true;
  });



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
        m.codicearticolo === materialeAggiornato.codicearticolo &&
        m.nome === materialeAggiornato.nome &&
        m.fornitoreid === materialeAggiornato.fornitoreid
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
      message: `${materialeAggiornato.nome} classificato come ${materialeAggiornato.categoria_contabile}`,
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

  // Handler conferma tutti da verificare (solo quelli filtrati e visibili)
  const handleConfermaTuttiDaVerificare = async () => {
    try {
      setLoading(true);
      setError("");

      // Ottieni solo i materiali "da_verificare" che sono attualmente filtrati
      const materialiDaConfermare = materialiFiltrati.filter(m => m.stato_classificazione === 'da_verificare');
      
      if (materialiDaConfermare.length === 0) {
        setError("Nessun materiale da verificare nei filtri correnti");
        return;
      }

      // Mappa i materiali al formato richiesto dall'endpoint (i dati sono già nel formato corretto)
      const materialiFormattati = materialiDaConfermare.map(materiale => {
        return {
          codicearticolo: materiale.codicearticolo || '',
          nome: materiale.nome,
          fornitoreid: materiale.fornitoreid,
          fornitorenome: materiale.fornitorenome || '',
          contoid: materiale.contoid || undefined, // Converti null in undefined
          contonome: materiale.contonome || undefined,
          brancaid: materiale.brancaid || undefined,
          brancanome: materiale.brancanome || undefined,
          sottocontoid: materiale.sottocontoid || undefined,
          sottocontonome: materiale.sottocontonome || undefined,
          confidence: materiale.confidence || 100
        };
      });

      const response = await confirmListaMateriali(materialiFormattati);

      if (response.success) {
        // Ricarica la tabella per aggiornare i dati
        await caricaMateriali(currentPage);

        // Toast di successo
        addToast({
          id: Date.now(),
          color: "success",
          title: "Conferma Completata",
          message: `Confermate ${response.materiali_confermati}/${materialiDaConfermare.length} classificazioni${contoId || brancaId || sottocontoId ? ' filtrate' : ''}`,
        });
        
        if (response.materiali_falliti > 0) {
          addToast({
            id: Date.now() + 1,
            color: "warning",
            title: "Attenzione",
            message: `${response.materiali_falliti} materiali non sono stati confermati`,
          });
        }
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
        <CCardHeader className="pb-0">
          <CNav variant="tabs" className="card-header-tabs">
            <CNavItem>
              <CNavLink
                active={activeTab === "materiali"}
                onClick={() => setActiveTab("materiali")}
                style={{ cursor: "pointer" }}
              >
                📦 Materiali
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === "fornitori"}
                onClick={() => setActiveTab("fornitori")}
                style={{ cursor: "pointer" }}
              >
                📊 Analytics Fornitori
              </CNavLink>
            </CNavItem>
          </CNav>
        </CCardHeader>

        <CTabContent>
          <CTabPane visible={activeTab === "materiali"}>
            <CCard className="border-0">
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
                onClick={() => {
                  // Pulisce cache e ricarica dal server
                  setMaterialiCache(new Map());
                  caricaMateriali(currentPage, filtri, true);
                }}
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
            <CCol md={2}>
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
            <CCol md={2}>
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
            <CCol md={2}>
              <SelectConto 
                value={contoId} 
                onChange={handleContoChange} 
                autoSelectIfSingle 
              />
            </CCol>
            <CCol md={2}>
              <SelectBranca 
                contoId={contoId}
                value={brancaId} 
                onChange={handleBrancaChange}
                autoSelectIfSingle 
              />
            </CCol>
            <CCol md={2}>
              <SelectSottoconto 
                brancaId={brancaId}
                value={sottocontoId} 
                onChange={setSottocontoId}
                autoSelectIfSingle 
              />
            </CCol>
            <CCol md={2} className="d-flex gap-2 align-items-center">
              <CBadge color="info" className="p-2">
                <CIcon icon={cilFilter} className="me-1" />
                {materialiFiltrati.length} / {total} materiali
              </CBadge>
              {(contoId || brancaId || sottocontoId) && (
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContoId(null);
                    setBrancaId(null);
                    setSottocontoId(null);
                  }}
                >
                  Rimuovi Filtri
                </CButton>
              )}
              
              {materialiEsclusi.size > 0 && (
                <CButton
                  color="info"
                  variant="outline"
                  size="sm"
                  onClick={handlePulisciEsclusi}
                >
                  Ripristina {materialiEsclusi.size} Esclusi
                </CButton>
              )}

              {(() => {
                const daVerificareFiltrati = materialiFiltrati.filter(m => m.stato_classificazione === 'da_verificare').length;
                return daVerificareFiltrati > 0 && (
                  <CTooltip
                    content={`Conferma ${daVerificareFiltrati} classificazioni automatiche ${contoId || brancaId || sottocontoId ? 'filtrate' : ''}`}
                  >
                    <CButton
                      color="success"
                      variant="outline"
                      size="sm"
                      onClick={handleConfermaTuttiDaVerificare}
                      disabled={loading}
                    >
                      <CIcon icon={cilCheckCircle} className="me-1" />
                      Conferma {contoId || brancaId || sottocontoId ? 'Filtrati' : 'Tutti'} ({daVerificareFiltrati})
                    </CButton>
                  </CTooltip>
                );
              })()}
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
                  {materialiFiltrati.map((materiale) => (
                    <CTableRow
                      key={`${materiale.codicearticolo}-${materiale.nome}-${materiale.fornitoreid}`}
                    >
                      <CTableDataCell>
                        {getBadgeStato(materiale.stato_classificazione)}
                      </CTableDataCell>

                      <CTableDataCell>
                        <code className="text-muted small">
                          {materiale.codicearticolo || "-"}
                        </code>
                      </CTableDataCell>

                      <CTableDataCell>
                        <div className="fw-medium">
                          {materiale.nome}
                        </div>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>{materiale.fornitorenome}</strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>
                            {materiale.contonome || "-"}
                          </strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>
                            {materiale.brancanome || "-"}
                          </strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <small>
                          <strong>
                            {materiale.sottocontonome || "-"}
                          </strong>
                        </small>
                      </CTableDataCell>

                      <CTableDataCell>
                        <CBadge color="secondary" shape="rounded-pill">
                          {materiale.occorrenze}
                        </CBadge>
                      </CTableDataCell>

                      <CTableDataCell>
                        <div className="d-flex gap-1 align-items-center">
                          {/* passiamo l'id materiale nel callback per aggiornare la tabella materiali */}
                          {/* <SelectSmart
                            materiale={materiale}
                            onClassificazioneAggiornata={(m) =>
                              handleClassificazioneAggiornataForRow(0, m)
                            }
                            onError={handleError}
                          /> */}
                          
                          {/* Tasto X per escludere il materiale */}
                          <CTooltip content="Rimuovi dalla lista">
                            <CButton
                              color="danger"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEscludiMateriale(materiale)}
                            >
                              ✕
                            </CButton>
                          </CTooltip>
                        </div>
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
          </CTabPane>

          <CTabPane visible={activeTab === "fornitori"}>
            <AnalyticsFornitori />
          </CTabPane>
        </CTabContent>
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
