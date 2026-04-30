import React, { useEffect, useState } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CSpinner,
} from '@coreui/react';
import type { Paziente } from '@/store/pazienti.store';
import { marketingService, type MarketingTemplate } from '../services/marketing.service';

interface BroadcastModalProps {
  visible: boolean;
  onClose: () => void;
  pazienti: Paziente[];  // gia filtrati e con cellulare
}

const BroadcastModal: React.FC<BroadcastModalProps> = ({ visible, onClose, pazienti }) => {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [testo, setTesto] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setResult(null);
    setSelectedTemplateId('');
    setTesto('');
    setLoading(true);
    marketingService.apiGetTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleTemplateChange = (id: string) => {
    const tid = id === '' ? '' : Number(id);
    setSelectedTemplateId(tid);
    if (tid !== '') {
      const tpl = templates.find((t) => t.id === tid);
      if (tpl) setTesto(tpl.testo);
    }
  };

  const primoNome = pazienti[0]?.nome?.split(' ')[0] || 'Mario';
  const preview = testo.replace('{nome}', primoNome);

  const handleSend = async () => {
    if (!testo.trim() || pazienti.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const dest = pazienti.map((p) => ({
        id: p.id,
        nome: p.nome,
        cellulare: p.cellulare || '',
      }));
      const res = await marketingService.apiBroadcast(dest, testo);
      setResult({ sent: res.sent, failed: res.failed, errors: res.errors });
    } catch (e: any) {
      setResult({ sent: 0, failed: pazienti.length, errors: [e.message || 'Errore invio'] });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <CModal visible={visible} onClose={handleClose} size="lg" backdrop="static">
      <CModalHeader>
        Invia WhatsApp — {pazienti.length} destinatari
      </CModalHeader>

      <CModalBody>
        {loading && <div className="text-center py-3"><CSpinner size="sm" /> Caricamento template...</div>}

        {!loading && (
          <>
            <div className="mb-3">
              <CFormLabel className="fw-semibold">Template</CFormLabel>
              <CFormSelect
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">-- Scegli un template o scrivi libero --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </CFormSelect>
            </div>

            <div className="mb-3">
              <CFormLabel className="fw-semibold">
                Testo messaggio <small className="text-muted fw-normal">(variabile disponibile: {'{nome}'})</small>
              </CFormLabel>
              <CFormTextarea
                rows={5}
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="Scrivi il messaggio... usa {nome} per il nome del paziente"
              />
              <small className="text-muted">{testo.length} caratteri</small>
            </div>

            {testo && (
              <div className="mb-3 p-3 rounded bg-body-tertiary text-body border border-secondary-subtle">
                <small className="text-body-secondary fw-semibold d-block mb-1">
                  Anteprima (primo destinatario: {primoNome})
                </small>
                <span style={{ whiteSpace: 'pre-wrap' }}>{preview}</span>
              </div>
            )}

            {result && (
              <CAlert color={result.failed === 0 ? 'success' : result.sent > 0 ? 'warning' : 'danger'}>
                <strong>Invio completato:</strong>{' '}
                <CBadge color="success" className="me-1">{result.sent} inviati</CBadge>
                {result.failed > 0 && <CBadge color="danger">{result.failed} falliti</CBadge>}
                {result.errors.length > 0 && (
                  <ul className="mb-0 mt-2 small">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </CAlert>
            )}
          </>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" onClick={handleClose} disabled={sending}>
          {result ? 'Chiudi' : 'Annulla'}
        </CButton>
        {!result && (
          <CButton
            color="success"
            onClick={handleSend}
            disabled={sending || !testo.trim() || pazienti.length === 0}
          >
            {sending
              ? <><CSpinner size="sm" className="me-1" />Invio in corso...</>
              : `Invia a ${pazienti.length} pazienti`
            }
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  );
};

export default BroadcastModal;
