// src/components/SMSPreviewModal.tsx

import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormTextarea,
  CSpinner,
  CBadge,
  CAlert,
  CCard,
  CCardBody,
  CRow,
  CCol,
  CFormLabel,
  CFormSelect
} from '@coreui/react';
import { smsService, type SMSResponse } from '@/api/services/sms.service';
import { useSMSStore } from '@/store/smsStore';
import apiClient from '@/api/client';
import type { PazienteCompleto } from '@/lib/types';
import { createTrackedLink, getTipiMessaggi } from '@/api/services/smsTracking.service';

interface SMSPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  paziente: PazienteCompleto | null;
  onSMSSent?: (result: SMSResponse) => void;
}

const SMSPreviewModal: React.FC<SMSPreviewModalProps> = ({
  visible,
  onClose,
  paziente,
  onSMSSent
}) => {
  // SMS Store
  const { mode: smsMode, isEnabled, canSendSMS } = useSMSStore();

  // State
  const [message, setMessage] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewStats, setPreviewStats] = useState<{
    length: number;
    estimated_sms_parts: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipiMessaggio, setTipiMessaggio] = useState<any[]>([]);
  const [selectedTipoMessaggioId, setSelectedTipoMessaggioId] = useState<number | null>(null);
  const [trackedLink, setTrackedLink] = useState<string | null>(null);

  // Load message when modal opens
  useEffect(() => {
    if (visible && paziente) {
      loadInitialData();
    } else {
      resetModal();
    }
  }, [visible, paziente]);

  // Effetti a catena: selezione tipo -> generazione link -> preview messaggio
  useEffect(() => {
    if (message) {
      setPreviewStats({
        length: message.length,
        estimated_sms_parts: Math.ceil(message.length / 160)
      });
    }
  }, [message]);
  
  useEffect(() => {
    if (selectedTipoMessaggioId && paziente) {
      generateTrackedLink(paziente.DB_CODE, selectedTipoMessaggioId);
    }
  }, [selectedTipoMessaggioId, paziente]);

  useEffect(() => {
    if (trackedLink) {
      loadMessagePreview(trackedLink);
    }
  }, [trackedLink]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const tipi = await getTipiMessaggi();
      setTipiMessaggio(tipi);
      // Pre-seleziona il promemoria richiamo se esiste
      const defaultTipo = tipi.find(t => t.codice === 'PROMEMORIA_RICHIAMO');
      if (defaultTipo) {
        setSelectedTipoMessaggioId(defaultTipo.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento tipi messaggio');
    } finally {
      setLoading(false);
    }
  };

  const generateTrackedLink = async (pazienteId: string, tipoMessaggioId: number) => {
    try {
      setLoading(true);
      const linkData = await createTrackedLink(pazienteId, tipoMessaggioId);
      setTrackedLink(linkData.full_link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore generazione link');
      setLoading(false);
    }
  };

  const loadMessagePreview = async (link: string) => {
    if (!paziente) return;

    try {
      setLoading(true);
      setError(null);

      const richiamo_data = {
        nome_completo: paziente.nome_completo,
        telefono: paziente.numero_contatto || '',
        tipo_richiamo: paziente.tipo_richiamo_desc || 'Controllo',
        data_richiamo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT'), // +7 giorni
        tracked_link: link // <-- Inseriamo il link tracciabile!
      };

      // Generate preview using backend with apiClient
      const response = await apiClient.post('/api/sms/templates/richiamo/preview', { data: richiamo_data });

      if (response.data.success) {
        let msg = response.data.preview;
        // Rimuovi la parentesi con Sconosciuto o con il placeholder
        msg = msg.replace(/\s*\(Sconosciuto\)/g, '').replace(/\s*\(\{tipo_richiamo\}\)/g, '');
        setMessage(msg);
        setOriginalMessage(msg);
        setPreviewStats(response.data.stats);
      } else {
        throw new Error(response.data.error || 'Errore generazione messaggio');
      }

    } catch (error) {
      console.error('Errore caricamento preview:', error);
      setError(error instanceof Error ? error.message : 'Errore sconosciuto');
      
      // Generazione messaggio SMS semplificata in fallback
      const messaggioBase = `Ciao ${paziente?.nome_completo},\n\nTi ricordo che è tempo per il tuo richiamo.`;
      setMessage(messaggioBase);
      setOriginalMessage(messaggioBase);
    } finally {
      setLoading(false);
    }
  };

  const sendSMS = async () => {
    if (!paziente || !message.trim()) return;

    try {
      setSending(true);
      setError(null);

      const richiamo_data = {
        nome_completo: paziente.nome_completo,
        telefono: paziente.numero_contatto || '',
        tipo_richiamo: paziente.tipo_richiamo_desc || 'Controllo',
        data_richiamo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')
      };

      const result = await smsService.sendRecallSMSByData({
        ...richiamo_data,
        messaggio_personalizzato: message !== originalMessage ? message : undefined
      });

      if (onSMSSent) {
        onSMSSent(result);
      }

      // Close modal on success
      if (result.success) {
        onClose();
      }

    } catch (error) {
      console.error('Errore invio SMS:', error);
      setError(error instanceof Error ? error.message : 'Errore invio SMS');
    } finally {
      setSending(false);
    }
  };

  const resetModal = () => {
    setMessage('');
    setOriginalMessage('');
    setPreviewStats(null);
    setError(null);
    setLoading(false);
    setSending(false);
  };

  const restoreOriginal = () => {
    setMessage(originalMessage);
  };

  if (!paziente) return null;

  const hasCustomizations = message !== originalMessage;
  const canSend = canSendSMS() && paziente.numero_contatto && message.trim();

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      size="lg"
      backdrop="static"
    >
      <CModalHeader>
        <CModalTitle>
          📱 Invia SMS a {paziente.nome_completo}
        </CModalTitle>
      </CModalHeader>

      <CModalBody>
        {/* Patient Info */}
        <CCard color="light" className="mb-3">
          <CCardBody>
            <CRow>
              <CCol md={6}>
                <strong>Paziente:</strong> {paziente.nome_completo}
                <br />
                <strong>Codice:</strong> {paziente.DB_CODE}
              </CCol>
              <CCol md={6}>
                <strong>Telefono:</strong> {paziente.numero_contatto || (
                  <span className="text-danger">Nessun numero</span>
                )}
                <br />
                <strong>Modalità SMS:</strong> <CBadge color={smsMode === 'prod' ? 'success' : 'warning'}>
                  {smsMode === 'prod' ? 'Produzione' : 'Test'}
                </CBadge>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {/* Error Alert */}
        {error && (
          <CAlert color="danger" className="mb-3">
            <strong>Errore:</strong> {error}
          </CAlert>
        )}

        {/* Service Status Check */}
        {!isEnabled() && (
          <CAlert color="warning" className="mb-3">
            <strong>SMS non disponibile:</strong> Il servizio SMS non è attivo. 
            Verifica le impostazioni nella sezione Configurazione.
          </CAlert>
        )}

        {!paziente.numero_contatto && (
          <CAlert color="danger" className="mb-3">
            <strong>Numero mancante:</strong> Il paziente non ha un numero di telefono configurato.
          </CAlert>
        )}

        {/* Message Editor */}
        <div className="mb-3">
          <CFormLabel htmlFor="tipo-messaggio-select">Tipo di Messaggio</CFormLabel>
          <CFormSelect
            id="tipo-messaggio-select"
            value={selectedTipoMessaggioId ?? ''}
            onChange={(e) => setSelectedTipoMessaggioId(Number(e.target.value))}
            disabled={loading}
          >
            <option value="">Seleziona un tipo...</option>
            {tipiMessaggio.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </CFormSelect>
        </div>
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <CFormLabel>Messaggio SMS</CFormLabel>
            <div className="d-flex gap-2">
              {hasCustomizations && (
                <CButton
                  color="secondary"
                  size="sm"
                  onClick={restoreOriginal}
                  disabled={loading}
                >
                  🔄 Ripristina
                </CButton>
              )}
              {previewStats && (
                <div className="d-flex gap-2">
                  <CBadge color={previewStats.length > 160 ? 'warning' : 'info'}>
                    {previewStats.length} caratteri
                  </CBadge>
                  {previewStats.estimated_sms_parts > 1 && (
                    <CBadge color="warning">
                      {previewStats.estimated_sms_parts} SMS
                    </CBadge>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <CSpinner color="primary" />
              <p className="mt-2 mb-0">Caricamento messaggio...</p>
            </div>
          ) : (
            <CFormTextarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Il messaggio SMS apparirà qui..."
              style={{ fontFamily: 'monospace' }}
            />
          )}

          {hasCustomizations && (
            <small className="text-info mt-1 d-block">
              ✏️ Messaggio personalizzato (diverso dal template)
            </small>
          )}
        </div>

        {/* Preview Box */}
        {message && !loading && (
          <CCard color="info" className="mb-3">
            <CCardBody>
              <h6 className="text-info">📱 Anteprima SMS</h6>
              <div 
                style={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  backgroundColor: '#f8f9fa',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}
              >
                {message}
              </div>
            </CCardBody>
          </CCard>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton
          color="secondary"
          onClick={onClose}
          disabled={sending}
        >
          Annulla
        </CButton>
        
        <CButton
          color="primary"
          onClick={sendSMS}
          disabled={!canSend || sending || loading}
        >
          {sending ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Invio in corso...
            </>
          ) : (
            <>
              📤 Invia SMS
              {previewStats && previewStats.estimated_sms_parts > 1 && 
                ` (${previewStats.estimated_sms_parts} parti)`
              }
            </>
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default SMSPreviewModal;