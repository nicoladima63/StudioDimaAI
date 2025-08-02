import React, { useState, useEffect } from 'react';
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
  CFormSelect
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilZoom, cilDescription } from '@coreui/icons';
import { fornitoriService } from '../services/fornitori.service';
import type { Fornitore } from '../types';
import FornitoreDetailModal from './FornitoreDetailModal';
import FattureFornitoreModal from './FattureFornitoreModal';

const FornitoriView: React.FC = () => {
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [allFornitori, setAllFornitori] = useState<Fornitore[]>([]);
  const [filteredFornitori, setFilteredFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFattureModal, setShowFattureModal] = useState(false);
  
  // Ricerca e filtri
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'id' | 'nome'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFornitori();
  }, []);

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
      setError('Errore nel caricamento dei fornitori');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allFornitori];

    // Applicare ricerca
    if (searchTerm) {
      filtered = filtered.filter(fornitore => 
        fornitore.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornitore.telefono?.includes(searchTerm)
      );
    }

    // Applicare ordinamento
    filtered.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      
      if (sortDirection === 'asc') {
        return aValue.toString().localeCompare(bValue.toString(), 'it', { numeric: true });
      } else {
        return bValue.toString().localeCompare(aValue.toString(), 'it', { numeric: true });
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

  const handleSort = (field: 'id' | 'nome') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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

  const handleShowDetail = async (fornitoreId: string) => {
    try {
      const fornitore = await fornitoriService.getFornitoreById(fornitoreId);
      setSelectedFornitore(fornitore);
      setShowDetailModal(true);
    } catch (err) {
      setError('Errore nel caricamento dei dettagli del fornitore');
      console.error('Errore handleShowDetail:', err);
    }
  };

  const handleShowFatture = async (fornitoreId: string) => {
    try {
      const fornitore = await fornitoriService.getFornitoreById(fornitoreId);
      setSelectedFornitore(fornitore);
      setShowFattureModal(true);
    } catch (err) {
      setError('Errore nel caricamento delle fatture del fornitore');
      console.error('Errore handleShowFatture:', err);
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
                <CBadge color="info" className="ms-2">{allFornitori.length}</CBadge>
                {filteredFornitori.length !== allFornitori.length && (
                  <CBadge color="warning" className="ms-1">
                    {filteredFornitori.length} filtrati
                  </CBadge>
                )}
              </h5>
            </CCol>
            <CCol xs="auto">
              <CButton color="primary" size="sm" onClick={fetchFornitori}>
                Aggiorna
              </CButton>
            </CCol>
          </CRow>
          
          {/* Controlli ricerca e filtri */}
          <CRow className="g-3">
            <CCol md={4}>
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
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              >
                <option value={10}>10 per pagina</option>
                <option value={20}>20 per pagina</option>
                <option value={50}>50 per pagina</option>
                <option value={100}>100 per pagina</option>
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              {/* Navigazione pagine superiore */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-end align-items-center">
                  <small className="text-muted me-3">
                    Pagina {currentPage} di {totalPages} - {filteredFornitori.length} fornitori
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
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('id')}
                >
                  ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                </CTableHeaderCell>
                <CTableHeaderCell 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('nome')}
                >
                  Nome {sortField === 'nome' && (sortDirection === 'asc' ? '↑' : '↓')}
                </CTableHeaderCell>
                <CTableHeaderCell>Telefono</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>IBAN</CTableHeaderCell>
                <CTableHeaderCell>Azioni</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {fornitori.map((fornitore) => (
                <CTableRow key={fornitore.id}>
                  <CTableDataCell>{fornitore.id}</CTableDataCell>
                  <CTableDataCell>{fornitore.nome || '-'}</CTableDataCell>
                  <CTableDataCell>{fornitore.telefono || '-'}</CTableDataCell>
                  <CTableDataCell>{fornitore.email || '-'}</CTableDataCell>
                  <CTableDataCell>{fornitore.iban || '-'}</CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      color="primary"
                      variant="outline"
                      size="sm"
                      className="me-2"
                      onClick={() => handleShowDetail(fornitore.id)}
                    >
                      <CIcon icon={cilZoom} size="sm" className="me-1" />
                      Dettagli
                    </CButton>
                    <CButton
                      color="info"
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowFatture(fornitore.id)}
                    >
                      <CIcon icon={cilDescription} size="sm" className="me-1" />
                      Fatture
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {fornitori.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={6} className="text-center p-4">
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
                  Pagina {currentPage} di {totalPages} - {filteredFornitori.length} fornitori
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