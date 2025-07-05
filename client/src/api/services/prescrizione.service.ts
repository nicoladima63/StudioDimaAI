import apiClient from '../apiClient';

export const getDiagnosi = (q: string) =>
  apiClient.get('/api/diagnosi', { params: { q } }).then(res => res.data);

export const getFarmaci = (q: string) =>
  apiClient.get('/api/farmaci', { params: { q } }).then(res => res.data); 