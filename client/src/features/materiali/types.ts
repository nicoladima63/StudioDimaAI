export interface Materiale {
  id?: number;
  codicearticolo: string;
  nome: string;
  fornitoreid: string;
  fornitorenome: string;
  contoid: number | null;
  contonome: string | null;
  brancaid: number | null;
  brancanome: string | null;
  sottocontoid: number | null;
  sottocontonome: string | null;
  confidence: number; // 0-100
  confermato: boolean;
  occorrenze: number;
  conto_codice: string | null;
  sottoconto_codice: string | null;
  categoria_contabile: string | null;
  metodo_classificazione: string | null;
}

export interface MaterialeFormData {
  codicearticolo: string;
  nome: string;
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
  confermato: boolean;
}

export interface MaterialiFilters {
  fornitoreid?: string;
  contoid?: number;
  brancaid?: number;
  sottocontoid?: number;
  confermato?: boolean;
  search?: string;
}

export interface FornitoreItem {
  codice_riferimento: string;
  fornitore_nome: string;
}