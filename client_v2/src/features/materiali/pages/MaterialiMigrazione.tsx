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
  CSpinner,
  CAlert,
  CBadge,
  CCol,
  CRow,
  CAccordion,
  CAccordionItem,
  CAccordionHeader,
  CAccordionBody,
  CProgress,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import {
  materialiMigrationService,
  type AnteprimaMigrazione,
  type FornitoreMigrazione,
  type MaterialeMigrazione,
  type RisultatoImportazione,
} from '../services/materiali-migration.service';
import { useFornitoriStore } from '@/store/fornitori.store';

const MaterialiMigrazione: React.FC = () => {
  const [anteprima, setAnteprima] = useState<AnteprimaMigrazione | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null); // Nome fornitore in importazione
  const [importResult, setImportResult] = useState<RisultatoImportazione | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFornitore, setSelectedFornitore] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  
  // Store fornitori
  const { fornitori, loadAllFornitori } = useFornitoriStore();

  const caricaAnteprima = async (fornitoreId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = fornitoreId 
        ? await materialiMigrationService.getSupplierPreview(fornitoreId)
        : await materialiMigrationService.getMigrationPreview();
      
      if (response.success && response.data) {
        if (fornitoreId) {
          // Se è un fornitore specifico, wrappa i dati nel formato AnteprimaMigrazione
          const supplierData = response.data as FornitoreMigrazione;
          setAnteprima({
            suppliers: [supplierData],
            total_suppliers: 1,
            total_materials: supplierData.materiali_count,
            stats: {
              total_valid_materials: supplierData.materiali_count,
              dental_materials: supplierData.materiali_count,
              suppliers_with_materials: 1
            }
          });
        } else {
          setAnteprima(response.data as AnteprimaMigrazione);
        }
      } else {
        setError(response.error || "Errore nel caricamento dell'anteprima");
      }
    } catch (err: any) {
      console.error('Errore caricamento anteprima:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const importaFornitore = async (fornitoreNome: string) => {
    setImporting(fornitoreNome);
    setError(null);

    try {
      const response = await materialiMigrationService.importSupplierMaterials(fornitoreNome);

      if (response.success && response.data) {
        setImportResult(response.data);
        setShowImportModal(true);
        // Ricarica anteprima per aggiornare i dati
        await caricaAnteprima();
      } else {
        setError(response.error || "Errore nell'importazione");
      }
    } catch (err: any) {
      console.error('Errore importazione:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setImporting(null);
    }
  };

  const importaTutti = async () => {
    setImporting('TUTTI');
    setError(null);

    try {
      const response = await materialiMigrationService.importAllMaterials();

      if (response.success && response.data) {
        setImportResult(response.data);
        setShowImportModal(true);
        // Ricarica anteprima per aggiornare i dati
        await caricaAnteprima();
      } else {
        setError(response.error || "Errore nell'importazione");
      }
    } catch (err: any) {
      console.error('Errore importazione:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setImporting(null);
    }
  };

  useEffect(() => {
    loadAllFornitori();
  }, [loadAllFornitori]);

  const handleFornitoreChange = (fornitoreId: string) => {
    setSelectedFornitore(fornitoreId);
    setSearchTerm('');
    setShowDropdown(false);
    if (fornitoreId) {
      caricaAnteprima(fornitoreId);
    } else {
      setAnteprima(null);
    }
  };

  // Filtra fornitori basato sul termine di ricerca
  const filteredFornitori = fornitori?.filter(fornitore => 
    fornitore.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fornitore.id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleFornitoreSelect = (fornitore: any) => {
    setSelectedFornitore(fornitore.id);
    setSearchTerm(fornitore.nome);
    setShowDropdown(false);
    caricaAnteprima(fornitore.id);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'danger';
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 80) return 'Alta';
    if (confidence >= 60) return 'Media';
    return 'Bassa';
  };

  if (loading) {
    return (
      <div
        className='d-flex justify-content-center align-items-center'
        style={{ minHeight: '400px' }}
      >
        <CSpinner color='primary' size='sm' />
        <span className='ms-3'>Caricamento anteprima migrazione...</span>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color='danger' className='m-3'>
        <h4>Errore</h4>
        <p>{error}</p>
        <CButton color='primary' onClick={caricaAnteprima}>
          Riprova
        </CButton>
      </CAlert>
    );
  }

  // Non mostrare più l'alert, la select sarà sempre visibile

  return (
    <div className='container-fluid'>
      <CRow>
        <CCol>
          <CCard>
            <CCardHeader>
              <div className='d-flex justify-content-between align-items-center'>
                <h4 className='mb-0'>Migrazione Materiali Dentali</h4>
                <div>
                  <CButton
                    color='success'
                    onClick={importaTutti}
                    disabled={importing === 'TUTTI'}
                    className='me-2'
                  >
                    {importing === 'TUTTI' ? (
                      <>
                        <CSpinner size='sm' className='me-2' />
                        Importazione...
                      </>
                    ) : (
                      'Importa Tutti'
                    )}
                  </CButton>
                  <CButton color='primary' onClick={() => caricaAnteprima()}>
                    Aggiorna
                  </CButton>
                </div>
              </div>
              
              {/* Ricerca Fornitore */}
              <div className='mt-3'>
                <label className='form-label'>Cerca Fornitore:</label>
                <div className='position-relative'>
                  <input
                    type='text'
                    className='form-control'
                    placeholder='Digita il nome o codice fornitore...'
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  />
                  
                  {/* Dropdown risultati */}
                  {showDropdown && searchTerm && (
                    <div className='position-absolute w-100 bg-white border rounded shadow-lg' style={{zIndex: 1000, maxHeight: '200px', overflowY: 'auto'}}>
                      {filteredFornitori.length > 0 ? (
                        filteredFornitori.map((fornitore) => (
                          <div
                            key={fornitore.id}
                            className='p-2 border-bottom cursor-pointer hover-bg-light'
                            onClick={() => handleFornitoreSelect(fornitore)}
                            style={{cursor: 'pointer'}}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div className='fw-bold'>{fornitore.nome}</div>
                            <small className='text-muted'>{fornitore.id}</small>
                          </div>
                        ))
                      ) : (
                        <div className='p-2 text-muted'>Nessun fornitore trovato</div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Fornitore selezionato */}
                {selectedFornitore && (
                  <div className='mt-2'>
                    <CBadge color='success' className='me-2'>
                      ✓ Fornitore selezionato
                    </CBadge>
                    <CButton
                      color='outline-secondary'
                      size='sm'
                      onClick={() => {
                        setSelectedFornitore('');
                        setSearchTerm('');
                        setAnteprima(null);
                      }}
                    >
                      Rimuovi selezione
                    </CButton>
                  </div>
                )}
              </div>
            </CCardHeader>
            <CCardBody>
              {!anteprima ? (
                <CAlert color='info'>
                  <h4>Seleziona un fornitore</h4>
                  <p>Usa la select qui sopra per selezionare un fornitore e visualizzare i suoi materiali.</p>
                </CAlert>
              ) : (
                <>
                  {/* Statistiche */}
                  <CRow className='mb-4'>
                    <CCol md={3}>
                      <CCard className='text-center'>
                        <CCardBody>
                          <h5 className='text-primary'>{anteprima.stats.total_valid_materials}</h5>
                          <p className='text-muted mb-0'>Materiali Totali</p>
                        </CCardBody>
                      </CCard>
                    </CCol>
                    <CCol md={3}>
                      <CCard className='text-center'>
                        <CCardBody>
                          <h5 className='text-success'>{anteprima.stats.dental_materials}</h5>
                          <p className='text-muted mb-0'>Materiali Dentali</p>
                        </CCardBody>
                      </CCard>
                    </CCol>
                    <CCol md={3}>
                      <CCard className='text-center'>
                        <CCardBody>
                          <h5 className='text-info'>{anteprima.stats.suppliers_with_materials}</h5>
                          <p className='text-muted mb-0'>Fornitori</p>
                        </CCardBody>
                      </CCard>
                    </CCol>
                    <CCol md={3}>
                      <CCard className='text-center'>
                        <CCardBody>
                          <h5 className='text-warning'>{anteprima.total_materials}</h5>
                          <p className='text-muted mb-0'>Da Migrare</p>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>

              {/* Lista fornitori */}
              <h5>Fornitori con Materiali Dentali</h5>
              <CAccordion>
                {anteprima.suppliers?.map((fornitore, index) => (
                  <CAccordionItem key={index} itemKey={index.toString()}>
                    <CAccordionHeader>
                      <div className='d-flex justify-content-between align-items-center w-100 me-3'>
                        <div>
                          <strong>{fornitore.fornitore_nome}</strong>
                          <small className='text-muted ms-2'>
                            ({fornitore.fornitore_originale})
                          </small>
                        </div>
                        <div className='d-flex align-items-center'>
                          <CBadge color='info' className='me-2'>
                            {fornitore.materiali_count} materiali
                          </CBadge>
                        </div>
                      </div>
                    </CAccordionHeader>
                    <CAccordionBody>
                      <div className='d-flex justify-content-end mb-3'>
                        <CButton
                          color='success'
                          size='sm'
                          onClick={() => importaFornitore(fornitore.fornitore_nome)}
                          disabled={importing === fornitore.fornitore_nome}
                        >
                          {importing === fornitore.fornitore_nome ? (
                            <CSpinner size='sm' />
                          ) : (
                            'Importa'
                          )}
                        </CButton>
                      </div>
                      <CTable hover responsive>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell>ID</CTableHeaderCell>
                            <CTableHeaderCell>Codice Articolo</CTableHeaderCell>
                            <CTableHeaderCell>Nome</CTableHeaderCell>
                            <CTableHeaderCell>Fornitore ID</CTableHeaderCell>
                            <CTableHeaderCell>Fornitore Nome</CTableHeaderCell>
                            <CTableHeaderCell>Conto ID</CTableHeaderCell>
                            <CTableHeaderCell>Conto Nome</CTableHeaderCell>
                            <CTableHeaderCell>Branca ID</CTableHeaderCell>
                            <CTableHeaderCell>Branca Nome</CTableHeaderCell>
                            <CTableHeaderCell>Sottoconto ID</CTableHeaderCell>
                            <CTableHeaderCell>Sottoconto Nome</CTableHeaderCell>
                            <CTableHeaderCell>Data Fattura</CTableHeaderCell>
                            <CTableHeaderCell>Costo Unitario</CTableHeaderCell>
                            <CTableHeaderCell>Fattura ID</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {fornitore.materiali?.map((materiale, matIndex) => (
                            <CTableRow key={matIndex}>
                              <CTableDataCell>{materiale.id}</CTableDataCell>
                              <CTableDataCell>{materiale.codice_prodotto}</CTableDataCell>
                              <CTableDataCell>{materiale.nome}</CTableDataCell>
                              <CTableDataCell>{materiale.fornitoreid}</CTableDataCell>
                              <CTableDataCell>{materiale.fornitorenome}</CTableDataCell>
                              <CTableDataCell>{materiale.contoid || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.contonome || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.brancaid || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.brancanome || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.sottocontoid || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.sottocontonome || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.data_fattura || ''}</CTableDataCell>
                              <CTableDataCell>{materiale.costo_unitario}</CTableDataCell>
                              <CTableDataCell>{materiale.fattura_id || ''}</CTableDataCell>
                              </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CAccordionBody>
                  </CAccordionItem>
                ))}
              </CAccordion>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Modal risultato importazione */}
      <CModal visible={showImportModal} onClose={() => setShowImportModal(false)}>
        <CModalHeader>
          <CModalTitle>Importazione Completata</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {importResult && (
            <div>
              <p>
                <strong>Risultati dell'importazione:</strong>
              </p>
              <ul>
                <li>
                  Materiali importati: <strong>{importResult.materials_imported}</strong>
                </li>
                <li>
                  Materiali aggiornati: <strong>{importResult.materials_updated}</strong>
                </li>
                <li>
                  Materiali saltati: <strong>{importResult.materials_skipped}</strong>
                </li>
                <li>
                  Totale processati: <strong>{importResult.total_processed}</strong>
                </li>
              </ul>
              {importResult.supplier_name && (
                <p>
                  <strong>Fornitore:</strong> {importResult.supplier_name}
                </p>
              )}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='primary' onClick={() => setShowImportModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default MaterialiMigrazione;
