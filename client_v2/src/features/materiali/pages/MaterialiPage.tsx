import React, { useMemo } from 'react';
import { CButton, CForm, CFormInput } from '@coreui/react';

import PageLayout from '@/components/layout/PageLayout';
import MaterialiTable from '@/features/materiali/components/MaterialiTable';
//import MaterialiAccordion from '@/features/materiali/components/MaterialiAccordion';
import FornitoriSelect from '@/components/selects/FornitoriSelect';
import { useMateriali, type Materiale } from '@/store/materiali.store';
import type { Fornitore } from '@/store/fornitori.store';

const MaterialiPage: React.FC = () => {
  const { materiali, isLoading, error, load } = useMateriali();
  const [selectedFornitore, setSelectedFornitore] = React.useState<Fornitore | null>(null);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [showResults, setShowResults] = React.useState<boolean>(false);
  const [searchSuggestions, setSearchSuggestions] = React.useState<Materiale[]>([]);

  // Carica materiali all'avvio - SEMPRE tutti i materiali per ricerca globale
  React.useEffect(() => {
    console.log('🚀 MaterialiPage: useEffect caricamento materiali attivato');
    console.log('🚀 MaterialiPage: load function:', typeof load);
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
      const suggestions = materiali
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
  }, [searchTerm, materiali]);

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
    console.log('Edit materiale:', materiale);
    // TODO: Aprire modal di modifica
  };

  const handleDelete = (materiale: Materiale) => {
    console.log('Delete materiale:', materiale);
    // TODO: Conferma eliminazione
  };

  const handleView = (materiale: Materiale) => {
    console.log('View materiale:', materiale);
    // TODO: Aprire modal dettagli
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
                  <CFormInput
                    type='text'
                    placeholder='Digita nome, codice o fornitore...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={handleSearchBlur}
                    className='mb-2'
                  />
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
                    {searchTerm && (
                      <CButton type='button' color='secondary' size='sm' onClick={handleSearchClear}>
                        Pulisci
                      </CButton>
                    )}
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
            onView={handleView}
            searchable={!selectedFornitore} // Disabilita ricerca interna quando c'è fornitore selezionato
          />
        )}
        {/* <MaterialiAccordion
          materiali={filteredMateriali}
          loading={isLoading}
          error={error}
        /> */}
      </PageLayout.ContentBody>

      <PageLayout.Footer text='Gestione completa dei materiali del magazzino' />
    </PageLayout>
  );
};

export default MaterialiPage;
