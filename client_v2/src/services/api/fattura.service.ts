
import { BaseService } from './base.service';
import type { FatturaDetail, DettaglioRigaFattura } from '@/components/modals/ModalFatturaDetail';
import type { ApiResponse } from '@/types';

class FatturaService extends BaseService {
  constructor() {
    super('/fornitori');
  }

  async getFatturaById(id: string, fornitoreId: string): Promise<FatturaDetail> {
    const response: ApiResponse<{ spese: FatturaDetail[] }> = await this.apiGet(`/${fornitoreId}/spese`);
    if (response.success && response.data) {
      const fattura = response.data.spese.find(f => f.id === id);
      if (fattura) {
        return fattura;
      } else {
        throw new Error(`Fattura con ID ${id} non trovata per il fornitore ${fornitoreId}`);
      }
    } else {
      throw new Error(response.message || 'Failed to fetch fattura details');
    }
  }

  async getDettagliFattura(id: string): Promise<DettaglioRigaFattura[]> {
    const response: ApiResponse<DettaglioRigaFattura[]> = await this.apiGet(`/spese/${id}/dettagli`);
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch fattura details');
    }
  }
}

export const fatturaService = new FatturaService();
