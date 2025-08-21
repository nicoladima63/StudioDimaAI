import { useState } from 'react';
import { CampoAnagrafica, FatturaBase, DettaglioFatturaBase, FatturaDetail, DettaglioRigaFattura } from '@/components/modals';
import type { Fornitore } from '@/store/fornitori.store';
import apiClient from '@/services/api/client';

export const useFornitoreModals = () => {
  // Stati per le 3 modal
  const [anagraficaModalVisible, setAnagraficaModalVisible] = useState(false);
  const [fattureElencoModalVisible, setFattureElencoModalVisible] = useState(false);
  const [fatturaDetailModalVisible, setFatturaDetailModalVisible] = useState(false);
  
  // Dati selezionati
  const [selectedFornitore, setSelectedFornitore] = useState<Fornitore | null>(null);
  const [selectedFatturaId, setSelectedFatturaId] = useState<string | null>(null);

  // Configurazione campi anagrafica per ModalAnagrafica
  const getCampiAnagrafica = (fornitore: Fornitore): CampoAnagrafica[] => [
    { key: 'id', label: 'ID Fornitore', value: fornitore.id, colSize: 6 },
    { key: 'nome', label: 'Nome Fornitore', value: fornitore.nome, colSize: 6 },
    { key: 'codice', label: 'Codice', value: fornitore.codice, colSize: 6 },
    { key: 'partita_iva', label: 'Partita IVA', value: fornitore.partita_iva, colSize: 6 },
    { key: 'codice_fiscale', label: 'Codice Fiscale', value: fornitore.codice_fiscale, colSize: 6 },
    { key: 'indirizzo', label: 'Indirizzo', value: fornitore.indirizzo, colSize: 12 },
    { key: 'citta', label: 'Città', value: fornitore.citta, colSize: 4 },
    { key: 'provincia', label: 'Provincia', value: fornitore.provincia, colSize: 4 },
    { key: 'cap', label: 'CAP', value: fornitore.cap, colSize: 4 },
    { key: 'telefono', label: 'Telefono', value: fornitore.telefono, type: 'tel', colSize: 6 },
    { key: 'email', label: 'Email', value: fornitore.email, type: 'email', colSize: 6 },
    { key: 'sito_web', label: 'Sito Web', value: fornitore.sito_web, colSize: 12 },
    {
      key: 'classificazione',
      label: 'Stato Classificazione',
      value: fornitore.classificazione?.is_classificato
        ? (fornitore.classificazione?.is_completo ? 'Completo' : 'Parziale')
        : 'Non classificato',
      type: 'badge',
      badgeColor: fornitore.classificazione?.is_classificato
        ? (fornitore.classificazione?.is_completo ? 'success' : 'warning')
        : 'danger',
      colSize: 6
    },
    { 
      key: 'note', 
      label: 'Note', 
      value: fornitore.note || 'Nessuna nota', 
      type: 'textarea', 
      colSize: 12 
    }
  ];

  // API calls per fatture fornitore
  const fetchFattureFornitore = async (
    fornitoreId: string, 
    page: number, 
    perPage: number
  ): Promise<{ fatture: FatturaBase[]; total: number }> => {
    try {
      const response = await apiClient.get(`/fornitori/${fornitoreId}/fatture?page=${page}&per_page=${perPage}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento delle fatture');
      }
      
      return {
        fatture: response.data.data.fatture || [],
        total: response.data.data.total || 0
      };
    } catch (err: any) {
      throw new Error(err.message || 'Errore nel caricamento delle fatture');
    }
  };

  const fetchDettagliFatturaRighe = async (fatturaId: string): Promise<DettaglioFatturaBase[]> => {
    try {
      const response = await apiClient.get(`/fatture/${fatturaId}/dettagli`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento dei dettagli');
      }
      
      return response.data.data.dettagli || [];
    } catch (err: any) {
      throw new Error(err.message || 'Errore nel caricamento dei dettagli fattura');
    }
  };

  const fetchFatturaCompleta = async (fatturaId: string): Promise<FatturaDetail> => {
    try {
      const response = await apiClient.get(`/fatture/${fatturaId}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento della fattura');
      }
      
      return response.data.data.fattura;
    } catch (err: any) {
      throw new Error(err.message || 'Errore nel caricamento della fattura');
    }
  };

  const fetchDettagliCompleti = async (fatturaId: string): Promise<DettaglioRigaFattura[]> => {
    try {
      const response = await apiClient.get(`/fatture/${fatturaId}/righe`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento delle righe');
      }
      
      return response.data.data.righe || [];
    } catch (err: any) {
      throw new Error(err.message || 'Errore nel caricamento delle righe fattura');
    }
  };

  // Handlers per aprire le modal
  const openAnagraficaModal = (fornitore: Fornitore) => {
    setSelectedFornitore(fornitore);
    setAnagraficaModalVisible(true);
  };

  const openFattureElencoModal = (fornitore?: Fornitore) => {
    if (fornitore) {
      setSelectedFornitore(fornitore);
    }
    setFattureElencoModalVisible(true);
  };

  const openFatturaDetailModal = (fatturaId: string) => {
    setSelectedFatturaId(fatturaId);
    setFatturaDetailModalVisible(true);
  };

  // Handlers per chiudere le modal
  const closeAnagraficaModal = () => {
    setAnagraficaModalVisible(false);
    setSelectedFornitore(null);
  };

  const closeFattureElencoModal = () => {
    setFattureElencoModalVisible(false);
    // Non resettare selectedFornitore perché potrebbe servire per altre modal
  };

  const closeFatturaDetailModal = () => {
    setFatturaDetailModalVisible(false);
    setSelectedFatturaId(null);
  };

  // Flusso: Anagrafica → Fatture
  const switchToFattureFromAnagrafica = () => {
    closeAnagraficaModal();
    openFattureElencoModal();
  };

  // Flusso: Elenco Fatture → Dettaglio Fattura (inline, gestito direttamente da ModalFattureElenco)

  return {
    // Stati modal
    anagraficaModalVisible,
    fattureElencoModalVisible,
    fatturaDetailModalVisible,
    
    // Dati selezionati
    selectedFornitore,
    selectedFatturaId,

    // Configurazioni
    getCampiAnagrafica,

    // API functions per le modal
    fetchFattureFornitore,
    fetchDettagliFatturaRighe,
    fetchFatturaCompleta,
    fetchDettagliCompleti,

    // Handlers apertura
    openAnagraficaModal,
    openFattureElencoModal,
    openFatturaDetailModal,

    // Handlers chiusura
    closeAnagraficaModal,
    closeFattureElencoModal,
    closeFatturaDetailModal,

    // Flussi di navigazione
    switchToFattureFromAnagrafica
  };
};