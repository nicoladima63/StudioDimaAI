import apiClient from '@/api/client';

export interface Materiale {
  id: number;
  codicearticolo?: string;
  fornitoreid: string;
  fornitorenome: string;
  contoid?: number | null;
  contonome?: string | null;
  brancaid?: number | null;
  brancanome?: string | null;
  sottocontoid?: number | null;
  sottocontonome?: string | null;
  nome: string;
  metodo_classificazione?: string | null;
  confidence?: number;
  confermato?: boolean;
}

export async function getMateriali(params?: {
  fornitore_id?: string;
  conto_id?: number;
  branca_id?: number;
  sottoconto_id?: number;
}) {
  const res = await apiClient.get('/api/materiali', { params });
  return res.data; // { success, data, total }
}

export async function getMateriale(materialeId: number) {
  const res = await apiClient.get(`/api/materiali/${materialeId}`);
  return res.data; // { success, data }
}

export async function createMateriale(payload: Partial<Materiale>) {
  const res = await apiClient.post('/api/materiali', payload);
  return res.data; // { success, data, message }
}

export async function updateMateriale(materialeId: number, payload: Partial<Materiale>) {
  const res = await apiClient.put(`/api/materiali/${materialeId}`, payload);
  return res.data; // { success, message }
}

export async function deleteMateriale(materialeId: number) {
  const res = await apiClient.delete(`/api/materiali/${materialeId}`);
  return res.data; // { success, message }
}

export async function saveClassificazioneMateriale(payload: {
  codice_articolo?: string;
  descrizione: string;
  codice_fornitore: string;
  nome_fornitore?: string;
  conto_codice: string;
  sottoconto_codice: string;
  categoria_contabile?: string;
  metodo_classificazione?: 'manuale' | 'confermato' | 'automatico' | 'pattern';
  confidence?: number;
}) {
  const res = await apiClient.post('/api/materiali/save-classificazione', payload);
  return res.data; // { success, message, data: { id, operazione } }
}

export async function confirmTuttiDaVerificare() {
  const res = await apiClient.post('/api/materiali/confirm-da-verificare');
  return res.data as { success: boolean; message: string; materiali_confermati: number };
}


