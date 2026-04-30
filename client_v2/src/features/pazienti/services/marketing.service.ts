import apiClient from '@/services/api/client';

export interface MarketingTemplate {
  id: number;
  nome: string;
  testo: string;
  note?: string;
  canale: string;
  created_at: string;
  updated_at: string;
}

export interface BroadcastPaziente {
  id: string;
  nome: string;
  cellulare: string;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
  errors: string[];
}

export const marketingService = {
  async apiGetTemplates(): Promise<MarketingTemplate[]> {
    const res = await apiClient.get('/marketing/templates');
    return res.data.data?.templates || [];
  },

  async apiCreateTemplate(data: Omit<MarketingTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    await apiClient.post('/marketing/templates', data);
  },

  async apiUpdateTemplate(id: number, data: Partial<MarketingTemplate>): Promise<void> {
    await apiClient.put(`/marketing/templates/${id}`, data);
  },

  async apiDeleteTemplate(id: number): Promise<void> {
    await apiClient.delete(`/marketing/templates/${id}`);
  },

  async apiBroadcast(pazienti: BroadcastPaziente[], testo: string): Promise<BroadcastResult> {
    const res = await apiClient.post('/marketing/broadcast', { pazienti, testo });
    return res.data.data as BroadcastResult;
  },
};
