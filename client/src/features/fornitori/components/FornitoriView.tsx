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
  CPagination,
  CPaginationItem,
  CFormInput,
  CFormSelect,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilZoom } from "@coreui/icons";
import { fornitoriService } from "../services/fornitori.service";
import type { Fornitore, ClassificazioneCosto } from "../types";
import FornitoreDetailModal from "./FornitoreDetailModal";
import FattureFornitoreModal from "./FattureFornitoreModal";
import ClassificazioneToggle from "./ClassificazioneToggle";
import ClassificazioneStatus from "./ClassificazioneStatus";
import classificazioniService from "../services/classificazioni.service";

const FornitoriView: React.FC = () => {
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [allFornitori, setAllFornitori] = useState<Fornitore[]>([]);
  const [filteredFornitori, setFilteredFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFattureModal, setShowFattureModal] = useState(false);
  
  // Stato per classificazioni
  const [classificazioni, setClassificazioni] = useState<Map<string, ClassificazioneCosto>>(new Map());
  
  // Stato per categorie di spesa (legacy - non più utilizzato)

  // Ricerca e filtri
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"id" | "nome" | "classificazione" | "status">("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFornitori();
    fetchClassificazioni();
  }, []);

  const fetchClassificazioni = async () => {
    try {
      const response = await classificazioniService.getFornitoriClassificati();
      if (response.success) {
        const classMap = new Map<string, ClassificazioneCosto>();
        response.data.forEach(c => {
          classMap.set(c.codice_riferimento, c);
        });
        setClassificazioni(classMap);
      }
    } catch (error) {
      console.error("Errore nel caricamento classificazioni:", error);
    }
  };

  // Effetto per ricerca e ordinamento
  useEffect(() => {
    applyFiltersAndSort();
  }, [allFornitori, searchTerm, sortField, sortDirection]);

  // Effetto per paginazione quando cambiano i filtri
  useEffect(() => {
    const totalPages = Math.ceil(filteredFornitori.length / itemsPerPage);
    setTotalPages(totalPages);
    setCurrentPage(1); // Reset alla prima pagina quando cambiano i filtri
  }, [filteredFornitori, itemsPerPage]);

  // Effetto per aggiornare i fornitori visualizzati quando cambia la pagina
  useEffect(() => {
    updateCurrentPageData();
  }, [filteredFornitori, currentPage, itemsPerPage]);

  const fetchFornitori = async () => {
    try {
      setLoading(true);
      const response = await fornitoriService.getFornitori();
      const allData = response.data || [];
      setAllFornitori(allData);
      setError(null);
    } catch (err) {
      setError("Errore nel caricamento dei fornitori");
      console.error("Errore:", err);
    } finally {
      setLoading(false);
    }
  };

  // Funzione helper per ottenere il tipo di classificazione
  const getClassificationType = (fornitoreId: string): 'completo' | 'parziale' | 'non_classificato' => {
    const classificazione = classificazioni.get(fornitoreId);
    if (!classificazione) return 'non_classificato';
    
    const hasContoid = classificazione.contoid && classificazione.contoid > 0;
    const hasBrancaid = classificazione.brancaid && classificazione.brancaid > 0;
    const hasSottocontoid = classificazione.sottocontoid && classificazione.sottocontoid > 0;
    
    if (hasContoid && hasBrancaid && hasSottocontoid) {
      return 'completo';
    } else if (hasContoid && (
      (!classificazione.brancaid || classificazione.brancaid === 0) ||
      (hasBrancaid && (!classificazione.sottocontoid || classificazione.sottocontoid === 0))
    )) {
      return 'parziale';
    } else {
      return 'non_classificato';
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allFornitori];

    // Applicare ricerca
    if (searchTerm) {
      filtered = filtered.filter(
        (fornitore) =>
          fornitore.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fornitore.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fornitore.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fornitore.telefono?.includes(searchTerm)
      );
    }

    // Applicare ordinamento
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'classificazione') {
        // Ordinamento per tipo di classificazione (completo > parziale > non_classificato)
        const statusOrder = { 'completo': 3, 'parziale': 2, 'non_classificato': 1 };
        aValue = statusOrder[getClassificationType(a.id)];
        bValue = statusOrder[getClassificationType(b.id)];
      } else if (sortField === 'status') {
        // Ordinamento identico a classificazione (stesso significato)
        const statusOrder = { 'completo': 3, 'parziale': 2, 'non_classificato': 1 };
        aValue = statusOrder[getClassificationType(a.id)];
        bValue = statusOrder[getClassificationType(b.id)];
      } else {
        // Ordinamento normale per id e nome
        aValue = a[sortField as keyof Fornitore] || "";
        bValue = b[sortField as keyof Fornitore] || "";
      }

      if (sortDirection === "asc") {
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }
        return aValue
          .toString()
          .localeCompare(bValue.toString(), "it", { numeric: true });
      } else {
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return bValue - aValue;
        }
        return bValue
          .toString()
          .localeCompare(aValue.toString(), "it", { numeric: true });
      }
    });

    setFilteredFornitori(filtered);
  };

  const updateCurrentPageData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredFornitori.slice(startIndex, endIndex);
    setFornitori(pageData);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSort = (field: "id" | "nome" | "classificazione" | "status") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const renderPagination = () => (
    <CPagination size="sm">
      <CPaginationItem
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
      >
        &laquo;
      </CPaginationItem>
      <CPaginationItem
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        &lsaquo;
      </CPaginationItem>

      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const pageNum =
          Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
        return (
          <CPaginationItem
            key={pageNum}
            active={pageNum === currentPage}
            onClick={() => handlePageChange(pageNum)}
          >
            {pageNum}
          </CPaginationItem>
        );
      })}

      <CPaginationItem
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        &rsaquo;
      </CPaginationItem>
      <CPaginationItem
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        &raquo;
      </CPaginationItem>
    </CPagination>
  );

  const handleShowDetail = async (fornitoreId: string) => {
    try {
      const fornitore = await fornitoriService.getFornitoreById(fornitoreId);
      setSelectedFornitore(fornitore);
      setShowDetailModal(true);
    } catch (err) {
      setError("Errore nel caricamento dei dettagli del fornitore");
      console.error("Errore handleShowDetail:", err);
    }
  };

  const handleShowFatture = async (fornitoreId: string) => {
    try {
      const fornitore = await fornitoriService.getFornitoreById(fornitoreId);
      setSelectedFornitore(fornitore);
      setShowFattureModal(true);
    } catch (err) {
      setError("Errore nel caricamento delle fatture del fornitore");
      console.error("Errore handleShowFatture:", err);
    }
  };

  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center p-5">
          <CSpinner color="primary" />
          <p className="mt-2 mb-0">Caricamento fornitori...</p>
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
          onClick={fetchFornitori}
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
          <CRow className="align-items-center mb-3">
            <CCol>
              <h5 className="mb-0">
                Elenco Fornitori
                <CBadge color="info" className="ms-2">
                  {allFornitori.length}
                </CBadge>
                {filteredFornitori.length !== allFornitori.length && (
                  <CBadge color="warning" className="ms-1">
                    {filteredFornitori.length} filtrati
                  </CBadge>
                )}
              </h5>
            </CCol>
          </CRow>

          {/* Controlli ricerca e filtri */}
          <CRow className="g-3">
            <CCol md={3}>
              <CFormInput
                type="text"
                placeholder="Cerca per nome, ID, email o telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CCol>
            <CCol md={2}>
              <CFormSelect
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
              >
                <option value={10}>10 per pagina</option>
                <option value={20}>20 per pagina</option>
                <option value={50}>50 per pagina</option>
                <option value={100}>100 per pagina</option>
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CButton color="primary" size="sm" onClick={fetchFornitori}>
                Cerca
              </CButton>
            </CCol>
            <CCol md={4} className="d-flex justify-content-end ">
              {/* Navigazione pagine superiore */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-end align-items-center">
                  <small className="text-muted me-3">
                    Pagina {currentPage} di {totalPages} -{" "}
                    {filteredFornitori.length} fornitori
                  </small>
                  {renderPagination()}
                </div>
              )}
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody className="p-0">
          <CTable striped hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("id")}
                >
                  ID{" "}
                  {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                </CTableHeaderCell>
                <CTableHeaderCell
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("nome")}
                >
                  Nome{" "}
                  {sortField === "nome" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </CTableHeaderCell>
                <CTableHeaderCell>Telefono</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell 
                  className="text-center"
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("classificazione")}
                >
                  Classificazione{" "}
                  {sortField === "classificazione" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </CTableHeaderCell>
                <CTableHeaderCell 
                  style={{ width: '550px', cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("status")}
                >
                  Status{" "}
                  {sortField === "status" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </CTableHeaderCell>
                <CTableHeaderCell className="text-center">
                  Azioni
                </CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {fornitori.map((fornitore) => (
                <CTableRow key={fornitore.id} onClick={() => handleShowFatture(fornitore.id)}>
                  <CTableDataCell>{fornitore.id}</CTableDataCell>
                  <CTableDataCell>{fornitore.nome || "-"}</CTableDataCell>
                  <CTableDataCell>{fornitore.telefono || "-"}</CTableDataCell>
                  <CTableDataCell>{fornitore.email || "-"}</CTableDataCell>
                  <CTableDataCell 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="d-flex justify-content-end">
                      <ClassificazioneToggle 
                        fornitoreId={fornitore.id}
                        classificazioneIniziale={classificazioni.get(fornitore.id)}
                        onClassificazioneChange={(nuovaClassificazione) => {
                          const newMap = new Map(classificazioni);
                          if (nuovaClassificazione) {
                            newMap.set(fornitore.id, nuovaClassificazione);
                          } else {
                            newMap.delete(fornitore.id);
                          }
                          setClassificazioni(newMap);
                        }}
                      />
                    </div>
                  </CTableDataCell>
                  <CTableDataCell 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ClassificazioneStatus
                      fornitoreId={fornitore.id}
                      fornitoreNome={fornitore.nome}
                      classificazione={classificazioni.get(fornitore.id) || null}
                      onClassificazioneChange={(contoid, brancaid, sottocontoid) => {
                        // Aggiorna la classificazione locale senza ricaricare tutto
                        const classificazione = classificazioni.get(fornitore.id);
                        const updatedClassificazione = {
                          ...classificazione,
                          contoid,
                          brancaid,
                          sottocontoid,
                          data_modifica: new Date().toISOString()
                        } as ClassificazioneCosto;
                        
                        const newMap = new Map(classificazioni);
                        newMap.set(fornitore.id, updatedClassificazione);
                        setClassificazioni(newMap);
                      }}
                    />
                  </CTableDataCell>
                  <CTableDataCell className="text-center">
                    <CButton
                      color="primary"
                      variant="outline"
                      size="sm"
                      className="me-2"
                      onClick={(e) => {
                        e.stopPropagation(); // <-- parentesi per invocarla
                        handleShowDetail(fornitore.id);
                        }}
                      >
                      <CIcon icon={cilZoom} size="sm" className="me-1" />
                      Dettagli
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {fornitori.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="text-center p-4">
                    Nessun fornitore trovato
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>

        {totalPages > 1 && (
          <CCardBody className="pt-0">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted">
                  Pagina {currentPage} di {totalPages} -{" "}
                  {filteredFornitori.length} fornitori
                </small>
              </div>
              {renderPagination()}
            </div>
          </CCardBody>
        )}
      </CCard>

      {/* Modal Dettagli Fornitore */}
      <FornitoreDetailModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        fornitore={selectedFornitore}
      />

      {/* Modal Fatture Fornitore */}
      <FattureFornitoreModal
        visible={showFattureModal}
        onClose={() => setShowFattureModal(false)}
        fornitore={selectedFornitore}
      />
    </>
  );
};

export default FornitoriView;
