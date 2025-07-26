import { apiClient } from '../client';

export interface Diagnosi {
  id: number;
  codice: string;
  descrizione: string;
  categoria: string;
  num_protocolli: number;
}

export interface Farmaco {
  id: number;
  principio_attivo: string;
  posologia_standard: string;
  nomi_commerciali: string;
  indicazioni: string;
  categoria: string;
  note?: string;
}

export interface ProtocolloTerapeutico {
  protocollo_id: number;
  farmaco_id: number;
  principio_attivo: string;
  nomi_commerciali: string;
  categoria: string;
  indicazioni: string;
  posologia_standard: string;
  posologia_custom?: string;
  durata_custom?: string;
  note_custom?: string;
  ordine: number;
}

export interface CreateProtocolloRequest {
  diagnosiId: number;
  farmacoId: number;
  posologia_custom?: string;
  durata_custom?: string;
  note_custom?: string;
  ordine?: number;
}

export interface UpdateProtocolloRequest {
  posologia_custom?: string;
  durata_custom?: string;
  note_custom?: string;
  ordine?: number;
}

export interface CreateDiagnosiRequest {
  codice: string;
  descrizione: string;
  categoria?: string;
}

export interface UpdateDiagnosiRequest {
  codice: string;
  descrizione: string;
  categoria?: string;
}

export interface DuplicateDiagnosiRequest {
  new_codice: string;
  new_descrizione: string;
  new_categoria?: string;
}

class ProtocolliService {
  // Gestione Diagnosi
  async getDiagnosi(): Promise<Diagnosi[]> {
    const response = await apiClient.get('/api/protocolli/diagnosi');
    return response.data.diagnosi;
  }

  async createDiagnosi(data: CreateDiagnosiRequest): Promise<void> {
    await apiClient.post('/api/protocolli/diagnosi', data);
  }

  async updateDiagnosi(id: number, data: UpdateDiagnosiRequest): Promise<void> {
    await apiClient.put(`/api/protocolli/diagnosi/${id}`, data);
  }

  async duplicateDiagnosi(sourceId: number, data: DuplicateDiagnosiRequest): Promise<void> {
    await apiClient.post(`/api/protocolli/diagnosi/${sourceId}/duplicate-with-protocolli`, data);
  }

  async deleteDiagnosi(id: number): Promise<void> {
    await apiClient.delete(`/api/protocolli/diagnosi/${id}`);
  }

  // Gestione Protocolli Terapeutici
  async getProtocolliPerDiagnosi(diagnosiId: number): Promise<ProtocolloTerapeutico[]> {
    const response = await apiClient.get(`/api/protocolli/diagnosi/${diagnosiId}/protocolli`);
    return response.data.protocolli;
  }

  async createProtocollo(data: CreateProtocolloRequest): Promise<void> {
    await apiClient.post('/api/protocolli/protocolli', data);
  }

  async updateProtocollo(protocolloId: number, data: UpdateProtocolloRequest): Promise<void> {
    await apiClient.put(`/api/protocolli/protocolli/${protocolloId}`, data);
  }

  async deleteProtocollo(protocolloId: number): Promise<void> {
    await apiClient.delete(`/api/protocolli/protocolli/${protocolloId}`);
  }

  // Farmaci
  async getFarmaci(categoria?: string): Promise<Farmaco[]> {
    const params = categoria ? { categoria } : undefined;
    const response = await apiClient.get('/api/protocolli/farmaci', { params });
    return response.data.farmaci;
  }

  async getCategorieFarmaci(): Promise<string[]> {
    const response = await apiClient.get('/api/protocolli/categorie-farmaci');
    return response.data.categorie;
  }

  // Utilità
  async reloadData(): Promise<void> {
    await apiClient.post('/api/protocolli/reload-data');
  }
}

export const protocolliService = new ProtocolliService();