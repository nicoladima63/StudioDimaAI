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
  CModalFooter
} from '@coreui/react';
import { materialiMigrationService, type AnteprimaMigrazione, type FornitoreMigrazione, type MaterialeMigrazione, type RisultatoImportazione } from '../services/materiali-migration.service';

const MaterialiMigrazione: React.FC = () => {
  const [anteprima, setAnteprima] = useState<AnteprimaMigrazione | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null); // Nome fornitore in importazione
  const [importResult, setImportResult] = useState<RisultatoImportazione | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const caricaAnteprima = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await materialiMigrationService.getMigrationPreview();
      
      if (response.success && response.data) {
        setAnteprima(response.data);
      } else {
        setError(response.error || 'Errore nel caricamento dell\'anteprima');
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
        setError(response.error || 'Errore nell\'importazione');
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
        setError(response.error || 'Errore nell\'importazione');
      }
    } catch (err: any) {
      console.error('Errore importazione:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setImporting(null);
    }
  };

  useEffect(() => {
    caricaAnteprima();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
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
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <CSpinner color="primary" size="lg" />
        <span className="ms-3">Caricamento anteprima migrazione...</span>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="danger" className="m-3">
        <h4>Errore</h4>
        <p>{error}</p>
        <CButton color="primary" onClick={caricaAnteprima}>
          Riprova
        </CButton>
      </CAlert>
    );
  }

  if (!anteprima) {
    return (
      <CAlert color="info" className="m-3">
        <h4>Nessun dato disponibile</h4>
        <p>Non ci sono materiali disponibili per la migrazione.</p>
      </CAlert>
    );
  }

  return (
    <div className="container-fluid">
      <CRow>
        <CCol>
          <CCard>
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Migrazione Materiali Dentali</h4>
                <div>
                  <CButton 
                    color="success" 
                    onClick={importaTutti}
                    disabled={importing === 'TUTTI'}
                    className="me-2"
                  >
                    {importing === 'TUTTI' ? (
                      <>
                        <CSpinner size="sm" className="me-2" />
                        Importazione...
                      </>
                    ) : (
                      'Importa Tutti'
                    )}
                  </CButton>
                  <CButton color="primary" onClick={caricaAnteprima}>
                    Aggiorna
                  </CButton>
                </div>
              </div>
            </CCardHeader>
            <CCardBody>
              {/* Statistiche */}
              <CRow className="mb-4">
                <CCol md={3}>
                  <CCard className="text-center">
                    <CCardBody>
                      <h5 className="text-primary">{anteprima.stats.total_valid_materials}</h5>
                      <p className="text-muted mb-0">Materiali Totali</p>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className="text-center">
                    <CCardBody>
                      <h5 className="text-success">{anteprima.stats.dental_materials}</h5>
                      <p className="text-muted mb-0">Materiali Dentali</p>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className="text-center">
                    <CCardBody>
                      <h5 className="text-info">{anteprima.stats.suppliers_with_materials}</h5>
                      <p className="text-muted mb-0">Fornitori</p>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3}>
                  <CCard className="text-center">
                    <CCardBody>
                      <h5 className="text-warning">{anteprima.total_materials}</h5>
                      <p className="text-muted mb-0">Da Migrare</p>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>

              {/* Lista fornitori */}
              <h5>Fornitori con Materiali Dentali</h5>
              <CAccordion>
                {anteprima.suppliers.map((fornitore, index) => (
                  <CAccordionItem key={index} itemKey={index.toString()}>
                    <CAccordionHeader>
                      <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <div>
                          <strong>{fornitore.fornitore_nome}</strong>
                          <small className="text-muted ms-2">
                            ({fornitore.fornitore_originale})
                          </small>
                        </div>
                        <div className="d-flex align-items-center">
                          <CBadge color="info" className="me-2">
                            {fornitore.materiali_count} materiali
                          </CBadge>
                          <CButton
                            color="success"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              importaFornitore(fornitore.fornitore_nome);
                            }}
                            disabled={importing === fornitore.fornitore_nome}
                          >
                            {importing === fornitore.fornitore_nome ? (
                              <CSpinner size="sm" />
                            ) : (
                              'Importa'
                            )}
                          </CButton>
                        </div>
                      </div>
                    </CAccordionHeader>
                    <CAccordionBody>
                      <CTable hover responsive>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell>Materiale</CTableHeaderCell>
                            <CTableHeaderCell className="text-end">Prezzo</CTableHeaderCell>
                            <CTableHeaderCell className="text-end">Quantità</CTableHeaderCell>
                            <CTableHeaderCell>Categoria</CTableHeaderCell>
                            <CTableHeaderCell>Confidenza</CTableHeaderCell>
                            <CTableHeaderCell>Stato</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {fornitore.materiali.map((materiale, matIndex) => (
                            <CTableRow key={matIndex}>
                              <CTableDataCell>
                                <div>
                                  <strong>{materiale.nome}</strong>
                                  {materiale.id && (
                                    <small className="text-muted d-block">ID: {materiale.id}</small>
                                  )}
                                </div>
                              </CTableDataCell>
                              <CTableDataCell className="text-end">
                                {formatCurrency(materiale.costo_unitario)}
                              </CTableDataCell>
                              <CTableDataCell className="text-end">
                                {materiale.quantita}
                              </CTableDataCell>
                              <CTableDataCell>
                                <CBadge color="secondary">
                                  {materiale.categoria_contabile}
                                </CBadge>
                              </CTableDataCell>
                              <CTableDataCell>
                                <CBadge color={getConfidenceColor(materiale.confidence)}>
                                  {getConfidenceText(materiale.confidence)} ({materiale.confidence}%)
                                </CBadge>
                              </CTableDataCell>
                              <CTableDataCell>
                                {materiale.confermato ? (
                                  <CBadge color="success">Confermato</CBadge>
                                ) : (
                                  <CBadge color="warning">Da verificare</CBadge>
                                )}
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CAccordionBody>
                  </CAccordionItem>
                ))}
              </CAccordion>
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
              <p><strong>Risultati dell'importazione:</strong></p>
              <ul>
                <li>Materiali importati: <strong>{importResult.materials_imported}</strong></li>
                <li>Materiali aggiornati: <strong>{importResult.materials_updated}</strong></li>
                <li>Materiali saltati: <strong>{importResult.materials_skipped}</strong></li>
                <li>Totale processati: <strong>{importResult.total_processed}</strong></li>
              </ul>
              {importResult.supplier_name && (
                <p><strong>Fornitore:</strong> {importResult.supplier_name}</p>
              )}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={() => setShowImportModal(false)}>
            Chiudi
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default MaterialiMigrazione;
