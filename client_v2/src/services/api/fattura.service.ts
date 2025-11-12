
import { BaseService } from './base.service';
import type { FatturaCompleta } from '@/types/fatture'; 
import type { ApiResponse } from '@/types';

class FatturaService extends BaseService {
  constructor() {
    super('/spese-fornitori');
  }

  async getFatturaCompleta(id: string): Promise<FatturaCompleta> {
    const response: ApiResponse<FatturaCompleta> = await this.apiGet(`/${id}/all`);
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch fattura details');
    }
  }
}

export const fatturaService = new FatturaService();
