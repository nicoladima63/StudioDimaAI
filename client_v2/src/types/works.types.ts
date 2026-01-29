
/**
 * Types for Works, Tasks, Steps and Providers module.
 */

export interface Provider {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  type: 'internal' | 'external' | 'lab';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface StepTemplate {
  id: number;
  work_id: number;
  name: string;
  description?: string;
  order_index: number;
  user_id?: string | number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Work {
  id: number;
  name: string;
  description?: string;
  category: string; 
  provider_id?: string;
  version: number;
  steps?: StepTemplate[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Step {
  id: number;
  task_id: number;
  name: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  order_index: number;
  user_id?: string | number; // REPLACED provider_id
  completed_at?: string;
  completed_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  patient_id: string; // Link to Patient
  work_id: number;
  description?: string;
  prestazione_id?: string;
  external_ref_id?: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  steps?: Step[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Constant Mappings for UI
export const CATEGORY_COLORS: Record<string, string> = {
  '1': '#FFA500',  // Parte generale (mapped to approx color)
  '2': '#00BFFF',  // Conservativa
  '3': '#808080',  // Endodonzia
  '4': '#FFFF00',  // Parodontologia
  '5': '#FF0000',  // Chirurgia
  '6': '#FF00FF',  // Implantologia
  '7': '#008000',  // Protesi Fissa
  '8': '#008000',  // Protesi Mobile
  '9': '#FFC0CB',  // Ortodonzia
  '10': '#ADD8E6', // Pedodonzia
  '11': '#800080', // Igiene
  '12': '#FF0000', // Chirurgia implantare
  'default': '#808080'
};

export const CATEGORY_NAMES: Record<string, string> = {
  '1': 'Parte generale',
  '2': 'Conservativa',
  '3': 'Endodonzia',
  '4': 'Parodontologia',
  '5': 'Chirurgia',
  '6': 'Implantologia',
  '7': 'Protesi Fissa',
  '8': 'Protesi Mobile',
  '9': 'Ortodonzia',
  '10': 'Pedodonzia',
  '11': 'Igiene orale',
  '12': 'Chirurgia implantare'
};
