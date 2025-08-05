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
import { cilChevronCircleDownAlt, cilChevronRight } from '@coreui/icons';
import { fornitoriService } from '../services/fornitori.service';
import type { Fornitore, FatturaFornitore, DettaglioFattura } from '../types';

interface FattureFornitoreModalProps {
  visible: boolean;
  onClose: () => void;
  fornitore: Fornitore | null;
}

const FattureFornitoreModal: React.FC<FattureFornitoreModalProps> = ({
  visible,
  onClose,
  fornitore
}) => {
  const [fatture, setFatture] = useState<FatturaFornitore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFatture, setTotalFatture] = useState(0);
  const itemsPerPage = 10;
  
  // Stati per dettagli fatture
  const [dettagliFatture, setDettagliFatture] = useState<Map<string, DettaglioFattura[]>>(new Map());
  const [fatturaExpanded, setFatturaExpanded] = useState<string | null>(null);
  const [loadingDettagli, setLoadingDettagli] = useState<string | null>(null);

  useEffect(() => {
    if (visible && fornitore) {
      fetchFatture(1);
    }
  }, [visible, fornitore]);

  const fetchFatture = async (page: number) => {
    if (!fornitore) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fornitoriService.getFattureFornitore(fornitore.id, page, itemsPerPage);
      setFatture(response.fatture);
      setTotalFatture(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
      setCurrentPage(page);
    } catch (err) {
      setError('Errore nel caricamento delle fatture');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchFatture(page);
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0,00 €';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
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
        const dettagli = await fornitoriService.getDettagliFattura(fatturaId);
        setDettagliFatture(prev => new Map(prev.set(fatturaId, dettagli)));
      } catch (err) {
        console.error('Errore caricamento dettagli:', err);
        setError('Errore nel caricamento dei dettagli della fattura');
        return;
      } finally {
        setLoadingDettagli(null);
      }
    }
    
    setFatturaExpanded(fatturaId);
  };

  const handleClose = () => {
    setFatture([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalFatture(0);
    setError(null);
    setDettagliFatture(new Map());
    setFatturaExpanded(null);
    setLoadingDettagli(null);
    onClose();
  };

  if (!fornitore) return null;

  return (
    <CModal visible={visible} onClose={handleClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>
          Fatture Fornitore - {fornitore.nome}
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
                    Pagina {currentPage} di {totalPages} - {totalFatture} fatture totali - 10 per pagina
                  </small>
                </div>
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
            
            <CTable striped hover responsive className="mb-3">
              <CTableHead color="dark">
                <CTableRow>
                  <CTableHeaderCell style={{ width: '40px' }}></CTableHeaderCell>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Data Spesa</CTableHeaderCell>
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
                      <CTableDataCell>{formatDate(fattura.data_spesa)}</CTableDataCell>
                      <CTableDataCell>{fattura.numero_documento || '-'}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(fattura.costo_netto)}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(fattura.costo_iva)}</CTableDataCell>
                      <CTableDataCell>{formatCurrency((fattura.costo_netto || 0) + (fattura.costo_iva || 0))}</CTableDataCell>
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
                                  <CTable size="sm" className="mb-0">
                                    <CTableHead>
                                      <CTableRow>
                                        <CTableHeaderCell>Codice Articolo</CTableHeaderCell>
                                        <CTableHeaderCell>Descrizione</CTableHeaderCell>
                                        <CTableHeaderCell>Quantità</CTableHeaderCell>
                                        <CTableHeaderCell>Prezzo Unit.</CTableHeaderCell>
                                        <CTableHeaderCell>Sconto %</CTableHeaderCell>
                                        <CTableHeaderCell>IVA %</CTableHeaderCell>
                                        <CTableHeaderCell>Totale Riga</CTableHeaderCell>
                                      </CTableRow>
                                    </CTableHead>
                                    <CTableBody>
                                      {dettagliFatture.get(fattura.id)!.map((dettaglio, index) => (
                                        <CTableRow key={index}>
                                          <CTableDataCell>{dettaglio.codice_articolo || '-'}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.descrizione || '-'}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.quantita || 0}</CTableDataCell>
                                          <CTableDataCell>{formatCurrency(dettaglio.prezzo_unitario)}</CTableDataCell>
                                          <CTableDataCell>{dettaglio.sconto || 0}%</CTableDataCell>
                                          <CTableDataCell>{dettaglio.aliquota_iva || 0}%</CTableDataCell>
                                          <CTableDataCell><strong>{formatCurrency(dettaglio.totale_riga)}</strong></CTableDataCell>
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
                      Nessuna fattura trovata per questo fornitore
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

            {totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted">
                    Pagina {currentPage} di {totalPages} - {totalFatture} fatture totali
                  </small>
                </div>
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
        <CButton color="secondary" onClick={handleClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default FattureFornitoreModal;