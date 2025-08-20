/**
 * Types per sistema gestione ambienti V2
 * Definizioni TypeScript complete per environment management
 */

// === Enums ===

export enum Environment {
  DEV = "dev",
  TEST = "test", 
  PROD = "prod"
}

export enum ServiceType {
  DATABASE = "database",
  RICETTA = "ricetta", 
  SMS = "sms",
  RENTRI = "rentri"
}

// === Core Types ===

export interface EnvironmentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: Record<string, boolean>;
}

export interface ServiceConfig {
  service_type: ServiceType;
  current_environment: Environment;
  available_environments: Environment[];
  config_data: Record<string, any>;
  validation: EnvironmentValidation;
}

export interface ServiceStatus {
  service: ServiceType;
  current_environment: Environment;
  available_environments: Environment[];
  configuration: Record<string, any>;
  validation: EnvironmentValidation;
}

// === API Response Types ===

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status_code?: number;
}

export interface EnvironmentStatusResponse extends ApiResponse {
  data: {
    services: Record<string, ServiceStatus>;
    system_info: {
      instance_dir: string;
      cache_size: number;
      initialized: boolean;
    };
  };
}

export interface ServiceEnvironmentResponse extends ApiResponse {
  data: {
    service: string;
    current_environment: string;
    available_environments: string[];
    configuration: Record<string, any>;
    validation: EnvironmentValidation;
  };
}

export interface SwitchEnvironmentRequest {
  environment: string;
}

export interface SwitchEnvironmentResponse extends ApiResponse {
  data: {
    service: string;
    previous_environment: string;
    current_environment: string;
    validation: EnvironmentValidation;
    message: string;
  };
}

export interface BulkSwitchRequest {
  changes: Record<string, string>;
}

export interface BulkSwitchResponse extends ApiResponse {
  data: {
    total_changes: number;
    successful_changes: number;
    failed_changes: number;
    results: Record<string, {
      success: boolean;
      environment: string;
      message: string;
    }>;
  };
}

// === Service Specific Types ===

// Database Service
export interface DatabaseConfig {
  type: 'local' | 'network';
  path: string;
  host?: string;
  validation_required: boolean;
  network_check: boolean;
}

export interface DatabaseStatus {
  environment: Environment;
  type: 'local' | 'network';
  path: string;
  is_network: boolean;
  connection: {
    available: boolean;
    details: ConnectionTestResult;
  };
  validation: EnvironmentValidation;
}

// SMS Service  
export interface SMSConfig {
  api_key: string;
  sender: string;
  enabled: boolean;
  url: string;
}

export interface SMSStatus {
  environment: Environment;
  enabled: boolean;
  api_key_configured: boolean;
  sender: string;
  url: string;
  validation: EnvironmentValidation;
}

export interface SMSTestResult {
  success: boolean;
  environment: Environment;
  account_info?: {
    company_name: string;
    email: string;
    plan_type: string;
  };
  sender: string;
  message: string;
  error?: string;
  status_code?: number;
}

// Ricetta Service (estende types esistenti)
export interface RicettaConfig {
  endpoints: Record<string, string>;
  ssl: {
    client_cert: string;
    client_key?: string;
    ca_cert?: string;
    verify_ssl: boolean;
  };
  credentials: Record<string, string>;
  timeouts: {
    connection: number;
    read: number;
    total: number;
  };
}

// Rentri Service
export interface RentriConfig {
  private_key_path: string;
  client_id: string;
  client_audience: string;
  token_url: string;
  api_base: string;
}

export interface RentriStatus {
  environment: Environment;
  configured: boolean;
  api_base: string;
  token_url: string;
  client_id_configured: boolean;
  private_key_exists: boolean;
  has_valid_token: boolean;
  validation: EnvironmentValidation;
}

// === Test & Validation Types ===

export interface ConnectionTestResult {
  success: boolean;
  environment: Environment;
  endpoint?: string;
  status_code?: number;
  certificates?: Record<string, boolean>;
  ssl_version?: string;
  message: string;
  error?: string;
  details?: Record<string, any>;
}

export interface ValidationTestRequest {
  environment?: string;
}

export interface TestConnectionRequest {
  environment?: string;
}

// === Store Types ===

export interface EnvironmentStoreState {
  // Ambienti correnti per servizio
  environments: Record<ServiceType, Environment>;
  
  // Configurazioni servizi 
  configurations: Record<ServiceType, Record<string, any>>;
  
  // Stati validazione
  validations: Record<ServiceType, EnvironmentValidation>;
  
  // Stato generale
  isLoading: boolean;
  error: string | null;
  lastUpdated: Record<ServiceType, number>;
  
  // Test connessioni
  connectionTests: Record<ServiceType, ConnectionTestResult | null>;
  
  // Cache configurazioni
  configCache: Record<string, any>;
  cacheTimestamps: Record<string, number>;
}

export interface EnvironmentStoreActions {
  // Environment management
  getEnvironment: (service: ServiceType) => Environment;
  setEnvironment: (service: ServiceType, environment: Environment) => Promise<boolean>;
  bulkSetEnvironments: (changes: Record<ServiceType, Environment>) => Promise<Record<ServiceType, boolean>>;
  
  // Configuration management
  loadServiceConfig: (service: ServiceType, environment?: Environment) => Promise<void>;
  getServiceConfig: (service: ServiceType, environment?: Environment) => Record<string, any>;
  refreshConfigurations: () => Promise<void>;
  
  // Validation
  validateService: (service: ServiceType, environment?: Environment) => Promise<EnvironmentValidation>;
  validateAllServices: () => Promise<Record<ServiceType, EnvironmentValidation>>;
  
  // Testing
  testConnection: (service: ServiceType, environment?: Environment) => Promise<ConnectionTestResult>;
  testAllConnections: () => Promise<Record<ServiceType, ConnectionTestResult>>;
  
  // Cache management
  clearCache: () => void;
  invalidateServiceCache: (service: ServiceType) => void;
  
  // Status
  getServiceStatus: (service: ServiceType) => Promise<ServiceStatus>;
  getAllServicesStatus: () => Promise<Record<ServiceType, ServiceStatus>>;
  
  // Utilities
  isServiceConfigured: (service: ServiceType) => boolean;
  isServiceValid: (service: ServiceType) => boolean;
  reload: () => Promise<void>;
}

// === Component Props Types ===

// Base Environment Switch
export interface EnvironmentSwitchProps {
  service: ServiceType;
  label?: string;
  icon?: React.ReactNode;
  onModeChange?: (environment: Environment) => void;
  validation?: (environment: Environment) => Promise<boolean>;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

// Environment Card
export interface EnvironmentCardProps {
  service: ServiceType;
  title: string;
  description?: string;
  badge?: {
    success: string;
    warning: string; 
    danger: string;
  };
  showTestButton?: boolean;
  showStatus?: boolean;
  compact?: boolean;
  onEnvironmentChange?: (environment: Environment) => void;
  onTest?: () => void;
}

// Environment Panel
export interface ServiceConfig {
  service: ServiceType;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: {
    success: string;
    warning: string;
    danger: string;
  };
}

export interface EnvironmentPanelProps {
  services: ServiceConfig[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  showGlobalActions?: boolean;
  title?: string;
  collapsible?: boolean;
  onBulkChange?: (changes: Record<ServiceType, Environment>) => void;
  onTestAll?: () => void;
}

// Environment Status Badge
export interface EnvironmentStatusProps {
  service: ServiceType;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

// Advanced Components
export interface EnvironmentDashboardProps {
  showAdvancedOptions?: boolean;
  refreshInterval?: number;
  onConfigurationChange?: (service: ServiceType, environment: Environment) => void;
}

export interface EnvironmentTestPanelProps {
  services?: ServiceType[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  onTestComplete?: (results: Record<ServiceType, ConnectionTestResult>) => void;
}

export interface EnvironmentValidatorProps {
  service?: ServiceType;
  environment?: Environment;
  onValidationComplete?: (validation: EnvironmentValidation) => void;
  showDetails?: boolean;
}

// === Hook Types ===

export interface UseEnvironmentSwitchReturn {
  currentEnvironment: Environment;
  availableEnvironments: Environment[];
  isLoading: boolean;
  isValid: boolean;
  switch: (environment: Environment) => Promise<boolean>;
  test: () => Promise<ConnectionTestResult>;
  validate: () => Promise<EnvironmentValidation>;
  config: Record<string, any>;
  status: ServiceStatus | null;
}

export interface UseEnvironmentValidationReturn {
  validation: EnvironmentValidation | null;
  isValidating: boolean;
  validate: (service: ServiceType, environment?: Environment) => Promise<EnvironmentValidation>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UseEnvironmentTestReturn {
  testResult: ConnectionTestResult | null;
  isTesting: boolean;
  test: (service: ServiceType, environment?: Environment) => Promise<ConnectionTestResult>;
  isConnected: boolean;
  lastTested: number | null;
}

export interface UseEnvironmentBulkReturn {
  bulkSwitch: (changes: Record<ServiceType, Environment>) => Promise<Record<ServiceType, boolean>>;
  bulkTest: (services?: ServiceType[]) => Promise<Record<ServiceType, ConnectionTestResult>>;
  bulkValidate: (services?: ServiceType[]) => Promise<Record<ServiceType, EnvironmentValidation>>;
  isProcessing: boolean;
  results: Record<ServiceType, any> | null;
}

// === Automation Settings (compatibilità v1) ===

export interface AutomationSettings {
  reminder_enabled: boolean;
  reminder_hour: number;
  reminder_minute: number;
  sms_promemoria_mode: 'test' | 'prod';
  sms_richiami_mode: 'test' | 'prod';
  recall_enabled: boolean;
  recall_hour: number;
  recall_minute: number;
  calendar_sync_enabled: boolean;
  calendar_sync_hour: number;
  calendar_sync_minute: number;
  calendar_studio_blu_id?: string;
  calendar_studio_giallo_id?: string;
}

// === Error Types ===

export interface EnvironmentError {
  code: string;
  message: string;
  service?: ServiceType;
  environment?: Environment;
  details?: Record<string, any>;
}

export interface ValidationError extends EnvironmentError {
  field?: string;
  validation_type: 'required' | 'format' | 'connection' | 'configuration';
}

export interface ServiceError extends EnvironmentError {
  status_code?: number;
  retry_after?: number;
}

// === Utility Types ===

export type EnvironmentStoreSelector<T> = (state: EnvironmentStoreState & EnvironmentStoreActions) => T;

export interface EnvironmentConfig {
  cache_duration: number;
  max_retries: number;
  retry_delay: number;
  test_timeout: number;
  validation_timeout: number;
}

// === Export Types for Convenience ===

export type AllServiceTypes = keyof typeof ServiceType;
export type AllEnvironments = keyof typeof Environment;

// Default configurations
export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  cache_duration: 5 * 60 * 1000, // 5 minuti
  max_retries: 3,
  retry_delay: 1000,
  test_timeout: 10000,
  validation_timeout: 5000
};

export const SERVICE_DISPLAY_NAMES: Record<ServiceType, string> = {
  [ServiceType.DATABASE]: 'Database',
  [ServiceType.RICETTA]: 'Ricetta Elettronica',
  [ServiceType.SMS]: 'SMS',
  [ServiceType.RENTRI]: 'Rentri'
};

export const ENVIRONMENT_DISPLAY_NAMES: Record<Environment, string> = {
  [Environment.DEV]: 'Sviluppo',
  [Environment.TEST]: 'Test',
  [Environment.PROD]: 'Produzione'
};

export const ENVIRONMENT_COLORS: Record<Environment, string> = {
  [Environment.DEV]: 'secondary',
  [Environment.TEST]: 'warning', 
  [Environment.PROD]: 'success'
};

export const SERVICE_ICONS: Record<ServiceType, string> = {
  [ServiceType.DATABASE]: 'database',
  [ServiceType.RICETTA]: 'medical',
  [ServiceType.SMS]: 'chat',
  [ServiceType.RENTRI]: 'building'
};