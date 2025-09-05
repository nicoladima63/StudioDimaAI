import apiClient from '@/services/api/client';

export interface MaterialeMigrazione {
  id: string;
  nome: string;
  codice_prodotto: string;
  costo_unitario: number;
  quantita: number;
  confidence: number;
  categoria_contabile: string;
  confermato: boolean;
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  contonome?: string;
  brancanome?: string;
  sottocontonome?: string;
  fornitoreid: string;
  fornitorenome: string;
  data_fattura: string;
  fattura_id: string;
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
    const response = await apiClient.get('/materiali/migrazione/preview');
    return response.data;
  },

  /**
   * Ottieni anteprima dei materiali per un fornitore specifico
   */
  async getSupplierPreview(fornitoreId: string): Promise<RispostaAPI<FornitoreMigrazione>> {
    const response = await apiClient.get(`/materiali/migrazione/preview/${fornitoreId}`);
    return response.data;
  },

  /**
   * Importa tutti i materiali di un fornitore specifico
   */
  async importSupplierMaterials(supplierName: string): Promise<RispostaAPI<RisultatoImportazione>> {
    const response = await apiClient.post(`/materiali/migrazione/import/${encodeURIComponent(supplierName)}`);
    return response.data;
  },

  /**
   * Importa tutti i materiali dentali disponibili
   */
  async importAllMaterials(): Promise<RispostaAPI<RisultatoImportazione>> {
    const response = await apiClient.post('/materiali/migrazione/import-all');
    return response.data;
  }
};
