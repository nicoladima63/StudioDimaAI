/**
 * Types per la ricetta elettronica V2
 * Definisce tutte le interfacce per il Sistema Tessera Sanitaria
 */

// === Entità base ===
export interface Diagnosi {
  id:number;
  codice: string;
  descrizione: string;
}

export interface Farmaco {
  codice: string;
  descrizione: string;
  principio_attivo: string;
}

export interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  codice_fiscale: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  telefono?: string;
  email?: string;
}

export interface DatiMedico {
  cf_medico: string;
  regione: string;
  regione_ordine?: string;
  asl: string;
  specializzazione: string;
  iscrizione: string;
  indirizzo: string;
  telefono: string;
  cap: string;
  citta: string;
  provincia: string;
  ambito?: string;
}

// === Ricetta elettronica ===
export interface RicettaPayload {
  paziente: Paziente;
  medico?: DatiMedico;
  diagnosi: Diagnosi;
  farmaco: Farmaco;
  posologia?: string;
  durata?: string;
  quantita?: number;
  note?: string;
  tipo_ricetta?: 'R' | 'NR'; // R=Ripetibile, NR=Non Ripetibile
  codice_ricetta?: string;
}

// Nuovo tipo per l'invio al Sistema TS
export interface RicettaInvioPayload {
  cf_assistito: string;
  cognome_nome: string;
  indirizzo: string;
  cod_diagnosi: string;
  descr_diagnosi: string;
  prescrizioni: {
    cod_prodotto: string;
    descrizione: string;
    quantita: string;
    posologia: string;
    note: string;
    tdl: string;
  }[];
  cod_regione: string;
  cod_asl: string;
  specializzazione: string;
  num_iscrizione_albo: string;
  indirizzo_medico: string;
  telefono_medico: string;
  tipo_prescrizione: string;
}

export interface RicettaResponse {
  success: boolean;
  data?: {
    codice_ricetta?: string;
    numero_ricetta?: string;
    codice_ritorno?: string;
    descrizione_ritorno?: string;
    [key: string]: any;
  };
  error?: string;
  fault_code?: string;
  message?: string;
  timestamp?: string;
}

// === Protocolli terapeutici ===
export interface ProtocolloTerapeutico {
  id: string;
  nome: string;
  descrizione: string;
  diagnosi: Diagnosi;
  farmaci: Farmaco[];
  posologia_standard?: string;
  durata_standard?: string;
  note?: string;
  categoria?: string;
  specializzazione?: string;
  attivo: boolean;
  created_at?: string;
  updated_at?: string;
}

// === Ambiente e configurazione ===
export type RicettaEnvironment = 'test' | 'prod';

export interface EnvironmentConfig {
  environment: RicettaEnvironment;
  endpoints: {
    invio: string;
    visualizza: string;
    annulla: string;
  };
  credentials_configured: boolean;
  certificates?: Record<string, boolean>;
  ssl_version?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  environment: RicettaEnvironment;
  endpoint: string;
  status_code?: number;
  certificates?: Record<string, boolean>;
  ssl_version?: string;
  message: string;
  error?: string;
}

// === API Responses ===
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  query?: string;
  message?: string;
  error?: string;
  error_code?: string;
}

export interface SearchResponse<T> extends ApiResponse<T[]> {
  query: string;
  count: number;
}

export interface DiagnosiSearchResponse extends SearchResponse<Diagnosi> {}
export interface FarmaciSearchResponse extends SearchResponse<Farmaco> {}

// === Form states ===
export interface RicettaFormData {
  paziente_id: string | null;
  paziente: Paziente | null;
  diagnosi: Diagnosi | null;
  farmaco: Farmaco | null;
  posologia: string;
  durata: string;
  quantita: number;
  note: string;
  tipo_ricetta: 'R' | 'NR';
  protocollo_id?: string | null;
}

export interface RicettaFormErrors {
  paziente?: string;
  diagnosi?: string;
  farmaco?: string;
  posologia?: string;
  durata?: string;
  quantita?: string;
  general?: string;
}

export interface RicettaFormState {
  data: RicettaFormData;
  errors: RicettaFormErrors;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// === Store states ===
export interface RicettaStoreState {
  // Environment
  environment: RicettaEnvironment;
  environmentConfig: EnvironmentConfig | null;
  
  // Form
  form: RicettaFormState;
  
  // Cache dati
  diagnosi: Diagnosi[];
  farmaci: Farmaco[];
  protocolli: ProtocolloTerapeutico[];
  pazienti: Paziente[];
  
  // Cache ricerche
  diagnosiSearch: {
    query: string;
    results: Diagnosi[];
    loading: boolean;
  };
  farmaciSearch: {
    query: string;
    results: Farmaco[];
    loading: boolean;
  };
  
  // Suggerimenti
  posologie: string[];
  durate: string[];
  note: string[];
  
  // Stati
  isLoading: boolean;
  error: string | null;
  lastTest: ConnectionTestResult | null;
  
  // Cache timestamps
  lastUpdated: {
    diagnosi: number;
    farmaci: number;
    protocolli: number;
    posologie: number;
    durate: number;
    note: number;
  };
}

// === Action types ===
export interface RicettaActions {
  // Environment
  setEnvironment: (env: RicettaEnvironment) => void;
  loadEnvironmentConfig: () => Promise<void>;
  testConnection: () => Promise<ConnectionTestResult>;
  
  // Form
  updateFormData: (data: Partial<RicettaFormData>) => void;
  setFormErrors: (errors: Partial<RicettaFormErrors>) => void;
  resetForm: () => void;
  validateForm: () => boolean;
  
  // Search
  searchDiagnosi: (query: string) => Promise<Diagnosi[]>;
  searchFarmaci: (query: string) => Promise<Farmaco[]>;
  getFarmaciPerDiagnosi: (codiceDiagnosi: string) => Promise<Farmaco[]>;
  
  // Protocolli
  loadProtocolli: () => Promise<void>;
  getProtocolloById: (id: string) => ProtocolloTerapeutico | null;
  applyProtocollo: (protocollo: ProtocolloTerapeutico) => void;
  
  // Suggerimenti
  loadSuggerimenti: () => Promise<void>;
  getSuggerimentiPosologie: () => string[];
  getSuggerimentiDurate: () => string[];
  getSuggerimentiNote: () => string[];
  
  // Invio
  inviaRicetta: (payload: RicettaPayload) => Promise<RicettaResponse>;
  
  // Utilities
  clearCache: () => void;
  reload: () => Promise<void>;
}

// === Hooks return types ===
export interface UseRicettaReturn {
  // State
  environment: RicettaEnvironment;
  environmentConfig: EnvironmentConfig | null;
  form: RicettaFormState;
  isLoading: boolean;
  error: string | null;
  lastTest: ConnectionTestResult | null;
  
  // Actions
  actions: RicettaActions;
}

export interface UseRicettaSearchReturn {
  // Diagnosi
  searchDiagnosi: (query: string) => Promise<Diagnosi[]>;
  diagnosiResults: Diagnosi[];
  diagnosiLoading: boolean;
  
  // Farmaci
  searchFarmaci: (query: string) => Promise<Farmaco[]>;
  farmaciResults: Farmaco[];
  farmaciLoading: boolean;
  
  // Utilities
  clearResults: () => void;
}

export interface UseRicettaProtocolliReturn {
  protocolli: ProtocolloTerapeutico[];
  getProtocolloById: (id: string) => ProtocolloTerapeutico | null;
  applyProtocollo: (protocollo: ProtocolloTerapeutico) => void;
  isLoading: boolean;
  error: string | null;
}

// === Utility types ===
export type RicettaFormField = keyof RicettaFormData;
export type RicettaErrorField = keyof RicettaFormErrors;

export interface FormFieldConfig {
  name: RicettaFormField;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'autocomplete';
  required: boolean;
  placeholder?: string;
  validation?: (value: any) => string | null;
}

// === Test e sviluppo ===
export interface FarmacoTestSicuro extends Farmaco {
  test_safe: boolean;
  note_test?: string;
}

export interface RicettaTestFunzionante {
  id: string;
  descrizione: string;
  paziente: Paziente;
  diagnosi: Diagnosi;
  farmaco: Farmaco;
  posologia: string;
  durata: string;
  note?: string;
  risultato_atteso: string;
  ultima_verifica?: string;
}

// === Constants ===
export const RICETTA_FORM_DEFAULTS: RicettaFormData = {
  paziente_id: null,
  paziente: null,
  diagnosi: null,
  farmaco: null,
  posologia: '',
  durata: '',
  quantita: 1,
  note: '',
  tipo_ricetta: 'R'
};

export const RICETTA_ENVIRONMENTS: RicettaEnvironment[] = ['test', 'prod'];

export const TIPO_RICETTA_OPTIONS = [
  { value: 'R', label: 'Ripetibile' },
  { value: 'NR', label: 'Non Ripetibile' }
] as const;