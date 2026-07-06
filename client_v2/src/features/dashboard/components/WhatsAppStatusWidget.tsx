import React, { useEffect, useState } from 'react';
import {
  CCard, CCardBody, CButton, CBadge, CSpinner,CCardHeader,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilReload, cilQrCode, cilLockLocked, cibWhatsapp } from '@coreui/icons';
import type { WaState } from '@/features/bot/types/bot.types';
import botService from '@/features/bot/services/botService';

const WA_BADGE: Record<WaState, { color: string; label: string }> = {
  open: { color: 'success', label: 'Connesso' },
  close: { color: 'warning', label: 'Disconnesso' },
  connecting: { color: 'warning', label: 'Disconnesso' },
  unknown: { color: 'warning', label: 'Disconnesso' },
};

const WhatsAppStatusWidget: React.FC = () => {
  const [waState, setWaState] = useState<WaState>('unknown');
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await botService.apiGetWaStatus();
      if (res.success) setWaState(res.data.state);
    } catch {
      setWaState('unknown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleShowQr = async () => {
    setShowQrModal(true);
    setQrLoading(true);
    setQrCode(null);
    try {
      const res = await botService.apiGetWaQr();
      if (res.success) setQrCode(res.data.qr);
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Disconnettere WhatsApp? Dovrai scansionare di nuovo il QR.')) return;
    await botService.apiLogoutWa();
    setWaState('close');
  };

  const badge = WA_BADGE[waState];

  return (
    <CCard className="mb-4 h-100">
    <CCardHeader>
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <CIcon icon={cibWhatsapp} className="me-2" />
            WhatsApp
          </h5>
        </div>
      </CCardHeader>
      <CCardBody>

        <div className="d-flex flex-column gap-2">
                    <CBadge color={badge.color} shape="rounded" className="px-3 py-2">
            {badge.label}
          </CBadge>

          <CButton color="secondary" size="sm" onClick={loadStatus} disabled={loading}>
            <CIcon icon={cilReload} className="me-1" />
            {loading ? <CSpinner size="sm" /> : 'Aggiorna'}
          </CButton>

          {waState !== 'open' && (
            <CButton color="success" size="sm" onClick={handleShowQr}>
              <CIcon icon={cilQrCode} className="me-1" />
              Riconnetti
            </CButton>
          )}

          {waState === 'open' && (
            <CButton color="danger" variant="outline" size="sm" onClick={handleLogout}>
              <CIcon icon={cilLockLocked} className="me-1" />
              Disconnetti
            </CButton>
          )}
        </div>
      </CCardBody>

      <CModal visible={showQrModal} onClose={() => setShowQrModal(false)} alignment="center">
        <CModalHeader>
          <CModalTitle>Riconnetti WhatsApp</CModalTitle>
        </CModalHeader>
        <CModalBody className="text-center">
          {qrLoading && <CSpinner color="primary" />}
          {!qrLoading && qrCode && (
            <>
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR WhatsApp"
                style={{ maxWidth: '280px', width: '100%' }}
              />
              <p className="text-muted small mt-2 mb-0">
                WhatsApp → Impostazioni → Dispositivi collegati → Collega dispositivo
              </p>
            </>
          )}
          {!qrLoading && !qrCode && (
            <p className="text-muted mb-0">QR non disponibile — istanza già connessa o Evolution non raggiungibile.</p>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowQrModal(false)}>Chiudi</CButton>
        </CModalFooter>
      </CModal>
    </CCard>
  );
};

export default WhatsAppStatusWidget;
