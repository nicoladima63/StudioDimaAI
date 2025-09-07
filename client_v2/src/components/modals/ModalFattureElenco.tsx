import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CPagination,
  CPaginationItem,
  CAlert,
  CSpinner,
  CBadge,
  CCollapse,
  CCard,
  CCardBody
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilX, cilList, cilChevronCircleDownAlt, cilChevronRight } from '@coreui/icons';
import './modals.css';

export interface FatturaBase {
  id: string;
  data_spesa?: string; // Per fornitori
  data_fattura?: string; // Per pazienti  
  numero_documento?: string;
  costo_netto?: number;
  costo_iva?: number;
  totale?: number;
  descrizione?: string;
  note?: string;
}

export interface DettaglioFatturaBase {
  id?: string;
  codice_articolo?: string;
  descrizione?: string;
  quantita?: number;
  prezzo_unitario?: number;
  sconto?: number;
  aliquota_iva?: number;
  totale_riga?: number;
}

export interface ModalFattureElencoProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entitaId: string; // ID fornitore o paziente
  entitaType: 'fornitore' | 'paziente';
  onFetchFatture: (entitaId: string, page: number, perPage: number) => Promise<{
    fatture: FatturaBase[];
    total: number;
  }>;
  onFetchDettagliFattura: (fatturaId: string) => Promise<DettaglioFatturaBase[]>;
  size?: 'sm' | 'lg' | 'xl';
}

const ModalFattureElenco: React.FC<ModalFattureElencoProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  entitaId,
  entitaType,
  onFetchFatture,
  onFetchDettagliFattura,
  size = 'xl'
}) => {
  const [fatture, setFatture] = useState<FatturaBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFatture, setTotalFatture] = useState(0);
  const itemsPerPage = 10;
  
  // Stati per dettagli fatture (espansione inline)
  const [dettagliFatture, setDettagliFatture] = useState<Map<string, DettaglioFatturaBase[]>>(new Map());
  const [fatturaExpanded, setFatturaExpanded] = useState<string | null>(null);
  const [loadingDettagli, setLoadingDettagli] = useState<string | null>(null);

  // Carica fatture quando la modal si apre
  useEffect(() => {
    if (visible && entitaId) {
      fetchFatture(1);
    } else {
      // Reset quando si chiude
      resetState();
    }
  }, [visible, entitaId]);

  const resetState = () => {
    setFatture([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalFatture(0);
    setError(null);
    setDettagliFatture(new Map());
    setFatturaExpanded(null);
    setLoadingDettagli(null);
  };

  const fetchFatture = async (page: number) => {
    if (!entitaId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await onFetchFatture(entitaId, page, itemsPerPage);
      setFatture(response.fatture);
      setTotalFatture(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchFatture(page);
  };

  const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return '0,00 €';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  const handleToggleDettagli = async (fatturaId: string) => {
    if (fatturaExpanded === fatturaId) {
      // Chiudi se già aperto
      setFatturaExpanded(null);
      return;
    }
    
    // Se non abbiamo già i dettagli, caricali
    if (!dettagliFatture.has(fatturaId)) {
      try {
        setLoadingDettagli(fatturaId);
        const dettagli = await onFetchDettagliFattura(fatturaId);
        setDettagliFatture(prev => new Map(prev.set(fatturaId, dettagli)));
      } catch (err: any) {
        console.error('Errore caricamento dettagli:', err);
        setError('Errore nel caricamento dei dettagli della fattura');
        return;
      } finally {
        setLoadingDettagli(null);
      }
    }
    
    setFatturaExpanded(fatturaId);
  };

  const getDataLabel = () => {
    return entitaType === 'fornitore' ? 'Data Spesa' : 'Data Fattura';
  };

  const getDataValue = (fattura: FatturaBase) => {
    return entitaType === 'fornitore' ? fattura.data_spesa : fattura.data_fattura;
  };

  return (
    <CModal visible={visible} onClose={onClose} size={size} scrollable className="modal-fatture-elenco">
      <CModalHeader>
        <CModalTitle className="d-flex align-items-center">
          <CIcon icon={cilList} className="me-2" />
          <span>{title}</span>
          {subtitle && (
            <span className="text-muted fs-6 fw-normal ms-2">
              - {subtitle}
            </span>
          )}
          {totalFatture > 0 && (
            <CBadge color="info" className="ms-2">
              {totalFatture} fatture
            </CBadge>
          )}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        {loading && (
          <div className="text-center p-4">
            <CSpinner color="primary" />
            <p className="mt-2 mb-0">Caricamento fatture...</p>
          </div>
        )}

        {error && (
          <CAlert color="danger" dismissible>
            {error}
            <CButton 
              color="danger" 
              variant="outline" 
              size="sm" 
              className="ms-2" 
              onClick={() => fetchFatture(currentPage)}
            >
              Riprova
            </CButton>
          </CAlert>
        )}

        {!loading && !error && (
          <>
            {totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <small className="text-muted">
                    Pagina {currentPage} di {totalPages} - {totalFatture} fatture totali
                  </small>
                </div>
              </div>
            )}
            
            <CTable striped hover responsive className="mb-3">
              <CTableHead color="dark">
                <CTableRow>
                  <CTableHeaderCell style={{ width: '40px' }}></CTableHeaderCell>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>{getDataLabel()}</CTableHeaderCell>
                  <CTableHeaderCell>Numero Doc.</CTableHeaderCell>
                  <CTableHeaderCell>Costo Netto</CTableHeaderCell>
                  <CTableHeaderCell>Costo IVA</CTableHeaderCell>
                  <CTableHeaderCell>Totale</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {fatture.map((fattura) => (
                  <React.Fragment key={fattura.id}>
                    <CTableRow 
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleToggleDettagli(fattura.id)}
                    >
                      <CTableDataCell>
                        {loadingDettagli === fattura.id ? (
                          <CSpinner size="sm" />
                        ) : (
                          <CIcon 
                            icon={fatturaExpanded === fattura.id ? cilChevronCircleDownAlt : cilChevronRight} 
                            size="sm" 
                          />
                        )}
                      </CTableDataCell>
                      <CTableDataCell>{fattura.id}</CTableDataCell>
                      <CTableDataCell>{formatDate(getDataValue(fattura))}</CTableDataCell>
                      <CTableDataCell>{fattura.numero_documento || '-'}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(fattura.costo_netto)}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(fattura.costo_iva)}</CTableDataCell>
                      <CTableDataCell>
                        {formatCurrency((fattura.costo_netto || 0) + (fattura.costo_iva || 0))}
                      </CTableDataCell>
                    </CTableRow>
                    
                    {/* Riga espandibile con dettagli */}
                    {fatturaExpanded === fattura.id && (
                      <CTableRow>
                        <CTableDataCell colSpan={7} className="p-0">
                          <CCollapse visible={true}>
                            <CCard className="border-0">
                              <CCardBody className="bg-light">
                                <h6 className="mb-3">Dettagli Fattura {fattura.id}</h6>
                                {dettagliFatture.get(fattura.id)?.length ? (
                                  <CTable className="mb-0">
                                    <CTableHead>
                                      <CTableRow>
                                        <CTableHeaderCell>Cod. Articolo</CTableHeaderCell>
                                        <CTableHeaderCell>Descrizione</CTableHeaderCell>
                                        <CTableHeaderCell>Quantità</CTableHeaderCell>
                                        <CTableHeaderCell>Prezzo Unit.</CTableHeaderCell>
                                        <CTableHeaderCell>Sconto %</CTableHeaderCell>
                                        <CTableHeaderCell>IVA %</CTableHeaderCell>
                                        <CTableHeaderCell>Totale Riga</CTableHeaderCell>
                                      </CTableRow>
                                    </CTableHead>
                                    <CTableBody>
                                      {dettagliFatture.get(fattura.id)!
                                        .filter(dettaglio => {
                                          const quantita = dettaglio.quantita || 0;
                                          const prezzo = dettaglio.prezzo_unitario || 0;
                                          return quantita > 0 && prezzo > 0;
                                        })
                                        .map((dettaglio, index) => (
                                        <CTableRow key={index}>
                                          <CTableDataCell>{dettaglio.codice_articolo || '-'}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.descrizione || '-'}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.quantita || 0}</CTableDataCell>
                                          <CTableDataCell>{formatCurrency(dettaglio.prezzo_unitario)}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.sconto || 0}%</CTableDataCell>
                                          <CTableDataCell>{dettaglio.aliquota_iva || 0}%</CTableDataCell>
                                          <CTableDataCell>
                                            <strong>{formatCurrency(dettaglio.totale_riga)}</strong>
                                          </CTableDataCell>
                                        </CTableRow>
                                      ))}
                                    </CTableBody>
                                  </CTable>
                                ) : (
                                  <p className="text-muted mb-0">Nessun dettaglio disponibile per questa fattura</p>
                                )}
                              </CCardBody>
                            </CCard>
                          </CCollapse>
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </React.Fragment>
                ))}
                {fatture.length === 0 && !loading && (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center p-4">
                      Nessuna fattura trovata
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            {/* Totale fatture */}
            {fatture.length > 0 && (
              <div className="d-flex justify-content-end mb-3">
                <div className="border rounded p-3 bg-light">
                  <strong>
                    Totale fatture visualizzate: {formatCurrency(
                      fatture.reduce((sum, fattura) => 
                        sum + (fattura.costo_netto || 0) + (fattura.costo_iva || 0), 0
                      )
                    )}
                  </strong>
                </div>
              </div>
            )}

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center">
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
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
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
              </div>
            )}
          </>
        )}
      </CModalBody>
      
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          <CIcon icon={cilX} size="sm" className="me-1" />
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default ModalFattureElenco;