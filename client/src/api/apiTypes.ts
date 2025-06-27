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

