/**
 * Tipi per i pazienti unificati - AGGIUNGI AL TUO types.ts
 */

export interface PazienteCompleto {
  // Dati base DBF
  DB_CODE: string;
  DB_PANOME: string;
  DB_PAINDIR: string;
  DB_PACITTA: string;
  DB_PACAP: string;
  DB_PAPROVI: string;
  DB_PATELEF: string;
  DB_PACELLU: string;
  DB_PADANAS: string;
  DB_PAULTVI: string | null;
  DB_PARICHI: string;
  DB_PARITAR: number;
  DB_PARIMOT: string;
  DB_PANONCU: string;
  DB_PAEMAIL: string;
  DB_PACODFI: string;
  
  // Dati elaborati
  nome_completo: string;
  numero_contatto: string;
  citta_clean: string;
  cap_clean: string;
  provincia_clean: string;
  
  // Stato richiami
  needs_recall: boolean;
  data_richiamo: string | null;
  tipo_richiamo: string;
  tipo_richiamo_desc: string;
  mesi_richiamo: number;
  ultima_visita: string | null;
  giorni_ultima_visita: number | null;
  recall_priority: 'none' | 'low' | 'medium' | 'high';
  recall_status: 'none' | 'futuro' | 'in_scadenza' | 'scaduto';
}

export interface StatistichePazienti {
  totale_pazienti: number;
  in_cura: number;
  non_in_cura: number;
  con_cellulare: number;
  con_email: number;
  richiami: {
    totale_da_richiamare: number;
    priorita_alta: number;
    priorita_media: number;
    priorita_bassa: number;
    scaduti: number;
    in_scadenza: number;
    futuri: number;
    per_tipo: Record<string, number>;
  };
  geografia: {
    totale_citta: number;
    totale_province: number;
    top_citta: Record<string, number>;
    distribuzione_citta: Record<string, number>;
    distribuzione_province: Record<string, number>;
  };
  aggiornato_il: string;
}

export interface CittaData {
  citta: string;
  totale_pazienti: number;
  richiami_necessari: number;
  con_cellulare: number;
  con_email: number;
  in_cura: number;
}

export type ViewType = 'all' | 'recalls' | 'cities';
export type PriorityFilter = 'high' | 'medium' | 'low';
export type StatusFilter = 'scaduto' | 'in_scadenza' | 'futuro';

/**
 * Tipi per le risposte API pazienti
 */
export type PazientiResponse = {
  success: boolean;
  data: PazienteCompleto[];
  count: number;
  view?: ViewType;
  filters?: {
    priority?: PriorityFilter;
    status?: StatusFilter;
  };
  message?: string;
};

export type PazientiStatisticsResponse = {
  success: boolean;
  data: StatistichePazienti;
  message?: string;
};

export type CittaDataResponse = {
  success: boolean;
  data: CittaData[];
  count: number;
  message?: string;
};

export type RecallMessageResponse = {
  success: boolean;
  data: {
    paziente: PazienteCompleto;
    messaggio: string;
    telefono: string;
    tipo_richiamo: string;
    data_richiamo: string | null;
  };
  message?: string;
};

export type ApiResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
};

export type PaginatedApiResponse<T = unknown> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;

export type ApiError = {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
  timestamp?: string;
  path?: string;
};

/**
 * Tipi per l'autenticazione
 */
export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  username: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserProfile;
};

export type RefreshTokenPayload = {
  refreshToken: string;
};

/**
 * Tipi per gli utenti
 */
export type UserProfile = {
  id: string;
  username: string;
  password: string;
  role: 'user' | 'admin' | 'segreteria';
  createdAt: string;
};

export type UpdateProfilePayload = Partial<{
  username: string;
  currentPassword: string;
  newPassword: string;
}>;

/**
 * Tipi generici per le risorse
 */
export type QueryParams = Partial<{
  page: number;
  pageSize: number;
  sort: string;
  filter: string;
  search: string;
  expand: string;
}>;

export type IdParam = string | number;

/**
 * Tipi per i servizi di test
 */
export type PingResponse = {
  status: 'ok';
  timestamp: string;
  environment: string;
  version: string;
};

/**
 * Utility types
 */
export type RequestConfig = {
  params?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
};

export type MutationConfig<TPayload> = RequestConfig & {
  data?: TPayload;
};

/**
 * Tipi per i richiami pazienti
 */
export type Richiamo = {
  id_paziente: string | null;
  nome_completo: string;
  telefono: string;
  tipo_codice: string;
  tipo_descrizione: string;
  tipi_codice: string[];
  tipi_descrizione: string[];
  data_richiamo: string | null;
  data_richiamo_2: string | null;
  ultima_visita: string | null;
  mesi_richiamo: number;
  giorni_scadenza: number | null;
  stato: 'scaduto' | 'in_scadenza' | 'futuro' | 'sconosciuto';
  da_richiamare: boolean;
};

export type RichiamoStatistics = {
  totale: number;
  scaduti: number;
  in_scadenza: number;
  futuri: number;
  per_tipo: Record<string, number>;
};

export type RichiamoMessage = {
  paziente: string;
  telefono: string;
  messaggio: string;
  tipo_richiamo: string;
  data_scadenza: string;
};

export type RichiamoFilters = {
  days_threshold?: number;
  status?: 'scaduto' | 'in_scadenza' | 'futuro';
  tipo?: string;
};

export type RichiamiResponse = {
  success: boolean;
  data: Richiamo[];
  count: number;
  filters: RichiamoFilters;
};

export type RichiamiStatisticsResponse = {
  success: boolean;
  data: RichiamoStatistics;
  filters: { days_threshold: number };
};

export type RichiamoMessageResponse = {
  success: boolean;
  data: RichiamoMessage;
};

export type RichiamiExportResponse = {
  success: boolean;
  data: Richiamo[];
  count: number;
  export_format: string;
  filters: { days_threshold: number };
};

export type RichiamiTestResponse = {
  success: boolean;
  test_results: {
    richiami_trovati: number;
    statistiche: RichiamoStatistics;
    service_status: string;
  };
  message: string;
};

export interface Calendar {
  id: string;
  name: string;
}

export interface SMSStatusResponse {
  mode: 'dev' | 'test' | 'prod';
  enabled: boolean;
  sender: string;
  api_configured?: boolean;
}

export interface SMSTestResponse {
  success: boolean;
  message: string;
  mode: string;
  error?: string;
}

export interface ModeResponse {
  mode: 'dev' | 'test' | 'prod';
  success?: boolean;
  error?: string;
  message?: string;
}