import apiClient from '@/api/client';

// RENTRI API Types
export interface Operatore {
  identificativo: string;
  codice_fiscale: string;
  denominazione: string;
  sede_legale: string;
}

export interface SitoOperatore {
  id: string;
  denominazione: string;
  indirizzo: string;
  comune: string;
  provincia: string;
}

export interface Registro {
  id_registro: string;
  denominazione: string;
  tipo: string;
  stato: 'attivo' | 'sospeso' | 'cessato';
  data_creazione: string;
}

export interface Movimento {
  id_movimento: string;
  tipo_operazione: string;
  data_movimento: string;
  codice_rifiuto: string;
  quantita: number;
  unita_misura: string;
}

export interface FIR {
  id_fir: string;
  numero: string;
  data_compilazione: string;
  stato: string;
  produttore: string;
  trasportatore: string;
  destinatario: string;
}

// Operatori API
export async function getCurrentOperatore() {
  const response = await apiClient.get('/api/rentri/operatori/me');
  return response.data;
}

export async function getOperatori(demo: boolean = false) {
  const response = await apiClient.get('/api/rentri/operatori', {
    params: { demo }
  });
  return response.data;
}

export async function checkOperatoreIscrizione(identificativo: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/operatori/${identificativo}/controllo-iscrizione`, {
    params: { demo }
  });
  return response.data;
}

export async function getOperatoreSiti(numIscr: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/operatori/${numIscr}/siti`, {
    params: { demo }
  });
  return response.data;
}

export async function createOperatoreRegistro(data: any, demo: boolean = false) {
  const response = await apiClient.post('/api/rentri/operatori/registri', data, {
    params: { demo }
  });
  return response.data;
}

// Anagrafiche API
export async function getAnagraficheStatus(demo: boolean = false) {
  const response = await apiClient.get('/api/rentri/anagrafiche/status', {
    params: { demo }
  });
  return response.data;
}

export async function getOperatoreAnagrafica(codiceFiscale: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/anagrafiche/operatori/${codiceFiscale}`, {
    params: { demo }
  });
  return response.data;
}

// Registri API
export async function getRegistri(demo: boolean = false) {
  const response = await apiClient.get('/api/rentri/registri', {
    params: { demo }
  });
  return response.data;
}

export async function getRegistro(idRegistro: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/registri/${idRegistro}`, {
    params: { demo }
  });
  return response.data;
}

export async function createRegistro(data: any, demo: boolean = false) {
  const response = await apiClient.post('/api/rentri/registri', data, {
    params: { demo }
  });
  return response.data;
}

// Movimenti API
export async function createMovimento(data: any, demo: boolean = false) {
  const response = await apiClient.post('/api/rentri/movimenti', data, {
    params: { demo }
  });
  return response.data;
}

export async function getMovimento(idMovimento: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/movimenti/${idMovimento}`, {
    params: { demo }
  });
  return response.data;
}

// FIR API
export async function getFIR(idFir: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/fir/${idFir}`, {
    params: { demo }
  });
  return response.data;
}

export async function getFIRPDF(idFir: string, demo: boolean = false) {
  const response = await apiClient.get(`/api/rentri/fir/${idFir}/pdf`, {
    params: { demo },
    responseType: 'blob'
  });
  return response.data;
}

// Documenti API
export async function uploadDocumento(formData: FormData, demo: boolean = false) {
  const response = await apiClient.post('/api/rentri/documenti/upload', formData, {
    params: { demo },
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

// Mode Management
export async function getRentriMode() {
  const response = await apiClient.get('/api/settings/rentri-mode');
  return response.data.mode;
}

export async function setRentriMode(mode: 'dev' | 'prod') {
  const response = await apiClient.post('/api/settings/rentri-mode', { mode });
  return response.data;
}

// Test Authorization
export async function testRentriAuthorization() {
  try {
    const response = await apiClient.post('/api/rentri/auth-test');
    return response.data;
  } catch (error) {
    throw error;
  }
}