import apiClient from "./client";
import type { ApiResponse } from "../../types/environment.types";

interface AutomationSettings {
  reminder_enabled?: boolean;
  reminder_hour?: number;
  reminder_minute?: number;
  sms_promemoria_mode?: string;
  sms_richiami_mode?: string;
  recall_enabled?: boolean;
  recall_hour?: number;
  recall_minute?: number;
  calendar_sync_enabled?: boolean;
  calendar_sync_hour?: number;
  calendar_sync_minute?: number;
}

interface GetAutomationSettingsResponse extends ApiResponse {
  data?: AutomationSettings;
}

interface SetAutomationSettingsResponse extends ApiResponse {
  message?: string;
}

export const getAutomationSettings = async (): Promise<GetAutomationSettingsResponse> => {
  try {
    const response = await apiClient.get('/automation/settings');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || 'Errore nel recupero delle impostazioni di automazione',
      error: error.response?.data?.error || 'FETCH_SETTINGS_FAILED',
    };
  }
};

export const setAutomationSettings = async (settings: AutomationSettings): Promise<SetAutomationSettingsResponse> => {
  try {
    const response = await apiClient.post('/automation/settings', settings);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || 'Errore nel salvataggio delle impostazioni di automazione',
      error: error.response?.data?.error || 'SAVE_SETTINGS_FAILED',
    };
  }
};
