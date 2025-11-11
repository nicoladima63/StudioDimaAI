import React, { useState, useEffect, useMemo } from 'react';
import { CAlert, CSpinner, CFormInput, CCard, CCardBody, CCardHeader } from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import ContiTable from '../components/ContiTable';
import { 
  useContiStore, 
  type Conto, 
  type Branca, 
  type Sottoconto, 
  type SearchResult
} from '@/store/conti.store';

const ContiPage: React.FC = () => {
  // Stati locali per messaggi
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // State per la ricerca
  const [searchTerm, setSearchTerm] = useState('');

  // Utilizzo degli hook dello store
  const { 
    conti, 
    isLoading, 
    errors: { conti: storeError }, 
    loadConti,
    loadBranche,
    loadSottoconti,
    getFlatData,
    createConto, 
    updateConto, 
    deleteConto,
    operations: { creating: isCreating, updating: isUpdating, deleting: isDeleting }
  } = useContiStore();

  // Caricamento iniziale di tutti i dati per la ricerca
  useEffect(() => {
    const fetchAllData = async () => {
      await loadConti({ force: false });
    };
    fetchAllData();
  }, [loadConti]);

  useEffect(() => {
    if (conti.length > 0) {
      conti.forEach(conto => {
        loadBranche(conto.id, { force: false });
      });
    }
  }, [conti, loadBranche]);

  useEffect(() => {
    const allBranche = Object.values(useContiStore.getState().brancheByConto).flat();
    if (allBranche.length > 0) {
      allBranche.forEach(branca => {
        loadSottoconti(branca.id, { force: false });
      });
    }
  }, [conti, loadSottoconti]); // Depend on conti to re-trigger when conti are loaded


  // Logica di ricerca
  const searchResults = useMemo(() => {
    if (searchTerm.trim() === '') {
      return [];
    }
    const flatData = getFlatData();
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return flatData.filter(item => 
      item.nome.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.path.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [searchTerm, getFlatData]);


  useEffect(() => {
    if (storeError) {
      setError(storeError);
    }
  }, [storeError]);

  // CRUD funzioni per conti - ORA USA LO STORE
  const handleAddConto = async (newItem: Partial<Conto>) => {
    try {
      await createConto(newItem as Omit<Conto, 'id'>);
      setSuccess('Conto creato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore creazione conto');
    }
  };

  const handleEditConto = async (updated: Conto) => {
    try {
      await updateConto(updated.id, { nome: updated.nome });
      setSuccess('Conto aggiornato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore modifica conto');
    }
  };

  const handleDeleteConto = async (item: Conto) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo conto?')) return;
    
    try {
      await deleteConto(item.id);
      setSuccess('Conto eliminato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione conto');
    }
  };

  // Store hooks per CRUD operations
  const { createBranca, updateBranca, deleteBranca } = useContiStore();
  const { createSottoconto, updateSottoconto, deleteSottoconto } = useContiStore();

  // CRUD funzioni per branche
  const addBranca = async (newItem: Partial<Branca>) => {
    try {
      await createBranca(newItem as Omit<Branca, 'id'>);
      setSuccess('Branca creata con successo');
    } catch (err: any) {
      setError(err.message || 'Errore creazione branca');
    }
  };

  const editBranca = async (updated: Branca) => {
    try {
      await updateBranca(updated.id, { nome: updated.nome, contoId: updated.contoId });
      setSuccess('Branca aggiornata con successo');
    } catch (err: any) {
      setError(err.message || 'Errore modifica branca');
    }
  };

  const handleDeleteBranca = async (item: Branca) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa branca?')) return;
    
    try {
      await deleteBranca(item.id);
      setSuccess('Branca eliminata con successo');
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione branca');
    }
  };

  // CRUD funzioni per sottoconti
  const addSottoconto = async (newItem: Partial<Sottoconto>) => {
    try {
      await createSottoconto(newItem as Omit<Sottoconto, 'id'>);
      setSuccess('Sottoconto creato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore creazione sottoconto');
    }
  };

  const editSottoconto = async (updated: Sottoconto) => {
    try {
      await updateSottoconto(updated.id, { 
        nome: updated.nome, 
        brancaId: updated.brancaId,
        contoId: updated.contoId
      });
      setSuccess('Sottoconto aggiornato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore modifica sottoconto');
    }
  };

  const handleDeleteSottoconto = async (item: Sottoconto) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo sottoconto?')) return;
    
    try {
      await deleteSottoconto(item.id);
      setSuccess('Sottoconto eliminato con successo');
    } catch (err: any) {
      setError(err.message || 'Errore eliminazione sottoconto');
    }
  };

  // Calcola il loading state combinato
  const combinedLoading = isLoading || isCreating || Object.values(isUpdating).some(Boolean) || Object.values(isDeleting).some(Boolean);

  return (
    <PageLayout>
      <PageLayout.Header title='Gestione Struttura Conti' />

      <PageLayout.Content>
        {error && (
          <CAlert color='danger' dismissible onClose={() => setError('')}>
            {error}
          </CAlert>
        )}

        {success && (
          <CAlert color='success' dismissible onClose={() => setSuccess('')}>
            {success}
          </CAlert>
        )}

        {combinedLoading && (
          <div className='text-center p-3'>
            <CSpinner color='primary' />
          </div>
        )}

        <CCard className="mb-4">
          <CCardHeader>
            <strong>Ricerca Globale</strong>
          </CCardHeader>
          <CCardBody>
            <CFormInput
              type="text"
              placeholder="Cerca per nome o percorso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && searchResults.length > 0 && (
              <div className="mt-3">
                <h5>Risultati della ricerca:</h5>
                <ul className="list-group">
                  {searchResults.map(item => (
                    <li key={`${item.type}-${item.id}`} className="list-group-item">
                      <strong>{item.nome}</strong>
                      <div className="text-muted small">{item.path}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {searchTerm && searchResults.length === 0 && (
              <div className="mt-3 text-muted">
                Nessun risultato trovato.
              </div>
            )}
          </CCardBody>
        </CCard>

        <div className='p-3'>
          <ContiTable
            conti={conti}
            onAdd={handleAddConto}
            onEdit={handleEditConto}
            onDelete={handleDeleteConto}
            onAddBranca={addBranca}
            onEditBranca={editBranca}
            onDeleteBranca={handleDeleteBranca}
            onAddSottoconto={addSottoconto}
            onEditSottoconto={editSottoconto}
            onDeleteSottoconto={handleDeleteSottoconto}
          />
        </div>
      </PageLayout.Content>
    </PageLayout>
  );
};

export default ContiPage;