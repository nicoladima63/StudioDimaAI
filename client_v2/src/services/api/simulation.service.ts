import { baseService } from './base.service';

export interface SimulatedAction {
  patient_id?: string;
  patient_name?: string;
  phone?: string;
  channel?: string;
  type?: string;
  appointment_date?: string;
  appointment_time?: string;
  message?: string;
  scheduled_date?: string;
  recall_type_names?: string[];
  // For emails
  email_id?: string;
  original_subject?: string;
  original_date?: string;
  attachment_name?: string;
  save_path?: string;
  accountant_email?: {
    to: string;
    subject: string;
    body: string;
  };
}

export interface SimulationResults {
  timestamp: string;
  reminders: SimulatedAction[];
  recalls: SimulatedAction[];
  emails: SimulatedAction[];
}

class SimulationService {
  async runSimulation(): Promise<SimulationResults> {
    const response = await baseService.post<SimulationResults>('/simulation/run', {});
    return response.data;
  }

  async getResults(): Promise<SimulationResults> {
    const response = await baseService.get<SimulationResults>('/simulation/results');
    return response.data;
  }
}

export const simulationService = new SimulationService();
