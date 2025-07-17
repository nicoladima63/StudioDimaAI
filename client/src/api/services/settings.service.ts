// @/api/services/settings.service.ts

export interface ModeResponse {
  mode: 'dev' | 'test' | 'prod';
  success?: boolean;
  error?: string;
  message?: string;
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

export const getMode = async (tipo: 'database' | 'rentri' | 'ricetta' | 'sms'): Promise<'dev' | 'test' | 'prod'> => {
  const response = await fetch(`/api/settings/${tipo}-mode`);
  const data: ModeResponse = await response.json();
  return data.mode;
};

export const setMode = async (
  tipo: 'database' | 'rentri' | 'ricetta' | 'sms', 
  mode: 'dev' | 'test' | 'prod'
): Promise<ModeResponse> => {
  const response = await fetch(`/api/settings/${tipo}-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  });
  
  const data: ModeResponse = await response.json();
  return data;
};

// Nuove funzioni specifiche per SMS
export const getSMSStatus = async (): Promise<SMSStatusResponse> => {
  const response = await fetch('/api/settings/sms/status');
  if (!response.ok) {
    throw new Error('Failed to get SMS status');
  }
  return response.json();
};

export const testSMSConnection = async (): Promise<SMSTestResponse> => {
  const response = await fetch('/api/settings/sms/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return response.json();
};

export const ping = async () => {
  const response = await fetch('/api/ping');
  return response.json();
};