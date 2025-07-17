// src/api/services/templates.service.ts

import apiClient from '@/api/client';

export interface Template {
  content: string;
  variables: string[];
  description: string;
  last_modified?: string;
}

export interface TemplateResponse {
  success: boolean;
  template?: Template;
  templates?: Record<string, Template>;
  error?: string;
  validation?: TemplateValidation;
  message?: string;
}

export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    variables_count: number;
    variables: string[];
    length: number;
  };
}

export interface TemplatePreviewResponse {
  success: boolean;
  preview?: string;
  sample_data?: Record<string, any>;
  validation?: TemplateValidation;
  stats?: {
    length: number;
    estimated_sms_parts: number;
  };
  error?: string;
}

class TemplatesService {
  private baseUrl = '/api/sms/templates';

  /**
   * Ottiene tutti i template
   */
  async getAllTemplates(): Promise<Record<string, Template>> {
    const response = await apiClient.get<TemplateResponse>(this.baseUrl);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Errore recupero template');
    }
    
    return response.data.templates || {};
  }

  /**
   * Ottiene un template specifico
   */
  async getTemplate(tipo: 'richiamo' | 'promemoria'): Promise<Template> {
    const response = await apiClient.get<TemplateResponse>(`${this.baseUrl}/${tipo}`);
    
    if (!response.data.success || !response.data.template) {
      throw new Error(response.data.error || 'Template non trovato');
    }
    
    return response.data.template;
  }

  /**
   * Aggiorna un template
   */
  async updateTemplate(
    tipo: 'richiamo' | 'promemoria',
    content: string,
    description?: string
  ): Promise<Template> {
    const response = await apiClient.put<TemplateResponse>(`${this.baseUrl}/${tipo}`, {
      content,
      description
    });
    
    if (!response.data.success || !response.data.template) {
      throw new Error(response.data.error || 'Errore aggiornamento template');
    }
    
    return response.data.template;
  }

  /**
   * Resetta un template ai valori di default
   */
  async resetTemplate(tipo: 'richiamo' | 'promemoria'): Promise<Template> {
    const response = await apiClient.post<TemplateResponse>(`${this.baseUrl}/${tipo}/reset`);
    
    if (!response.data.success || !response.data.template) {
      throw new Error(response.data.error || 'Errore reset template');
    }
    
    return response.data.template;
  }

  /**
   * Anteprima template con dati di esempio
   */
  async previewTemplate(
    tipo: 'richiamo' | 'promemoria',
    content?: string,
    data?: Record<string, any>
  ): Promise<TemplatePreviewResponse> {
    const requestData: any = {};
    if (content) requestData.content = content;
    if (data) requestData.data = data;
    
    const response = await apiClient.post<TemplatePreviewResponse>(`${this.baseUrl}/${tipo}/preview`, requestData);
    
    return response.data;
  }

  /**
   * Valida un template senza salvarlo
   */
  async validateTemplate(content: string): Promise<TemplateValidation> {
    const response = await apiClient.post<{ success: boolean; validation: TemplateValidation; error?: string }>(`${this.baseUrl}/validate`, { content });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Errore validazione');
    }
    
    return response.data.validation;
  }
}

// Istanza singleton del servizio
export const templatesService = new TemplatesService();

// Esporta anche la classe per casi d'uso avanzati
export { TemplatesService };