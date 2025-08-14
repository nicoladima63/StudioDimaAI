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
  CFormSelect,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CInputGroup,
  CInputGroupText
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilSave, cilSearch, cilSettings } from '@coreui/icons';
import type { Fornitore } from '../../fornitori/types';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import SelectConto from '@/components/selects/SelectConto';
import {SelectBranca} from '@/components/selects/SelectBranca';
import {SelectSottoconto} from '@/components/selects/SelectSottoconto';
import apiClient from '@/api/client';
import { useContiStore } from '@/store/contiStore';

interface MaterialeDettaglio {
  codice_articolo: string;
  descrizione: string;
  prezzo_unitario: number;
  quantita: number;
  totale_riga: number;
  fattura_id: string;
  data_fattura: string | null;
  riga_fattura_id: string;
  riga_originale_id: string;
  classificazione_suggerita?: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
    confidence: number;
    motivo: string;
  };
}

interface MaterialeBundlePayload {
  codicearticolo: string;
  nome: string;
  fornitoreid: string;
  fornitorenome: string;
  contoid: number;
  contonome: string;
  brancaid: number | null;
  brancanome: string | null;
  sottocontoid: number | null;
  sottocontonome: string | null;
  confidence: number;
  confermato: boolean;
  occorrenze: number;
  conto_codice: string | null;
  sottoconto_codice: string | null;
  categoria_contabile: string | null;
  metodo_classificazione: string;
  data_fattura: string | null;
  costo_unitario: number;
  fattura_id: string;
  riga_fattura_id: string;
}

const MaterialiBundlePage: React.FC = () => {
  const contiStore = useContiStore();

  // Stati principali
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(null);
  const [materiali, setMateriali] = useState<MaterialeDettaglio[]>([]);
  const [materialiFiltered, setMaterialiFiltered] = useState<MaterialeDettaglio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stati per classificazione bundle
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);


  // Stati per tabella e paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'descrizione' | 'prezzo_unitario' | 'data_fattura'>('descrizione');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Stati per modal conferma
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [archivingMateriali, setArchivingMateriali] = useState<MaterialeBundlePayload[]>([]);

  // Effetto per ricerca e ordinamento
  useEffect(() => {
    applyFiltersAndSort();
  }, [materiali, searchTerm, sortField, sortDirection]);

  // Effetto per paginazione
  useEffect(() => {
    const totalPages = Math.ceil(materialiFiltered.length / itemsPerPage);
    setTotalPages(totalPages);
    setCurrentPage(1);
  }, [materialiFiltered, itemsPerPage]);

  const fetchMaterialiFornitore = async (fornitoreId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/api/materiali/fornitori/${fornitoreId}/materiali-intelligenti`);
      
      if (response.data.success) {
        setMateriali(response.data.data || []);
      } else {
        setError(response.data.error || 'Errore nel caricamento dei materiali');
      }
    } catch (err) {
      setError('Errore nel caricamento dei materiali del fornitore');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFornitoreChange = async (fornitore: Fornitore | null) => {
    setSelectedFornitore(fornitore);
    setMateriali([]);
    setMaterialiFiltered([]);
    setCurrentPage(1);
    setContoId(null);
    setBrancaId(null);
    setSottocontoId(null);
    
    if (fornitore) {
      // Recupera e applica la classificazione del fornitore
      await fetchAndApplyFornitoreClassificazione(fornitore.id);
      // Poi carica i materiali
      fetchMaterialiFornitore(fornitore.id);
    } 
  };

  const fetchAndApplyFornitoreClassificazione = async (fornitoreId: string) => {
    try {
      const response = await apiClient.get(`/api/fornitori/${fornitoreId}/classificazione`);
      
      if (response.data.success && response.data.data) {
        const { contoid, brancaid, sottocontoid } = response.data.data;
        
        // Carica i dati necessari nello store
        await contiStore.loadConti();
        if (contoid && brancaid) {
          await contiStore.loadBranche(contoid);
        }
        if (brancaid && sottocontoid) {
          await contiStore.loadSottoconti(brancaid);
        }
        
        // Poi setta i valori nelle select
        setContoId(contoid);
        setBrancaId(brancaid);
        setSottocontoId(sottocontoid);
      }
    } catch (err) {
      console.error('Errore nel recupero classificazione fornitore:', err);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...materiali];

    // Applicare ricerca
    if (searchTerm) {
      filtered = filtered.filter(
        (materiale) =>
          materiale.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          materiale.codice_articolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          materiale.fattura_id?.includes(searchTerm)
      );
    }

    // Applicare ordinamento
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'prezzo_unitario') {
        aValue = a[sortField] || 0;
        bValue = b[sortField] || 0;
      } else if (sortField === 'data_fattura') {
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
      } else {
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
      }

      if (sortDirection === 'asc') {
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }
        return aValue.toString().localeCompare(bValue.toString(), 'it', { numeric: true });
      } else {
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return bValue - aValue;
        }
        return bValue.toString().localeCompare(aValue.toString(), 'it', { numeric: true });
      }
    });

    setMaterialiFiltered(filtered);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSort = (field: 'descrizione' | 'prezzo_unitario' | 'data_fattura') => {
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

  const handleDeleteMateriale = (riga_fattura_id: string) => {
    setMateriali(prev => prev.filter(m => m.riga_fattura_id !== riga_fattura_id));
  };

  const handleClassificaFornitore = async () => {
    if (!selectedFornitore || !contoId) {
      setError('Seleziona fornitore e almeno il conto per classificare');
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        codice_riferimento: selectedFornitore.id,
        tipo_entita: 'fornitore',
        tipo_di_costo: 1,
        note: null,
        contoid: contoId,
        brancaid: brancaId || 0,
        sottocontoid: sottocontoId || 0,
        data_classificazione: new Date().toISOString().split('T')[0],
        data_modifica: new Date().toISOString().split('T')[0],
        fornitore_nome: selectedFornitore.nome
      };

      const response = await apiClient.put(`/api/classificazioni/fornitore/${selectedFornitore.id}/completa`, payload);

      if (response.data.success) {
        const classificationType = brancaId && sottocontoId ? 'completa' : 'parziale';
        alert(`Fornitore "${selectedFornitore.nome}" classificato con successo (${classificationType})!`);
        
        // Ricarica la classificazione per aggiornare l'UI
        await fetchAndApplyFornitoreClassificazione(selectedFornitore.id);
      } else {
        setError(response.data.error || 'Errore durante la classificazione del fornitore');
      }
    } catch (err) {
      setError('Errore durante la classificazione del fornitore');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiviaClick = async () => {
    if (!selectedFornitore || !contoId || materialiFiltered.length === 0) {
      setError('Seleziona fornitore, classificazione e assicurati che ci siano materiali da archiviare');
      return;
    }

    // Recupera i nomi dallo store
    const conto = contiStore.getContoById(contoId);
    const contoNome = conto?.nome || '';
    const brancaNome = brancaId ? contiStore.getBrancaById(brancaId) || null : null;
    const sottocontoNome = sottocontoId ? contiStore.getSottocontoById(sottocontoId) || null : null;

    // Prepara l'oggetto bundle per il salvataggio con TUTTI i campi della tabella
    const materialiBundle: MaterialeBundlePayload[] = materialiFiltered.map(materiale => ({
      codicearticolo: materiale.codice_articolo,
      nome: materiale.descrizione,
      fornitoreid: selectedFornitore.id,
      fornitorenome: selectedFornitore.nome,
      contoid: contoId,
      contonome: contoNome,
      brancaid: brancaId,
      brancanome: brancaNome,
      sottocontoid: sottocontoId,
      sottocontonome: sottocontoNome,
      confidence: 100,
      confermato: true,
      occorrenze: 1,
      conto_codice: contoNome, // Usiamo il nome come codice per ora
      sottoconto_codice: sottocontoNome, // Usiamo il nome come codice per ora
      categoria_contabile: null, // Calcolato dal backend se necessario
      metodo_classificazione: 'manuale',
      data_fattura: materiale.data_fattura,
      costo_unitario: materiale.prezzo_unitario,
      fattura_id: materiale.fattura_id,
      riga_fattura_id: materiale.riga_fattura_id
    }));

    setArchivingMateriali(materialiBundle);
    setShowConfirmModal(true);
  };

  const handleConfirmArchivia = async () => {
    try {
      setLoading(true);
      
      // Salva i materiali usando il nuovo endpoint insert-bundle
      const response = await apiClient.post('/api/materiali/insert-bundle', {
        materiali: archivingMateriali
      });

      if (response.data.success) {
        setShowConfirmModal(false);
        setMateriali([]);
        setMaterialiFiltered([]);
        setError(null);
        // Reset classificazione
        setContoId(null);
        setBrancaId(null);
        setSottocontoId(null);
        
        const message = response.data.materiali_falliti > 0 
          ? `Archiviati ${response.data.materiali_salvati} materiali con successo, ${response.data.materiali_falliti} falliti`
          : `Archiviati ${response.data.materiali_salvati} materiali con successo!`;
        alert(message);
      } else {
        setError(response.data.error || 'Errore durante l\'archiviazione');
      }
    } catch (err) {
      setError('Errore durante l\'archiviazione dei materiali');
      console.error('Errore:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPageMateriali = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return materialiFiltered.slice(startIndex, endIndex);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
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
          <h5 className="mb-0">Catalogazione Materiali Bundle</h5>
        </CCardHeader>
        <CCardBody>
          {/* Selezione Fornitore */}
          <CRow className="mb-3">
            <CCol md={6}>
              <label className="form-label">Seleziona Fornitore</label>
              <FornitoriSelect
                selectedFornitore={selectedFornitore}
                onFornitoreChange={handleFornitoreChange}
              />
            </CCol>
            {selectedFornitore && contoId && (
              <CCol md={6} className="d-flex align-items-end">
                <CButton
                  color="primary"
                  variant="outline"
                  onClick={handleClassificaFornitore}
                  disabled={loading || !contoId}
                  title="Classifica questo fornitore con la classificazione selezionata"
                >
                  <CIcon icon={cilSettings} className="me-1" />
                  Classifica Fornitore
                </CButton>
              </CCol>
            )}
          </CRow>

          {/* Classificazione Bundle */}
          {selectedFornitore && (
            <CRow className="mb-3">
              <CCol md={4}>
                <label className="form-label">Conto</label>
                <SelectConto
                  value={contoId}
                  onChange={setContoId}
                  autoSelectIfSingle={true}
                />
              </CCol>
              <CCol md={4}>
                <label className="form-label">Branca</label>
                <SelectBranca
                  contoId={contoId}
                  value={brancaId}
                  onChange={setBrancaId}
                  autoSelectIfSingle={true}
                />
              </CCol>
              <CCol md={4}>
                <label className="form-label">Sottoconto</label>
                <SelectSottoconto
                  brancaId={brancaId}
                  value={sottocontoId}
                  onChange={setSottocontoId}
                  autoSelectIfSingle={true}
                />
              </CCol>
            </CRow>
          )}

          {/* Controlli ricerca e filtri */}
          {materiali.length > 0 && (
            <CRow className="mb-3">
              <CCol md={4}>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilSearch} />
                  </CInputGroupText>
                  <CFormInput
                    type="text"
                    placeholder="Cerca materiali..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </CInputGroup>
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
              <CCol md={6} className="d-flex justify-content-end align-items-center">
                {materialiFiltered.length > 0 && contoId && (
                  <CButton
                    color="success"
                    onClick={handleArchiviaClick}
                    disabled={loading}
                  >
                    <CIcon icon={cilSave} className="me-1" />
                    Archivia Bundle ({materialiFiltered.length} materiali)
                  </CButton>
                )}
              </CCol>
            </CRow>
          )}

          {/* Loading e errori */}
          {loading && (
            <div className="text-center p-4">
              <CSpinner color="primary" />
              <p className="mt-2 mb-0">Caricamento materiali...</p>
            </div>
          )}

          {error && (
            <CAlert color="danger" dismissible onClose={() => setError(null)}>
              {error}
            </CAlert>
          )}

          {/* Tabella materiali */}
          {!loading && materialiFiltered.length > 0 && (
            <>
              {/* Paginazione superiore */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <small className="text-muted">
                      Pagina {currentPage} di {totalPages} - {materialiFiltered.length} materiali
                      <CBadge color="info" className="ms-2">
                        {getCurrentPageMateriali().length} visualizzati
                      </CBadge>
                    </small>
                  </div>
                  {renderPagination()}
                </div>
              )}

              <CTable striped hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>REF</CTableHeaderCell>
                    <CTableHeaderCell
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('descrizione')}
                    >
                      Descrizione{' '}
                      {sortField === 'descrizione' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </CTableHeaderCell>
                    <CTableHeaderCell
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('prezzo_unitario')}
                    >
                      Prezzo Unit.{' '}
                      {sortField === 'prezzo_unitario' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </CTableHeaderCell>
                    <CTableHeaderCell>Quantità</CTableHeaderCell>
                    <CTableHeaderCell>Totale</CTableHeaderCell>
                    <CTableHeaderCell>Fattura</CTableHeaderCell>
                    <CTableHeaderCell
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('data_fattura')}
                    >
                      Data{' '}
                      {sortField === 'data_fattura' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </CTableHeaderCell>
                    <CTableHeaderCell>Suggerimento</CTableHeaderCell>
                    <CTableHeaderCell className="text-center">Azioni</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {getCurrentPageMateriali().map((materiale, index) => (
                    <CTableRow key={materiale.riga_fattura_id}>
                      <CTableDataCell>
                        <small className="text-muted">{materiale.codice_articolo || '-'}</small>
                      </CTableDataCell>
                      <CTableDataCell>{materiale.descrizione}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(materiale.prezzo_unitario)}</CTableDataCell>
                      <CTableDataCell>{materiale.quantita}</CTableDataCell>
                      <CTableDataCell>{formatCurrency(materiale.totale_riga)}</CTableDataCell>
                      <CTableDataCell>
                        <small className="text-muted">{materiale.fattura_id}</small>
                      </CTableDataCell>
                      <CTableDataCell>{formatDate(materiale.data_fattura)}</CTableDataCell>
                      <CTableDataCell>
                        {materiale.classificazione_suggerita && (
                          <div className="d-flex align-items-center gap-1">
                            {/* Badge Conto */}
                            {materiale.classificazione_suggerita.contoid && (
                              <CBadge color="primary" style={{ fontSize: '0.7rem' }}>
                                {contiStore.getContoById(materiale.classificazione_suggerita.contoid)?.nome?.substring(0, 8) || 'Conto'}
                              </CBadge>
                            )}
                            
                            {/* Badge Branca */}
                            {materiale.classificazione_suggerita.brancaid && (
                              <>
                                <span style={{ color: '#666', fontSize: '10px' }}>→</span>
                                <CBadge color="info" style={{ fontSize: '0.7rem' }}>
                                  {contiStore.getBrancaById(materiale.classificazione_suggerita.brancaid)?.substring(0, 8) || 'Branca'}
                                </CBadge>
                              </>
                            )}
                            
                            {/* Badge Sottoconto */}
                            {materiale.classificazione_suggerita.sottocontoid && (
                              <>
                                <span style={{ color: '#666', fontSize: '10px' }}>→</span>
                                <CBadge color="success" style={{ fontSize: '0.7rem' }}>
                                  {contiStore.getSottocontoById(materiale.classificazione_suggerita.sottocontoid)?.substring(0, 8) || 'Sottoconto'}
                                </CBadge>
                              </>
                            )}
                          </div>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-center">
                        <CButton
                          color="danger"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMateriale(materiale.riga_fattura_id)}
                          title="Rimuovi dalla lista"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              {/* Paginazione inferiore */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    <small className="text-muted">
                      Pagina {currentPage} di {totalPages} - {materialiFiltered.length} materiali
                    </small>
                  </div>
                  {renderPagination()}
                </div>
              )}
            </>
          )}

          {/* Messaggio nessun risultato */}
          {!loading && selectedFornitore && materiali.length === 0 && (
            <div className="text-center p-4">
              <p className="text-muted mb-0">Nessun materiale trovato per il fornitore selezionato</p>
            </div>
          )}

          {/* Messaggio iniziale */}
          {!selectedFornitore && (
            <div className="text-center p-4">
              <p className="text-muted mb-0">Seleziona un fornitore per iniziare la catalogazione</p>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Modal Conferma Archiviazione */}
      <CModal visible={showConfirmModal} onClose={() => setShowConfirmModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>Conferma Archiviazione Bundle</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <strong>Fornitore:</strong> {selectedFornitore?.nome}<br />
            <strong>Materiali da archiviare:</strong> {archivingMateriali.length}<br />
            <strong>Classificazione:</strong> {contiStore.getContoById(contoId || 0)?.nome || `Conto ID ${contoId}`}
            {brancaId && ` > ${contiStore.getBrancaById(brancaId) || `Branca ID ${brancaId}`}`}
            {sottocontoId && ` > ${contiStore.getSottocontoById(sottocontoId) || `Sottoconto ID ${sottocontoId}`}`}
          </div>
          <p>Confermi l'archiviazione di questi materiali con la classificazione selezionata?</p>
          <div className="bg-light p-3 rounded">
            <small className="text-muted">
              Tutti i materiali verranno salvati nella tabella materiali con la stessa classificazione contabile.
            </small>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowConfirmModal(false)}>
            Annulla
          </CButton>
          <CButton color="success" onClick={handleConfirmArchivia} disabled={loading}>
            {loading ? <CSpinner size="sm" className="me-1" /> : <CIcon icon={cilSave} className="me-1" />}
            Conferma Archiviazione
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default MaterialiBundlePage;