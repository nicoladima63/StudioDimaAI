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
  CRow,
  CCol,
} from "@coreui/react";
import type { SpesaFornitore, DettaglioSpesaFornitore, FiltriSpese } from "../types";
import DettagliFattura from "./DettagliFattura";

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

  const getCategoriaLabel = (categoria: number): string => {
    // Mappa delle categorie - da personalizzare in base alle esigenze
    const categorie: { [key: number]: string } = {
      0: "Non classificato",
      1: "Materiali",
      2: "Servizi",
      3: "Consulenze",
      4: "Attrezzature",
      5: "Manutenzione",
      // Aggiungi altre categorie in base ai dati reali
    };
    return categorie[categoria] || `Categoria ${categoria}`;
  };

  const getCategoriaColor = (categoria: number): string => {
    const colors = ["secondary", "primary", "success", "info", "warning", "danger"];
    return colors[categoria % colors.length];
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
                  <CTableHeaderCell style={{ width: "60px" }}>Dettagli</CTableHeaderCell>
                  <CTableHeaderCell>Data</CTableHeaderCell>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Fornitore</CTableHeaderCell>
                  <CTableHeaderCell>N. Documento</CTableHeaderCell>
                  <CTableHeaderCell>Categoria</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Netto</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">Con IVA</CTableHeaderCell>
                  <CTableHeaderCell>Note</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {spese.map((spesa) => (
                  <React.Fragment key={spesa.id}>
                    <CTableRow id={`fattura-${spesa.id}`} style={{ cursor: "pointer" }}>
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
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        {formatDate(spesa.data_spesa)}
                      </CTableDataCell>
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        <small className="text-muted">{spesa.id}</small>
                      </CTableDataCell>
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        <div className="fw-semibold">{spesa.codice_fornitore}</div>
                        <small className="text-muted">{spesa.nome_fornitore || 'Nome non trovato'}</small>
                      </CTableDataCell>
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        {spesa.numero_documento}
                      </CTableDataCell>
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        <CBadge color={getCategoriaColor(spesa.categoria)}>
                          {getCategoriaLabel(spesa.categoria)}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell className="text-end" onClick={() => toggleEspansione(spesa.id)}>
                        {formatCurrency(spesa.costo_netto)}
                      </CTableDataCell>
                      <CTableDataCell className="text-end fw-bold" onClick={() => toggleEspansione(spesa.id)}>
                        {formatCurrency(spesa.costo_iva)}
                      </CTableDataCell>
                      <CTableDataCell onClick={() => toggleEspansione(spesa.id)}>
                        {spesa.note && (
                          <div className="text-truncate" style={{ maxWidth: "150px" }}>
                            {spesa.note}
                          </div>
                        )}
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