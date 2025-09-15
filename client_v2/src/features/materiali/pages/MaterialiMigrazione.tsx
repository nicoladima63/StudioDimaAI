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
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react';
import MaterialClassificationForm, { 
  type MaterialForClassification,
  type MaterialClassificationData
} from '@/components/forms/MaterialClassificationForm';
import {
  materialiMigrationService,
  type AnteprimaMigrazione,
  type FornitoreMigrazione,
  type RisultatoImportazione,
} from '../services/materiali-migration.service';
import { materialiClassificationService } from '../services/materiali-classification.service';
import { useFornitoriStore } from '@/store/fornitori.store';

const MaterialiMigrazione: React.FC = () => {
  const [anteprima, setAnteprima] = useState<AnteprimaMigrazione | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null); // Nome fornitore in importazione
  const [importResult, setImportResult] = useState<RisultatoImportazione | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFornitore, setSelectedFornitore] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [erroriImportazione, setErroriImportazione] = useState<Array<{descrizione: string, errore: string}>>([]);
  
  // State per modal classificazione
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialForClassification | null>(null);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  
  // Store fornitori
  const { fornitori, loadAllFornitori } = useFornitoriStore();

  const caricaAnteprima = async (fornitoreId?: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = fornitoreId 
        ? await materialiMigrationService.getSupplierPreview(fornitoreId)
        : await materialiMigrationService.getMigrationPreview();
      
      // 1. Controllo success - exit early se fallisce
      if (!response.success) {
        setError(response.error || "Errore nel caricamento dell'anteprima");
        return;
      }
      
      // 2. Controllo data - exit early se manca
      if (!response.data) {
        setError("Nessun dato ricevuto dal server");
        return;
      }
      
      // 3. Se è un fornitore specifico, controlla materiali
      if (fornitoreId) {
        const supplierData = response.data as FornitoreMigrazione;
        
        // 4. Controllo materiali - exit early se vuoti (processo completato)
        if (!supplierData.materiali || supplierData.materiali.length === 0) {
          const fornitoreNome = fornitori?.find(f => f.id === fornitoreId)?.nome || 'Fornitore';
          setSuccessMessage(`Processo completato per ${fornitoreNome}! Tutti i materiali sono stati importati.`);
          setAnteprima(null);
          return;
        }
        
        // 5. Tutto OK - mostra materiali
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
        // Anteprima generale
        setAnteprima(response.data as AnteprimaMigrazione);
      }
    } catch (err: any) {
      console.error('Errore caricamento anteprima:', err);
      setError(err.message || 'Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Funzioni per gestire il modal di classificazione
  const handleRowClick = (materiale: any, fornitore: FornitoreMigrazione) => {
    // Solo per materiali non ancora classificati (confidence < 100)
    if (materiale.confidence >= 100) {
      return; // Non aprire modal per materiali già classificati
    }

    const materialForClassification: MaterialForClassification = {
      codice_articolo: materiale.codice_prodotto || '',
      descrizione: materiale.nome,
      fornitore_id: materiale.fornitoreid,
      nome_fornitore: fornitore.fornitore_nome,
      fattura_id: materiale.fattura_id,
      data_fattura: materiale.data_fattura,
      costo_unitario: materiale.costo_unitario,
    };

    setSelectedMaterial(materialForClassification);
    setClassificationError(null);
    setShowClassificationModal(true);
  };

  const handleClassificationSave = (_materialId: number, classificationData: MaterialClassificationData) => {
    // Aggiorna l'anteprima per riflettere il cambiamento
    if (anteprima && selectedMaterial) {
      // Trova il materiale nell'anteprima e aggiorna il suo stato
      const updatedAnteprima = { ...anteprima };
      if (updatedAnteprima.suppliers) {
        updatedAnteprima.suppliers = updatedAnteprima.suppliers.map(supplier => {
          if (supplier.materiali) {
            supplier.materiali = supplier.materiali.map(material => {
              if (material.nome === selectedMaterial.descrizione && 
                  material.fornitoreid === selectedMaterial.fornitore_id) {
                return {
                  ...material,
                  confidence: 100, // Marca come classificato
                  confermato: true,
                  // Aggiorna anche i campi della classificazione
                  contoid: classificationData.contoid || 0,
                  contonome: classificationData.contonome || '',
                  brancaid: classificationData.brancaid || 0,
                  brancanome: classificationData.brancanome || '',
                  sottocontoid: classificationData.sottocontoid || 0,
                  sottocontonome: classificationData.sottocontonome || '',
                };
              }
              return material;
            });
          }
          return supplier;
        });
      }
      setAnteprima(updatedAnteprima);
    }
    
    setShowClassificationModal(false);
    setSelectedMaterial(null);
  };

  const handleClassificationError = (error: string) => {
    setClassificationError(error);
  };

  const handleCloseClassificationModal = () => {
    setShowClassificationModal(false);
    setSelectedMaterial(null);
    setClassificationError(null);
  };

  const importaFornitore = async (fornitoreNome: string) => {
    setImporting(fornitoreNome);
    setError(null);

    try {
      // Trova il fornitore nell'anteprima
      const fornitore = anteprima?.suppliers?.find(s => s.fornitore_nome === fornitoreNome);
      if (!fornitore) {
        throw new Error('Fornitore non trovato');
      }

      // Filtra solo i materiali con classificazione completa
      const materialiClassificati = fornitore.materiali?.filter(materiale => 
        materiale.contoid && materiale.brancaid && materiale.sottocontoid &&
        materiale.contonome && materiale.brancanome && materiale.sottocontonome
      ) || [];

      if (materialiClassificati.length === 0) {
        setError('Nessun materiale classificato trovato per questo fornitore');
        return;
      }

      // Prepara il payload per il bulk
      const payload = {
        materiali: materialiClassificati.map(materiale => ({
          codice_articolo: materiale.codice_prodotto || '',
          descrizione: materiale.nome,
          fornitore_id: materiale.fornitoreid,
          nome_fornitore: materiale.fornitorenome,
          contoid: materiale.contoid!,
          contonome: materiale.contonome!,
          brancaid: materiale.brancaid!,
          brancanome: materiale.brancanome!,
          sottocontoid: materiale.sottocontoid!,
          sottocontonome: materiale.sottocontonome!,
          fattura_id: materiale.fattura_id,
          data_fattura: materiale.data_fattura,
          costo_unitario: materiale.costo_unitario
        }))
      };

      const response = await materialiClassificationService.salvaClassificazioneBulk(payload);

      if (response.success && response.data) {
        // Crea un risultato compatibile con il modal esistente
        const result: RisultatoImportazione = {
          materials_imported: response.data.inseriti,
          materials_updated: response.data.aggiornati,
          materials_skipped: response.data.errori,
          total_processed: response.data.total_processed,
          supplier_name: fornitoreNome
        };
        
        setImportResult(result);
        setShowImportModal(true);
        
        // Rimuovi SOLO i materiali che sono stati salvati con successo
        if (anteprima && response.data.materiali_da_rimuovere.length > 0) {
          const materialiDaRimuovere = response.data.materiali_da_rimuovere;
          
          const updatedSuppliers = anteprima.suppliers.map(s => {
            if (s.fornitore_nome === fornitoreNome) {
              // Filtra i materiali rimuovendo solo quelli con successo
              const materialiRimanenti = s.materiali?.filter(materiale => {
                // Rimuovi solo se il materiale è stato salvato con successo
                const daRimuovere = materialiDaRimuovere.find(rm => 
                  rm.codice_articolo === materiale.codice_prodotto &&
                  rm.descrizione === materiale.nome &&
                  rm.fornitore_id === materiale.fornitoreid
                );
                return !daRimuovere; // Mantieni se NON è da rimuovere
              }) || [];
              
              return {
                ...s,
                materiali: materialiRimanenti,
                materiali_count: materialiRimanenti.length
              };
            }
            return s;
          });
          
          setAnteprima({
            ...anteprima,
            suppliers: updatedSuppliers,
            total_materials: updatedSuppliers.reduce((sum, s) => sum + s.materiali_count, 0),
            stats: {
              ...anteprima.stats,
              total_valid_materials: updatedSuppliers.reduce((sum, s) => sum + s.materiali_count, 0),
              dental_materials: updatedSuppliers.reduce((sum, s) => sum + s.materiali_count, 0)
            }
          });
        }
        
        // Salva errori specifici se ce ne sono
        const errori = response.data.risultati_dettagliati.filter(r => !r.successo);
        if (errori.length > 0) {
          const erroriFormattati = errori.map(e => ({
            descrizione: e.descrizione,
            errore: e.errore || 'Errore sconosciuto'
          }));
          setErroriImportazione(erroriFormattati);
        } else {
          setErroriImportazione([]);
        }
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


  // Filtra e ordina fornitori basato sul termine di ricerca
  const filteredFornitori = fornitori?.filter(fornitore => {
    if (!searchTerm.trim()) return false;
    
    const searchLower = searchTerm.toLowerCase().trim();
    const nomeLower = fornitore.nome.toLowerCase();
    const idLower = fornitore.id.toLowerCase();
    
    return nomeLower.includes(searchLower) || idLower.includes(searchLower);
  }).sort((a, b) => {
    const searchLower = searchTerm.toLowerCase().trim();
    const aNome = a.nome.toLowerCase();
    const bNome = b.nome.toLowerCase();
    const aId = a.id.toLowerCase();
    const bId = b.id.toLowerCase();
    
    // Punteggio per rilevanza
    const getScore = (nome: string, id: string) => {
      let score = 0;
      
      // Bonus massimo se inizia con il termine di ricerca
      if (nome.startsWith(searchLower)) score += 100;
      if (id.startsWith(searchLower)) score += 90;
      
      // Bonus se contiene il termine all'inizio di una parola
      const words = nome.split(' ');
      for (const word of words) {
        if (word.startsWith(searchLower)) {
          score += 50;
          break;
        }
      }
      
      // Bonus per lunghezza del match (più corto = più rilevante)
      const nomeMatch = nome.indexOf(searchLower);
      if (nomeMatch !== -1) {
        score += Math.max(0, 20 - nomeMatch);
      }
      
      return score;
    };
    
    const scoreA = getScore(aNome, aId);
    const scoreB = getScore(bNome, bId);
    
    // Ordina per punteggio decrescente, poi alfabeticamente
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    return aNome.localeCompare(bNome);
  }) || [];


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
        <CButton color='primary' onClick={() => caricaAnteprima()}>
          Riprova
        </CButton>
      </CAlert>
    );
  }

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
                    onFocus={() => {
                      setShowDropdown(true);
                      setSuccessMessage(null);
                    }}
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
              {successMessage ? (
                <CAlert color='warning' className='text-center'>
                  <h4 className='mb-4 mt-4'>{successMessage}</h4>
                </CAlert>
              ) : !anteprima ? (
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
              
              {/* Lista fornitori */}
              {anteprima.suppliers && anteprima.suppliers.length > 0 ? (
                <CAccordion>
                  {anteprima.suppliers.map((fornitore, index) => (
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
                          {(() => {
                            const classificati = fornitore.materiali?.filter(m => 
                              m.contoid && m.brancaid && m.sottocontoid
                            ).length || 0;
                            return classificati > 0 ? (
                              <CBadge color='success' className='me-2'>
                                {classificati} pronti per import
                              </CBadge>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </CAccordionHeader>
                    <CAccordionBody>
                      <div className='d-flex justify-content-end mb-3'>
                        <CButton
                          color='success'
                          size='sm'
                          onClick={() => importaFornitore(fornitore.fornitore_nome)}
                          disabled={importing === fornitore.fornitore_nome || 
                            (fornitore.materiali?.filter(m => m.contoid && m.brancaid && m.sottocontoid).length || 0) === 0}
                        >
                          {importing === fornitore.fornitore_nome ? (
                            <CSpinner size='sm' />
                          ) : (
                            `Importa Classificati (${fornitore.materiali?.filter(m => m.contoid && m.brancaid && m.sottocontoid).length || 0})`
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
                          {fornitore.materiali?.map((materiale, matIndex) => {
                            const isClassificato = materiale.contoid && materiale.brancaid && materiale.sottocontoid;
                            return (
                              <CTableRow 
                                key={matIndex} 
                                className={isClassificato ? 'table-success' : ''}
                                style={{ 
                                  cursor: materiale.confidence < 100 ? 'pointer' : 'default',
                                  opacity: materiale.confidence < 100 ? 1 : 0.8
                                }}
                                onClick={() => handleRowClick(materiale, fornitore)}
                              >
                                <CTableDataCell>
                                  {materiale.id}
                                  {isClassificato && <CBadge color='success' size='sm' className='ms-1'>✓</CBadge>}
                                </CTableDataCell>
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
                            );
                          })}
                        </CTableBody>
                      </CTable>
                    </CAccordionBody>
                  </CAccordionItem>
                ))}
                </CAccordion>
              ) : (
                <CAlert color='info' className='text-center'>
                  <h4>Seleziona un fornitore</h4>
                  <p className='mb-0'>Usa la ricerca qui sopra per selezionare un fornitore e visualizzare i suoi materiali.</p>
                </CAlert>
              )}
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
                  Materiali con errori: <strong>{importResult.materials_skipped}</strong>
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
              {erroriImportazione.length > 0 && (
                <div className="mt-3">
                  <h6 className="text-danger">Errori durante l'importazione:</h6>
                  <ul className="list-unstyled">
                    {erroriImportazione.map((errore, index) => (
                      <li key={index} className="text-danger small">
                        <strong>{errore.descrizione}:</strong> {errore.errore}
                      </li>
                    ))}
                  </ul>
                </div>
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

      {/* Modal per classificazione materiali */}
      <MaterialClassificationForm
        isOpen={showClassificationModal}
        onClose={handleCloseClassificationModal}
        material={selectedMaterial}
        onSave={handleClassificationSave}
        onError={handleClassificationError}
      />

      {/* Alert per errori di classificazione */}
      {classificationError && (
        <CAlert 
          color="danger" 
          className="position-fixed" 
          style={{ top: '20px', right: '20px', zIndex: 9999 }}
          onClose={() => setClassificationError(null)}
        >
          <strong>Errore classificazione:</strong> {classificationError}
        </CAlert>
      )}
    </div>
  );
};

export default MaterialiMigrazione;
