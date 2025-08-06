import React, { useState } from "react";
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
  CBadge,
  CSpinner,
  CButton,
  CPagination,
  CPaginationItem,
  CFormSelect,
  CTooltip,
} from "@coreui/react";
import { CIcon } from '@coreui/icons-react';
import { cilInfo } from '@coreui/icons';
import type { SpesaFornitore, DettaglioSpesaFornitore, FiltriSpese } from "../types";
import DettagliFattura from "./DettagliFattura";
import { useAutoCategorization } from "../hooks/useAutoCategorization";

interface TabellaSpeseProps {
  spese: SpesaFornitore[];
  loading?: boolean;
  total?: number;
  totalBeforeLimit?: number;
  filtri?: FiltriSpese;
  onCaricaMagazzino?: (dettaglio: DettaglioSpesaFornitore) => void;
  onFiltriChange?: (filtri: FiltriSpese) => void;
}

const TabellaSpese: React.FC<TabellaSpeseProps> = ({
  spese,
  loading = false,
  total = 0,
  totalBeforeLimit = 0,
  filtri,
  onCaricaMagazzino,
  onFiltriChange,
}) => {
  const [espansioni, setEspansioni] = useState<Set<string>>(new Set());
  const { categorizzaSpesa, getCategoriaLabel: getCategoriaLabelAuto, getCategoriaColor: getCategoriaColorAuto, getConfidenceLevel } = useAutoCategorization();

  const handlePageChange = (page: number) => {
    if (onFiltriChange && filtri) {
      onFiltriChange({ ...filtri, page });
    }
  };

  const handleLimitChange = (newLimit: number) => {
    if (onFiltriChange && filtri) {
      onFiltriChange({ ...filtri, limit: newLimit, page: 1 });
    }
  };

  const totalPages = filtri?.limit ? Math.ceil(total / filtri.limit) : 1;
  const currentPage = filtri?.page || 1;

  const toggleEspansione = (spesaId: string) => {
    const nuoveEspansioni = new Set(espansioni);
    if (nuoveEspansioni.has(spesaId)) {
      nuoveEspansioni.delete(spesaId);
    } else {
      nuoveEspansioni.add(spesaId);
    }
    setEspansioni(nuoveEspansioni);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("it-IT");
  };

  // Lista collaboratori medici dal gestionale
  const COLLABORATORI_MEDICI = [
    'Lara', 'Giacomo', 'Roberto', 'Anet', 'Rossella'
  ];

  const isCollaboratoreEsterno = (nomeFornitore: string): boolean => {
    const nome = nomeFornitore.toLowerCase();
    return COLLABORATORI_MEDICI.some(medico => 
      nome.includes(medico.toLowerCase())
    );
  };


  if (loading) {
    return (
      <CCard>
        <CCardBody className="text-center p-5">
          <CSpinner color="primary" />
          <div className="mt-3">Caricamento spese...</div>
        </CCardBody>
      </CCard>
    );
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Spese Fornitori</h5>
        <div className="text-muted">
          {total > 0 && (
            <span>
              {total} spese
              {totalBeforeLimit > total && (
                <> su {totalBeforeLimit} totali</>
              )}
            </span>
          )}
        </div>
      </CCardHeader>
      <CCardBody className="p-0">
        {spese.length === 0 ? (
          <div className="text-center p-5 text-muted">
            Nessuna spesa trovata per i filtri selezionati
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell>N. Documento</CTableHeaderCell>
                  <CTableHeaderCell>Categoria</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Totale</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: "60px" }}>Dettagli</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {[...spese].sort((a, b) => {
                  const nomeA = (a.nome_fornitore || '').toLowerCase();
                  const nomeB = (b.nome_fornitore || '').toLowerCase();
                  return nomeA.localeCompare(nomeB);
                }).map((spesa) => (
                  <React.Fragment key={spesa.id}>
                    <CTableRow id={`fattura-${spesa.id}`} style={{ cursor: "pointer" }} onClick={() => toggleEspansione(spesa.id)}>
                      <CTableDataCell>
                        <small className="text-muted">{spesa.id}</small>
                      </CTableDataCell>
                      <CTableDataCell >
                        <div className="fw-semibold">{spesa.nome_fornitore || 'Nome non trovato'}</div>
                      </CTableDataCell>
                      <CTableDataCell >
                        {formatDate(spesa.data_spesa)}
                      </CTableDataCell>

                      <CTableDataCell>
                        {spesa.numero_documento}
                      </CTableDataCell>
                      <CTableDataCell>
                        {(() => {
                          // Usa la categorizzazione automatica dall'API se disponibile
                          const categoria = spesa.categoria_automatica || "Non classificato";
                          const confidence = spesa.categoria_confidence || 0;
                          
                          // Colori per categoria
                          const getCategoriaBadgeColor = (cat: string) => {
                            if (cat === "Collaboratori") return "success";
                            if (cat === "Non classificato") return "secondary"; 
                            return "info";
                          };
                          
                          const badgeColor = getCategoriaBadgeColor(categoria);
                          const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
                          
                          return (
                            <div className="d-flex align-items-center gap-1">
                              <CBadge color={badgeColor}>
                                {categoria}
                              </CBadge>
                              {confidence > 0 && confidence < 1.0 && (
                                <CTooltip
                                  content={`Auto-categorizzato con confidence ${Math.round(confidence * 100)}%`}
                                >
                                  <CIcon 
                                    icon={cilInfo} 
                                    size="sm"
                                    className={`text-${confidenceLevel === 'high' ? 'success' : confidenceLevel === 'medium' ? 'warning' : 'danger'}`}
                                  />
                                </CTooltip>
                              )}
                            </div>
                          );
                        })()}
                      </CTableDataCell>
                      <CTableDataCell className="text-end" >
                        {formatCurrency(spesa.costo_netto+spesa.costo_iva)}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          color="light"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEspansione(spesa.id);
                          }}
                          title={espansioni.has(spesa.id) ? "Chiudi dettagli" : "Apri dettagli"}
                          style={{ minWidth: "32px", zIndex: 1, position: "relative" }}
                        >
                          {espansioni.has(spesa.id) ? "▼" : "▶"}
                        </CButton>
                      </CTableDataCell>

                    </CTableRow>
                    {espansioni.has(spesa.id) && (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className="p-0">
                          <DettagliFattura
                            fatturaId={spesa.id}
                            onCaricaMagazzino={onCaricaMagazzino}
                          />
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </React.Fragment>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}
        
        {/* Paginazione */}
        {spese.length > 0 && totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center p-3 border-top">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted">Elementi per pagina:</span>
              <CFormSelect
                size="sm"
                style={{ width: "auto" }}
                value={filtri?.limit || 50}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </CFormSelect>
            </div>
            
            <div className="text-muted">
              Pagina {currentPage} di {totalPages} ({total} totali)
            </div>
            
            <CPagination size="sm">
              <CPaginationItem
                disabled={currentPage === 1}
                onClick={() => handlePageChange(1)}
              >
                ««
              </CPaginationItem>
              <CPaginationItem
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                ‹
              </CPaginationItem>
              
              {/* Pagine centrali */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                const page = startPage + i;
                if (page <= totalPages) {
                  return (
                    <CPaginationItem
                      key={page}
                      active={page === currentPage}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </CPaginationItem>
                  );
                }
                return null;
              })}
              
              <CPaginationItem
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                ›
              </CPaginationItem>
              <CPaginationItem
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(totalPages)}
              >
                »»
              </CPaginationItem>
            </CPagination>
          </div>
        )}
      </CCardBody>
    </CCard>
  );
};

export default TabellaSpese;