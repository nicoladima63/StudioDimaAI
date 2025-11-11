import React, { useMemo, useState } from 'react';
import { CButton, CForm, CFormInput } from '@coreui/react';
import toast from 'react-hot-toast';

import PageLayout from '@/components/layout/PageLayout';
import MaterialiTable from '@/features/materiali/components/MaterialiTable';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import { useMateriali, type Materiale } from '@/store/materiali.store';
import type { Fornitore } from '@/store/fornitori.store';
import ClassificazioneMaterialeModal, { type ClassificazioneData } from '@/features/materiali/components/ClassificazioneMaterialeModal';
import ModalFatturaDetail from '@/components/modals/ModalFatturaDetail';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { fatturaService } from '@/services/api/fattura.service';

const MaterialiPage: React.FC = () => {
  const { materiali, isLoading, error, load, deleteMateriale, updateMateriale, updateMaterialeConti } = useMateriali();
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Materiale[]>([]);

  // State per il modale di modifica
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingMateriale, setEditingMateriale] = useState<Materiale | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State per il modale dettagli fattura
  const [isFatturaModalVisible, setIsFatturaModalVisible] = useState(false);
  const [selectedFatturaId, setSelectedFatturaId] = useState<string | null>(null);
  const [selectedMaterialeId, setSelectedMaterialeId] = useState<number | null>(null);

  //state per il modale delete materiale
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [materialeToDelete, setMaterialeToDelete] = useState<Materiale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carica materiali all'avvio - SEMPRE tutti i materiali per ricerca globale
  React.useEffect(() => {
    load(); // Carica sempre tutti i materiali
  }, [load]);

  // Reset ricerca quando cambia fornitore (senza chiamare il server)
  React.useEffect(() => {
    // Solo se c'è un fornitore selezionato, resetta la ricerca
    if (selectedFornitore) {
      setSearchTerm('');
      setShowResults(false);
      setSearchSuggestions([]);
    }
  }, [selectedFornitore]);

  // Genera suggerimenti di ricerca mentre l'utente digita
  React.useEffect(() => {
    if (searchTerm.length >= 2) {
      const baseMateriali = selectedFornitore
        ? materiali.filter(m => m.fornitoreid === selectedFornitore.id)
        : materiali;

      const suggestions = baseMateriali
        .filter(materiale => {
          const searchLower = searchTerm.toLowerCase();
          return materiale.nome.toLowerCase().includes(searchLower) ||
                 (materiale.codicearticolo && materiale.codicearticolo.toLowerCase().includes(searchLower)) ||
                 materiale.fornitorenome.toLowerCase().includes(searchLower);
        })
        .slice(0, 10); // Massimo 10 suggerimenti
      setSearchSuggestions(suggestions);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchTerm, materiali, selectedFornitore]);

  // Filtra materiali in base al fornitore selezionato e ricerca
  const filteredMateriali = useMemo(() => {
    let baseMateriali = selectedFornitore 
      ? materiali.filter(materiale => materiale.fornitoreid === selectedFornitore.id)
      : materiali;
    
    // Debug: log del filtro per fornitore
    if (selectedFornitore) {
      console.log(`Filtro per fornitore ${selectedFornitore.nome} (ID: ${selectedFornitore.id}):`);
      console.log(`- Materiali totali: ${materiali.length}`);
      console.log(`- Materiali filtrati: ${baseMateriali.length}`);
      
      // Mostra tutti gli ID fornitore unici per debug
      const fornitoreIds = [...new Set(materiali.map(m => m.fornitoreid))];
      console.log(`- ID fornitori disponibili:`, fornitoreIds.slice(0, 10));
      
      if (baseMateriali.length === 0) {
        console.log(`❌ Nessun materiale trovato per ${selectedFornitore.id}`);
        console.log(`- Cercando materiali con fornitoreid === "${selectedFornitore.id}"`);
        const materialiConStessoId = materiali.filter(m => m.fornitoreid === selectedFornitore.id);
        console.log(`- Materiali con ID esatto: ${materialiConStessoId.length}`);
      } else {
        console.log(`✅ Primi 3 materiali:`, baseMateriali.slice(0, 3).map(m => ({ nome: m.nome, fornitoreid: m.fornitoreid, fornitorenome: m.fornitorenome })));
      }
    }
    
    // Se c'è una ricerca attiva, filtra per il termine di ricerca
    if (showResults && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      baseMateriali = baseMateriali.filter(materiale => {
        return materiale.nome.toLowerCase().includes(searchLower) ||
               (materiale.codicearticolo && materiale.codicearticolo.toLowerCase().includes(searchLower)) ||
               materiale.fornitorenome.toLowerCase().includes(searchLower);
      });
    }
    
    return baseMateriali;
  }, [materiali, selectedFornitore, showResults, searchTerm]);

  // Gestori ricerca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setShowResults(true);
      setSearchSuggestions([]); // Chiudi i suggerimenti dopo la ricerca
    }
  };

  const handleSearchClear = () => {
    setSearchTerm('');
    setShowResults(false);
    setSearchSuggestions([]);
  };

  const handleSuggestionClick = (materiale: Materiale) => {
    setSearchTerm(materiale.nome);
    setShowResults(true);
    setSearchSuggestions([]);
  };

  // Chiudi suggerimenti quando si clicca fuori
  const handleSearchBlur = () => {
    // Delay per permettere il click sui suggerimenti
    setTimeout(() => {
      setSearchSuggestions([]);
    }, 200);
  };

  // Gestori azioni tabella
  const handleEdit = (materiale: Materiale) => {
    setEditingMateriale(materiale);
    setIsEditModalVisible(true);
  };

  const handleDelete = (materiale: Materiale) => {
    setMaterialeToDelete(materiale);
    setIsDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!materialeToDelete) return;

    setIsDeleting(true);
    try {
      await deleteMateriale(materialeToDelete.id);
      toast.success(`Materiale "${materialeToDelete.nome}" eliminato con successo.`);
      setIsDeleteModalVisible(false);
      setMaterialeToDelete(null);
    } catch (error) {
      toast.error("Errore durante l'eliminazione del materiale.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewFattura = (materiale: Materiale) => {
    if (materiale.fattura_id) {
      setSelectedFatturaId(materiale.fattura_id);
      setSelectedMaterialeId(materiale.id);
      setIsFatturaModalVisible(true);
    } else {
      toast.error('Nessuna fattura associata a questo materiale.');
    }
  };

  const handleSaveClassification = async (data: ClassificazioneData) => {
    if (!editingMateriale) return;

    setIsSaving(true);
    try {
      await updateMaterialeConti(editingMateriale.id, data);
      toast.success(`Classificazione di "${editingMateriale.nome}" aggiornata.`);
      setIsEditModalVisible(false);
      setEditingMateriale(null);
    } catch (error) {
      toast.error("Errore durante l'aggiornamento della classificazione.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout>
      <PageLayout.Header
        title='Gestione Materiali'
        headerAction={
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={() => load(true)} disabled={isLoading}>
              {isLoading ? 'Caricamento...' : 'Aggiorna'}
            </CButton>
          </div>
        }
      />

      <PageLayout.ContentHeader>
        <div className='row'>
          <div className='col-md-10'>
            <h5 className='mb-3'>Filtri e Ricerca</h5>
            <div className='row g-3'>
              <div className='col-md-6'>
                <label className='form-label fw-bold'>Fornitore</label>
                <FornitoriSelect
                  value={selectedFornitore?.id || null}
                  onChange={fornitore => setSelectedFornitore(fornitore)}
                  placeholder='-- Tutti i fornitori --'
                  searchable={true}
                  clearable={true}
                />
              </div>
              <div className='col-md-6'>
                <label className='form-label fw-bold'>Ricerca Materiali</label>
                <CForm onSubmit={handleSearchSubmit} className='position-relative'>
                  <div className='position-relative'>
                    <CFormInput
                      type='text'
                      placeholder='Digita nome, codice o fornitore...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onBlur={handleSearchBlur}
                      className='mb-2'
                    />
                    {searchTerm && (
                        <button
                          type='button'
                          onClick={handleSearchClear}
                          aria-label='Pulisci ricerca'
                          className='btn position-absolute'
                          style={{
                            top: '50%',
                            right: '5px',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#6c757d',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                            padding: '0 .75rem',
                            zIndex: 5,
                          }}
                        >
                          &times;
                        </button>
                    )}
                  </div>
                  {searchSuggestions.length > 0 && !showResults && (
                    <div className='position-absolute w-100 bg-white border rounded shadow-lg' style={{zIndex: 1000, top: '100%'}}>
                      {searchSuggestions.map((materiale, index) => (
                        <div
                          key={index}
                          className='p-2 border-bottom cursor-pointer hover-bg-light'
                          onClick={() => handleSuggestionClick(materiale)}
                          style={{cursor: 'pointer'}}
                        >
                          <div className='fw-bold'>{materiale.nome}</div>
                          <div className='small text-muted'>
                            {materiale.codicearticolo && `Cod: ${materiale.codicearticolo} • `}
                            {materiale.fornitorenome}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className='d-flex gap-2'>
                    <CButton type='submit' color='primary' size='sm'>
                      Cerca
                    </CButton>
                  </div>
                </CForm>
                <div className='text-muted small mt-1'>
                  {selectedFornitore 
                    ? `Cerca tra i materiali di ${selectedFornitore.nome}`
                    : 'Cerca tra tutti i 621 materiali - premi INVIO per vedere i risultati'
                  }
                </div>
              </div>
            </div>
          </div>
          <div className='col-md-2'>
            <h5 className='mb-3'>Fornitore selezionato</h5>
            {selectedFornitore && (
              <div className='col-12'>
                <div className='text-muted'>
                  <strong>{selectedFornitore.nome}</strong>
                </div>
              </div>
            )}

            <div className='row g-2'>
              <div className='col-12'>
                <div className='d-flex justify-content-between text-muted'>
                  <strong>Materiali:</strong>
                    {selectedFornitore 
                      ? `${filteredMateriali.length} di ${selectedFornitore.nome}`
                      : `${materiali.length} totali (ricerca globale)`
                    }
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        {!showResults && !selectedFornitore ? (
          <div className='text-center py-5'>
            <h5 className='text-muted'>Benvenuto nella ricerca materiali</h5>
            <p className='text-muted'>
              Digita nel campo di ricerca per trovare materiali specifici o seleziona un fornitore per vedere i suoi materiali.
            </p>
            <p className='text-muted'>
              <strong>621 materiali</strong> disponibili per la ricerca globale.
            </p>
          </div>
        ) : filteredMateriali.length === 0 ? (
          <div className='text-center py-5'>
            <h5 className='text-muted'>Nessun risultato trovato</h5>
            <p className='text-muted'>
              {selectedFornitore 
                ? `Nessun materiale trovato per "${selectedFornitore.nome}"`
                : searchTerm 
                  ? `Nessun materiale trovato per "${searchTerm}"`
                  : 'Nessun materiale disponibile'
              }
            </p>
          </div>
        ) : (
          <MaterialiTable
            materiali={filteredMateriali}
            loading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleViewFattura}
            searchable={!selectedFornitore} // Disabilita ricerca interna quando c'è fornitore selezionato
          />
        )}
      </PageLayout.ContentBody>

      <PageLayout.Footer text='Gestione completa dei materiali del magazzino' />

      {/* Modale per la modifica della classificazione */}
      <ClassificazioneMaterialeModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        materiale={editingMateriale}
        onSave={handleSaveClassification}
        loading={isSaving}
      />

      {/* Modale per i dettagli della fattura */}
      <ModalFatturaDetail
        visible={isFatturaModalVisible}
        onClose={() => {
          setIsFatturaModalVisible(false);
          setSelectedMaterialeId(null);
        }}
        fatturaId={selectedFatturaId}
        materialeId={selectedMaterialeId}
        onFetchFatturaCompleta={(id) => fatturaService.getFatturaCompleta(id)}
      />
      {/* Modale per la delete materiale */}
      <ConfirmDeleteModal
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title='Conferma Cancellazione'
        itemName={materialeToDelete?.nome || ''}
        itemType='il materiale selezionato?'
        warning='Questa azione è irreversibile.'
        details={[{ label: 'ID', value: materialeToDelete?.id.toString() || '' }]}
        loading={isDeleting}
        error={error}
      />
    </PageLayout>
  );
};

export default MaterialiPage;
