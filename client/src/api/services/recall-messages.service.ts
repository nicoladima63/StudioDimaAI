// src/api/services/recall-messages.service.ts
// Gestione messaggi di richiamo e invio SMS

import apiClient from '@/api/client';

export async function getRecallMessage(tipo: string = 'richiamo') {
  const response = await apiClient.get(`/api/recall-messages/?tipo=${tipo}`);
  return response.data;
}

export async function saveRecallMessage({
  id,
  tipo,
  testo,
}: {
  id?: number;
  tipo: string;
  testo: string;
}) {
  if (id) {
    const response = await apiClient.put(`/api/recall-messages/${id}`, { testo, tipo });
    return response.data;
  } else {
    const response = await apiClient.post('/api/recall-messages/', { testo, tipo });
    return response.data;
  }
}

export async function sendRecallSMS({
  id_paziente,
  telefono,
  testo,
  tipo = 'richiamo',
}: {
  id_paziente: string;
  telefono: string;
  testo: string;
  tipo?: string;
}) {
  const response = await apiClient.post('/api/recall-messages/send-reminder', {
    id_paziente,
    telefono,
    testo,
    tipo,
  });
  return response.data;
}

export async function testRecallSMS({
  telefono,
  testo,
}: {
  telefono: string;
  testo: string;
}) {
  const response = await apiClient.post('/api/recall-messages/test-sms', {
    telefono,
    testo,
  });
  return response.data;
}
