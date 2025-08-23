import { useState } from 'react';
import { CampoAnagrafica, FatturaBase, DettaglioFatturaBase, FatturaDetail, DettaglioRigaFattura } from '@/components/modals';
import type { Paziente } from '@/store/pazienti.store';
import apiClient from '@/api/client';

export const usePazienteModals = () => {
  // Stati per le 3 modal
  const [anagraficaModalVisible, setAnagraficaModalVisible] = useState(false);
  const [fattureElencoModalVisible, setFattureElencoModalVisible] = useState(false);
  const [fatturaDetailModalVisible, setFatturaDetailModalVisible] = useState(false);
  
  // Dati selezionati
  const [selectedPaziente, setSelectedPaziente] = useState<Paziente | null>(null);
  const [selectedFatturaId, setSelectedFatturaId] = useState<string | null>(null);

  // Configurazione campi anagrafica per ModalAnagrafica
  const getCampiAnagrafica = (paziente: Paziente): CampoAnagrafica[] => [
    { key: 'id', label: 'ID Paziente', value: paziente.id, colSize: 6 },
    { key: 'nome', label: 'Nome Paziente', value: paziente.nome, colSize: 6 },
    { key: 'codice_fiscale', label: 'Codice Fiscale', value: paziente.codice_fiscale, colSize: 6 },
    { key: 'data_nascita', label: 'Data Nascita', value: paziente.data_nascita ? new Date(paziente.data_nascita).toLocaleDateString('it-IT') : '', colSize: 6 },
    { key: 'luogo_nascita', label: 'Luogo Nascita', value: paziente.luogo_nascita, colSize: 6 },
    { key: 'provincia_nascita', label: 'Provincia Nascita', value: paziente.provincia_nascita, colSize: 3 },
    { key: 'sesso', label: 'Sesso', value: paziente.sesso, colSize: 3 },
    { key: 'telefono', label: 'Telefono', value: paziente.telefono, type: 'tel', colSize: 6 },
    { key: 'cellulare', label: 'Cellulare', value: paziente.cellulare, type: 'tel', colSize: 6 },
    { key: 'email', label: 'Email', value: paziente.email, type: 'email', colSize: 12 },
    { key: 'indirizzo', label: 'Indirizzo', value: paziente.indirizzo, colSize: 12 },
    { key: 'citta', label: 'Città', value: paziente.citta, colSize: 4 },
    { key: 'provincia', label: 'Provincia', value: paziente.provincia, colSize: 4 },
    { key: 'cap', label: 'CAP', value: paziente.cap, colSize: 4 },
    { 
      key: 'ultima_visita', 
      label: 'Ultima Visita', 
      value: paziente.ultima_visita ? new Date(paziente.ultima_visita).toLocaleDateString('it-IT') : 'Mai', 
      colSize: 6 
    },
    { key: 'mesi_richiamo', label: 'Mesi Richiamo', value: paziente.mesi_richiamo?.toString(), colSize: 3 },
    { key: 'tipo_richiamo', label: 'Tipo Richiamo', value: paziente.tipo_richiamo, colSize: 3 },
    { 
      key: 'da_richiamare', 
      label: 'Da Richiamare', 
      value: paziente.da_richiamare === 'S' ? 'Sì' : 'No',
      type: 'badge',
      badgeColor: paziente.da_richiamare === 'S' ? 'warning' : 'success',
      colSize: 6 
    },
    { 
      key: 'non_in_cura', 
      label: 'In Cura', 
      value: paziente.non_in_cura ? 'No' : 'Sì',
      type: 'badge',
      badgeColor: paziente.non_in_cura ? 'danger' : 'success',
      colSize: 6 
    },
    { 
      key: 'note', 
      label: 'Note', 
      value: paziente.note || 'Nessuna nota', 
      type: 'textarea', 
      colSize: 12 
    }
  ];

  // API calls per fatture paziente
  const fetchFatturePaziente = async (
    pazienteId: string, 
    page: number, 
    perPage: number
  ): Promise<{ fatture: FatturaBase[]; total: number }> => {
    try {
      const response = await apiClient.get(`/pazienti/${pazienteId}/fatture?page=${page}&per_page=${perPage}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento delle fatture');
      }
      
      return {
        fatture: response.data.data.fatture || [],
        total: response.data.data.pagination?.total || 0
      };
    } catch (err: any) {
      throw new Error(err.message || 'Errore nel caricamento delle fatture');
    }
  };

  const fetchDettagliFatturaRighe = async (fatturaId: string): Promise<DettaglioFatturaBase[]> => {
    try {
      const response = await apiClient.get(`/fatture/${fatturaId}/righe`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Errore nel caricamento dei dettagli');
      }
      
      return response.data.data || [];
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
      
      return response.data.data;
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
  const openAnagraficaModal = (paziente: Paziente) => {
    setSelectedPaziente(paziente);
    setAnagraficaModalVisible(true);
  };

  const openFattureElencoModal = (paziente?: Paziente) => {
    if (paziente) {
      setSelectedPaziente(paziente);
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
    setSelectedPaziente(null);
  };

  const closeFattureElencoModal = () => {
    setFattureElencoModalVisible(false);
    // Non resettare selectedPaziente perché potrebbe servire per altre modal
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

  return {
    // Stati modal
    anagraficaModalVisible,
    fattureElencoModalVisible,
    fatturaDetailModalVisible,
    
    // Dati selezionati
    selectedPaziente,
    selectedFatturaId,

    // Configurazioni
    getCampiAnagrafica,

    // API functions per le modal
    fetchFatturePaziente,
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