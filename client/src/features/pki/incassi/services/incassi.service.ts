import apiClient from '@/api/client';

export const getIncassiByDate = (anno: string, mese?: string) => {
  const params: any = { anno };
  if (mese) params.mese = mese;
  return apiClient.get('/api/incassi/by_dat@e', { params });
};

export const getIncassiByPeriodo = (anno: string, tipo: string, numero: string) => {
  return apiClient.get('/api/incassi/by_periodo', {
    params: { anno, tipo, numero },
  });
};

export const getAllIncassi = () => {
  return apiClient.get('/api/incassi/all');
}; 