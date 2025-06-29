/**
 * Tipi base per le risposte API
 */
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

