// src/api/ricette/ricetteApi.ts
import apiClient from '@/api/client';

export interface RicettaPayload {
  medico: {
    cfMedico: string;
    regione: string;
    asl: string;
    specializzazione: string;
    iscrizione: string;
    indirizzo: string;
    telefono: string;
    cap: string;
    citta: string;
    provincia: string;
  };
  paziente: {
    id: string;
    nome: string;
    cognome: string;
    codiceFiscale?: string;
    indirizzo?: string;
    cap?: string;
    citta?: string;
    provincia?: string;
  };
  diagnosi: {
    codice: string;
    descrizione: string;
  };
  farmaco: {
    codice: string;
    principio_attivo: string;
    descrizione: string;
  };
  posologia: string;
  durata: string;
  note: string;
}

export async function searchDiagnosi(q: string) {
  const response = await apiClient.get('/api/diagnosi', { params: { q } });
  return response.data;
}

export async function searchFarmaci(q: string) {
  const response = await apiClient.get('/api/farmaci', { params: { q } });
  return response.data;
}

export async function inviaRicetta(payload: RicettaPayload) {
  const response = await apiClient.post('/api/ricetta/send', payload);
  return response.data;
}

// Servizi di autenticazione ricetta elettronica
export async function testRicettaConnection() {
  const response = await apiClient.get('/api/ricetta/auth/test');
  return response.data;
}

export async function ricettaAuthLogin() {
  const response = await apiClient.post('/api/ricetta/auth/login');
  return response.data;
}

export async function getRicettaAuthStatus() {
  const response = await apiClient.get('/api/ricetta/auth/status');
  return response.data;
}

// === NUOVE API PER PROTOCOLLI TERAPEUTICI ===

export interface Diagnosi {
  id: number;
  codice: string;
  descrizione: string;
  num_farmaci: number;
}

export interface PosologiaAlternativa {
  posologia: string;
  durata: string;
  note: string;
}

export interface FarmacoProtocollo {
  codice: string;
  nome: string;
  principio_attivo: string;
  classe: string;
  posologia_default: string;
  durata_default: string;
  note_default: string;
  posologie_alternative: PosologiaAlternativa[];
}

export async function getDiagnosiDisponibili(): Promise<Diagnosi[]> {
  const response = await apiClient.get('/api/protocolli/diagnosi');
  return response.data.diagnosi;
}

export async function getFarmaciPerDiagnosi(diagnosiId: number): Promise<FarmacoProtocollo[]> {
  const response = await apiClient.get(`/api/protocolli/diagnosi/${diagnosiId}/protocolli`);
  const protocolli = response.data.protocolli;
  
  // Mappa ProtocolloTerapeutico[] a FarmacoProtocollo[] 
  return (protocolli || []).map((p: any) => ({
    codice: `${p.farmaco_id}`,
    nome: p.nomi_commerciali,
    principio_attivo: p.principio_attivo,
    classe: p.categoria,
    posologia_default: p.posologia_custom || p.posologia_standard,
    durata_default: p.durata_custom || 'Non specificata',
    note_default: p.note_custom || '',
    posologie_alternative: []
  }));
}


export async function getDurateStandard(): Promise<string[]> {
  const response = await apiClient.get('/api/protocolli/durate');
  return response.data.data;
}

export async function getNoteFrequenti(): Promise<string[]> {
  const response = await apiClient.get('/api/protocolli/note');
  return response.data.data;
}

export async function getProtocolliCompleti() {
  const response = await apiClient.get('/api/protocolli');
  return response.data.data;
}

// === API CRUD PER GESTIONE PROTOCOLLI ===

export async function createDiagnosi(data: { id: string; codice: string; descrizione: string }) {
  const response = await apiClient.post('/api/protocolli/diagnosi', data);
  return response.data;
}

export async function updateDiagnosi(diagnosiId: string, data: { codice: string; descrizione: string }) {
  const response = await apiClient.put(`/api/protocolli/diagnosi/${diagnosiId}`, data);
  return response.data;
}

export async function deleteDiagnosi(diagnosiId: string) {
  const response = await apiClient.delete(`/api/protocolli/diagnosi/${diagnosiId}`);
  return response.data;
}

export async function createFarmaco(diagnosiId: string, data: {
  codice: string;
  nome: string;
  principio_attivo: string;
  classe: string;
  posologia_default: string;
  durata_default: string;
  note_default: string;
}) {
  const response = await apiClient.post(`/api/protocolli/diagnosi/${diagnosiId}/farmaci`, data);
  return response.data;
}

export async function updateFarmaco(diagnosiId: string, farmacoCodice: string, data: {
  codice: string;
  nome: string;
  principio_attivo: string;
  classe: string;
  posologia_default: string;
  durata_default: string;
  note_default: string;
}) {
  const response = await apiClient.put(`/api/protocolli/diagnosi/${diagnosiId}/farmaci/${farmacoCodice}`, data);
  return response.data;
}

export async function deleteFarmaco(diagnosiId: string, farmacoCodice: string) {
  const response = await apiClient.delete(`/api/protocolli/diagnosi/${diagnosiId}/farmaci/${farmacoCodice}`);
  return response.data;
}