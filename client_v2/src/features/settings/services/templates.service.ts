import apiClient from '@/services/api/client';

export interface Template {
  content: string;
  variables: string[];
  description: string;
  last_modified?: string;
}

export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    variables_count: number;
    variables: string[];
    length: number;
    estimated_sms_parts: number;
  };
}

export interface TemplatePreviewResult {
  success: boolean;
  preview?: string;
  sample_data?: Record<string, any>;
  validation?: TemplateValidation;
  stats?: {
    length: number;
    estimated_sms_parts: number;
    variables_count: number;
    variables: string[];
  };
  error?: string;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  state?: 'success' | 'warning' | 'error';
}

const templates = {
  // Get all templates
  apiGetAllTemplates: async (): Promise<ApiResponse<{
    templates: Record<string, Template>;
    stats: any;
  }>> => {
    try {
      const response = await apiClient.get('/templates');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore caricamento template',
        state: 'error'
      };
    }
  },

  // Get specific template
  apiGetTemplate: async (tipo: 'richiamo' | 'promemoria'): Promise<ApiResponse<{
    template: Template;
    tipo: string;
  }>> => {
    try {
      const response = await apiClient.get(`/templates/${tipo}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || `Errore caricamento template ${tipo}`,
        state: 'error'
      };
    }
  },

  // Update template
  apiUpdateTemplate: async (
    tipo: 'richiamo' | 'promemoria',
    content: string,
    description?: string
  ): Promise<ApiResponse<{
    template: Template;
    validation: TemplateValidation;
  }>> => {
    try {
      const response = await apiClient.put(`/templates/${tipo}`, {
        content,
        description
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || `Errore aggiornamento template ${tipo}`,
        message: error.response?.data?.message,
        data: error.response?.data?.data,
        state: 'error'
      };
    }
  },

  // Reset template to default
  apiResetTemplate: async (tipo: 'richiamo' | 'promemoria'): Promise<ApiResponse<{
    template: Template;
  }>> => {
    try {
      const response = await apiClient.post(`/templates/${tipo}/reset`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || `Errore reset template ${tipo}`,
        state: 'error'
      };
    }
  },

  // Preview template
  apiPreviewTemplate: async (
    tipo: 'richiamo' | 'promemoria',
    content?: string,
    data?: Record<string, any>
  ): Promise<ApiResponse<TemplatePreviewResult>> => {
    try {
      const response = await apiClient.post(`/sms-templates/preview`, { // CAMBIATO: URL corretto
        name: tipo, // Passa il tipo come nome per il backend
        custom_content: content,
        preview_data: data
      });
      
      // CAMBIATO: Mappa la risposta del backend
      if (response.data.success) {
        return {
          success: true,
          preview: response.data.message, // Mappa 'message' a 'preview'
          stats: {
            length: response.data.length,
            estimated_sms_parts: response.data.estimated_sms_parts,
            // Aggiungi altre stats se il backend le fornisce
          },
          message: response.data.message // Mantieni anche message se serve
        };
      } else {
        return {
          success: false,
          error: response.data.error || response.data.message || `Errore preview template ${tipo}`,
          state: 'error'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || `Errore preview template ${tipo}`,
        state: 'error'
      };
    }
  },

  // Validate template
  apiValidateTemplate: async (content: string): Promise<ApiResponse<{
    validation: TemplateValidation;
    content_length: number;
  }>> => {
    try {
      const response = await apiClient.post('/templates/validate', {
        content
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore validazione template',
        state: 'error'
      };
    }
  },

  // Get template statistics
  apiGetTemplateStats: async (): Promise<ApiResponse<{
    total_templates: number;
    templates: Record<string, {
      length: number;
      variables_count: number;
      estimated_sms_parts: number;
      last_modified: string;
    }>;
  }>> => {
    try {
      const response = await apiClient.get('/templates/stats');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore statistiche template',
        state: 'error'
      };
    }
  },

  // Backup templates
  apiBackupTemplates: async (): Promise<ApiResponse<{
    backup_file: string;
  }>> => {
    try {
      const response = await apiClient.post('/templates/backup');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore backup template',
        state: 'error'
      };
    }
  },

  // Restore templates
  apiRestoreTemplates: async (backupFile: string): Promise<ApiResponse<{
    current_backup: string;
  }>> => {
    try {
      const response = await apiClient.post('/templates/restore', {
        backup_file: backupFile
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Errore ripristino template',
        state: 'error'
      };
    }
  }
};

export default templates;