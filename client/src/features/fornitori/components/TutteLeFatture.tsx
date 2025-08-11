import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormSelect,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CAlert,
  CBadge,
  CPagination,
  CPaginationItem,
} from '@coreui/react';
import Select from 'react-select';
// import CIcon from '@coreui/icons-react';
// import { cilX } from '@coreui/icons';
import { fornitoriService } from '../services/fornitori.service';
import DettagliFatturaModal from './DettagliFatturaModal';
import type { Fornitore, FatturaFornitore } from '../types';

const TutteLeFatture: React.FC = () => {
  // Stati per fornitori
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState<{value: string, label: string, fornitore: Fornitore} | null>(null);
  
  // Stati per fatture
  const [tutteLeFatture, setTutteLeFatture] = useState<FatturaFornitore[]>([]);
  const [fattureVisualizzate, setFattureVisualizzate] = useState<FatturaFornitore[]>([]);
  const [anniDisponibili, setAnniDisponibili] = useState<number[]>([]);
  const [annoSelezionato, setAnnoSelezionato] = useState<string>('');
  
  // Stati UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stati modal dettagli
  const [selectedFattura, setSelectedFattura] = useState<FatturaFornitore | null>(null);
  const [showDettagliModal, setShowDettagliModal] = useState(false);
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // Carica fornitori all'avvio
  useEffect(() => {
    fetchFornitori();
  }, []);

  // Aggiorna paginazione quando cambiano le fatture visualizzate
  useEffect(() => {
    const totalPages = Math.ceil(fattureVisualizzate.length / itemsPerPage);
    setTotalPages(totalPages);
    setCurrentPage(1);
  }, [fattureVisualizzate]);

  const fetchFornitori = async () => {
    try {
      const response = await fornitoriService.getFornitori();
      setFornitori(response.data || []);
    } catch (err) {
      setError('Errore nel caricamento dei fornitori');
      console.error('Errore fetchFornitori:', err);
    }
  };

  const caricaFattureFornitore = async (fornitoreId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Usa la nuova API per ottenere TUTTE le fatture storiche
      const response = await fetch(`/api/spese-fornitori/fornitore/${fornitoreId}/all?limit=10000`);
      const data = await response.json();
      
      if (data.success) {
        const fatture = data.data || [];
        setTutteLeFatture(fatture);
        
        // Estrai gli anni dalle fatture e ordina
        const anni = [...new Set(fatture
          .map((f: FatturaFornitore) => f.data_spesa ? new Date(f.data_spesa).getFullYear() : null)
          .filter((anno: number | null) => anno !== null)
        )].sort((a, b) => b - a); // Ordine decrescente
        
        setAnniDisponibili(anni as number[]);
        setFattureVisualizzate(fatture);
        setAnnoSelezionato(''); // Reset filtro anno
      } else {
        setError('Errore nel caricamento delle fatture');
      }
    } catch (err) {
      setError('Errore nel caricamento delle fatture');
      console.error('Errore caricaFattureFornitore:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtraPerAnno = (anno: string) => {
    setAnnoSelezionato(anno);
    
    if (!anno) {
      // Mostra tutte le fatture del fornitore
      setFattureVisualizzate(tutteLeFatture);
    } else {
      // Filtra per anno
      const fattureAnno = tutteLeFatture.filter(fattura => {
        if (!fattura.data_spesa) return false;
        const annoFattura = new Date(fattura.data_spesa).getFullYear();
        return annoFattura.toString() === anno;
      });
      setFattureVisualizzate(fattureAnno);
    }
  };

  // const pulisciFiltri = () => {
  //   setAnnoSelezionato('');
  //   setFattureVisualizzate(tutteLeFatture);
  // };

  // const resetTutto = () => {
  //   setFornitoreSelezionato(null);
  //   setTutteLeFatture([]);
  //   setFattureVisualizzate([]);
  //   setAnniDisponibili([]);
  //   setAnnoSelezionato('');
  //   setCurrentPage(1);
  //   setError(null);
  // };

  const handleFornitoreSelect = (selectedOption: {value: string, label: string, fornitore: Fornitore} | null) => {
    setFornitoreSelezionato(selectedOption);
    if (selectedOption) {
      caricaFattureFornitore(selectedOption.fornitore.id);
    } else {
      // Reset quando si deseleziona
      setTutteLeFatture([]);
      setFattureVisualizzate([]);
      setAnniDisponibili([]);
      setAnnoSelezionato('');
    }
  };

  // Opzioni per react-select
  const fornitoriOptions = fornitori.map(fornitore => ({
    value: fornitore.id,
    label: `${fornitore.nome || 'Nome non disponibile'} (${fornitore.id})`,
    fornitore: fornitore
  }));

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

  // Paginazione
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const fattureCurrentPage = fattureVisualizzate.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleShowDettagli = (fattura: FatturaFornitore) => {
    setSelectedFattura(fattura);
    setShowDettagliModal(true);
  };

  const handleCloseDettagli = () => {
    setSelectedFattura(null);
    setShowDettagliModal(false);
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
  );

  return (
    <>
      <CCard>
        <CCardHeader>
          <CRow className="align-items-center mb-3">
            <CCol>
              <h5 className="mb-0">
                Ricerca Fatture per Fornitore
                {fattureVisualizzate.length > 0 && (
                  <>
                    <CBadge color="info" className="ms-2">
                      {fattureVisualizzate.length} fatture
                    </CBadge>
                    {annoSelezionato && (
                      <CBadge color="warning" className="ms-1">
                        Anno {annoSelezionato}
                      </CBadge>
                    )}
                  </>
                )}
              </h5>
            </CCol>
            <CCol xs="auto">
              {totalPages > 1 && (
                <div className="d-flex justify-content-end align-items-center">
                  <small className="text-muted me-3">
                    Pagina {currentPage} di {totalPages} - {fattureVisualizzate.length} fatture
                  </small>
                  {renderPagination()}
                </div>
              )}
            </CCol>
          </CRow>

          {/* Controlli ricerca e filtri */}
          <CRow className="g-3">
            <CCol md={6}>
              <label className="form-label">Seleziona Fornitore</label>
              <Select
                isClearable
                options={fornitoriOptions}
                value={fornitoreSelezionato}
                onChange={handleFornitoreSelect}
                placeholder="Cerca e seleziona fornitore..."
                noOptionsMessage={() => "Nessun fornitore trovato"}
                styles={{
                  control: base => ({ ...base, minHeight: 38, fontSize: 16 }),
                  singleValue: base => ({ ...base, fontSize: 15 })
                }}
              />
            </CCol>
            
            <CCol md={6}>
              <label className="form-label">Filtra per Anno</label>
              <CFormSelect
                value={annoSelezionato}
                onChange={(e) => filtraPerAnno(e.target.value)}
                disabled={anniDisponibili.length === 0}
              >
                <option value="">Tutti gli anni</option>
                {anniDisponibili.map(anno => (
                  <option key={anno} value={anno.toString()}>{anno}</option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
        </CCardHeader>
        
        <CCardBody className="p-0">
          {error && (
            <CAlert color="danger" className="m-3">
              {error}
            </CAlert>
          )}

          {loading && (
            <div className="text-center p-4">
              <CSpinner color="primary" />
              <p className="mt-2 mb-0">Caricamento fatture...</p>
            </div>
          )}

          {!loading && fattureVisualizzate.length > 0 && (
            <CTable striped hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>ID</CTableHeaderCell>
                <CTableHeaderCell>Data Spesa</CTableHeaderCell>
                <CTableHeaderCell>Numero Doc.</CTableHeaderCell>
                <CTableHeaderCell>Descrizione</CTableHeaderCell>
                <CTableHeaderCell>Costo Netto</CTableHeaderCell>
                <CTableHeaderCell>Costo IVA</CTableHeaderCell>
                <CTableHeaderCell>Totale</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {fattureCurrentPage.map((fattura) => (
                <CTableRow 
                  key={fattura.id} 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleShowDettagli(fattura)}
                >
                  <CTableDataCell>{fattura.id}</CTableDataCell>
                  <CTableDataCell>{formatDate(fattura.data_spesa)}</CTableDataCell>
                  <CTableDataCell>{fattura.numero_documento || '-'}</CTableDataCell>
                  <CTableDataCell>{fattura.descrizione || '-'}</CTableDataCell>
                  <CTableDataCell>{formatCurrency(fattura.costo_netto)}</CTableDataCell>
                  <CTableDataCell>{formatCurrency(fattura.costo_iva)}</CTableDataCell>
                  <CTableDataCell>
                    <strong>{formatCurrency((fattura.costo_netto || 0) + (fattura.costo_iva || 0))}</strong>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
            </CTable>
          )}

          {!loading && !fornitoreSelezionato && (
            <div className="text-center p-5">
              <h5>Seleziona un fornitore</h5>
              <p className="text-muted">Usa la ricerca qui sopra per selezionare un fornitore e vedere tutte le sue fatture storiche</p>
            </div>
          )}

          {!loading && fornitoreSelezionato && fattureVisualizzate.length === 0 && (
            <div className="text-center p-5">
              <h5>Nessuna fattura trovata</h5>
              <p className="text-muted">
                Il fornitore selezionato non ha fatture
                {annoSelezionato ? ` per l'anno ${annoSelezionato}` : ''}
              </p>
            </div>
          )}
        </CCardBody>

        {/* Card Footer con paginazione e totali */}
        {!loading && fattureVisualizzate.length > 0 && (
          <CCardBody className="pt-0">
            <CRow className="align-items-center">
              <CCol>
                {/* Totale */}
                <div className="border rounded p-3 bg-light">
                  <strong>
                    Totale fatture visualizzate: {formatCurrency(
                      fattureVisualizzate.reduce((sum, fattura) => 
                        sum + (fattura.costo_netto || 0) + (fattura.costo_iva || 0), 0
                      )
                    )}
                  </strong>
                </div>
              </CCol>
              <CCol xs="auto">
                {/* Paginazione inferiore */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-end align-items-center">
                    <small className="text-muted me-3">
                      Pagina {currentPage} di {totalPages} - {fattureVisualizzate.length} fatture
                    </small>
                    {renderPagination()}
                  </div>
                )}
              </CCol>
            </CRow>
          </CCardBody>
        )}
      </CCard>

      {/* Modal Dettagli Fattura */}
      <DettagliFatturaModal
        visible={showDettagliModal}
        onClose={handleCloseDettagli}
        fattura={selectedFattura}
      />
    </>
  );
};

export default TutteLeFatture;