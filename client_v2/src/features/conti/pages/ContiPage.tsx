import React, { useState, useEffect } from 'react';
import { CAlert, CSpinner } from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import ContiTable from '../components/ContiTable';
import { 
  useContiStore, 
  useBranche, 
  useSottoconti,
  type Conto, 
  type Branca, 
  type Sottoconto 
} from '@/store/conti.store';

const ContiPage: React.FC = () => {
  // Stati locali per messaggi
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Utilizzo degli hook dello store
const { 
  conti, 
  isLoading, 
  errors: { conti: storeError }, 
  createConto, 
  updateConto, 
  deleteConto,
  operations: { creating: isCreating, updating: isUpdating, deleting: isDeleting }
} = useContiStore();  
  // Nota: Branche e Sottoconti vengono gestiti internamente da ContiTable
  // attraverso le props che passiamo

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