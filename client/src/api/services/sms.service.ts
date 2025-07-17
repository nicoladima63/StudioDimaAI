// src/api/services/sms.service.ts - Updated with apiClient

import apiClient from '@/api/client';

export interface SMSRequest {
  to_number: string;
  message: string;
  sender?: string;
}

export interface SMSRecallRequest {
  richiamo_id?: string;
  richiamo_data?: {
    telefono: string;
    nome_completo: string;
    tipo_richiamo?: string;
    data_richiamo?: string;
    messaggio_personalizzato?: string;
    [key: string]: any;
  };
}

export interface SMSBulkRequest {
  richiami: Array<{
    telefono: string;
    nome_completo: string;
    tipo_richiamo?: string;
    data_richiamo?: string;
    messaggio?: string;
    [key: string]: any;
  }>;
}

export interface SMSResponse {
  success: boolean;
  result?: any;
  mode?: string;
  message_id?: string | number;
  error?: string;
}

export interface SMSBulkResponse {
  success: boolean;
  summary: {
    total: number;
    success: number;
    errors: number;
  };
  results: Array<{
    index: number;
    telefono: string;
    result: SMSResponse;
  }>;
}

export interface SMSStatusResponse {
  mode: string;
  enabled: boolean;
  sender: string;
  api_configured: boolean;
}

class SMSService {
  private baseUrl = '/api/sms';

  /**
   * Invia un SMS generico
   */
  async sendSMS(request: SMSRequest): Promise<SMSResponse> {
    const response = await apiClient.post<SMSResponse>(`${this.baseUrl}/send`, request);
    return response.data;
  }

  /**
   * Invia un SMS di richiamo
   */
  async sendRecallSMS(request: SMSRecallRequest): Promise<SMSResponse> {
    const response = await apiClient.post<SMSResponse>(`${this.baseUrl}/send-recall`, request);
    return response.data;
  }

  /**
   * Invia SMS in blocco
   */
  async sendBulkSMS(request: SMSBulkRequest): Promise<SMSBulkResponse> {
    const response = await apiClient.post<SMSBulkResponse>(`${this.baseUrl}/send-bulk`, request);
    return response.data;
  }

  /**
   * Ottiene lo stato del servizio SMS
   */
  async getStatus(): Promise<SMSStatusResponse> {
    const response = await apiClient.get<SMSStatusResponse>(`${this.baseUrl}/status`);
    return response.data;
  }

  /**
   * Invia un SMS di richiamo usando solo i dati del richiamo
   */
  async sendRecallSMSByData(richiamo: {
    telefono: string;
    nome_completo: string;
    tipo_richiamo?: string;
    data_richiamo?: string;
    messaggio_personalizzato?: string;
    [key: string]: any;
  }): Promise<SMSResponse> {
    return this.sendRecallSMS({
      richiamo_data: richiamo
    });
  }

  /**
   * Invia un SMS di richiamo usando l'ID del richiamo
   */
  async sendRecallSMSById(richiamo_id: string): Promise<SMSResponse> {
    return this.sendRecallSMS({
      richiamo_id
    });
  }

  /**
   * Genera anteprima messaggio SMS per un richiamo
   */
  async previewRecallMessage(richiamo_data: {
    nome_completo: string;
    tipo_richiamo?: string;
    data_richiamo?: string;
    [key: string]: any;
  }): Promise<{
    success: boolean;
    preview?: string;
    stats?: {
      length: number;
      estimated_sms_parts: number;
    };
    error?: string;
  }> {
    const response = await apiClient.post('/api/sms/templates/richiamo/preview', { data: richiamo_data });
    return response.data;
  }

  /**
   * Genera anteprima messaggio SMS per promemoria appuntamento
   */
  async previewAppointmentMessage(appuntamento_data: {
    nome_completo: string;
    data_appuntamento?: string;
    ora_appuntamento?: string;
    tipo_appuntamento?: string;
    medico?: string;
    [key: string]: any;
  }): Promise<{
    success: boolean;
    preview?: string;
    stats?: {
      length: number;
      estimated_sms_parts: number;
    };
    error?: string;
  }> {
    const response = await apiClient.post('/api/sms/templates/promemoria/preview', { data: appuntamento_data });
    return response.data;
  }
}

// Istanza singleton del servizio
export const smsService = new SMSService();

// Esporta anche la classe per casi d'uso avanzati
export { SMSService };