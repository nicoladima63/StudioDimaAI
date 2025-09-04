import apiClient from '@/api/client';

export interface MaterialeMigrazione {
  id: string;
  nome: string;
  costo_unitario: number;
  quantita: number;
  confidence: number;
  categoria_contabile: string;
  confermato: boolean;
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
}

export interface FornitoreMigrazione {
  fornitore_nome: string;
  fornitore_originale: string;
  materiali_count: number;
  materiali: MaterialeMigrazione[];
}

export interface AnteprimaMigrazione {
  suppliers: FornitoreMigrazione[];
  total_suppliers: number;
  total_materials: number;
  stats: {
    total_valid_materials: number;
    dental_materials: number;
    suppliers_with_materials: number;
  };
}

export interface RisultatoImportazione {
  supplier_name?: string;
  materials_imported: number;
  materials_updated: number;
  materials_skipped: number;
  total_processed: number;
}

export interface RispostaAPI<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const materialiMigrationService = {
  /**
   * Ottieni anteprima dei materiali da migrare raggruppati per fornitore
   */
  async getMigrationPreview(): Promise<RispostaAPI<AnteprimaMigrazione>> {
    const response = await apiClient.get('/api/materiali-migration/preview');
    return response.data;
  },

  /**
   * Importa tutti i materiali di un fornitore specifico
   */
  async importSupplierMaterials(supplierName: string): Promise<RispostaAPI<RisultatoImportazione>> {
    const response = await apiClient.post(`/api/materiali-migration/import/${encodeURIComponent(supplierName)}`);
    return response.data;
  },

  /**
   * Importa tutti i materiali dentali disponibili
   */
  async importAllMaterials(): Promise<RispostaAPI<RisultatoImportazione>> {
    const response = await apiClient.post('/api/materiali-migration/import-all');
    return response.data;
  }
};
