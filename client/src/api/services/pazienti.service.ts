import { apiClient } from '../client';
import { usePazientiStore } from '@/store/pazienti.store';

export async function getPazientiCount(): Promise<number> {
  const response = await apiClient.get('/api/pazienti/count');
  return response.data.count;
}

export async function getPazientiList(forceRefresh = false) {
  const { pazienti, lastKnownCount, setLoading, setPazienti } = usePazientiStore.getState();
  
  if (pazienti.length > 0 && !forceRefresh) {
    try {
      const currentCount = await getPazientiCount();
      
      if (currentCount === lastKnownCount) {
        return pazienti;
      }
    } catch (error) {
      console.warn('Errore nel controllo conteggio');
    }
  }
  
  setLoading(true);
  
  try {
    const response = await apiClient.get('/api/pazienti/');
    setPazienti(response.data);
    return response.data;
  } finally {
    setLoading(false);
  }
}

export async function getPazientiStats() {
  const response = await apiClient.get('/api/pazienti/statistiche');
  return response.data;
}

export async function getPazienteById(id: number) {
  await getPazientiList();
  return usePazientiStore.getState().getPazienteById(id);
}

export async function getPazienteByNome(nome: string) {
  await getPazientiList();
  return usePazientiStore.getState().getPazienteByNome(nome);
}

export async function getPazientiOfComune(comune: string) {
  await getPazientiList();
  return usePazientiStore.getState().getPazientiOfComune(comune);
}