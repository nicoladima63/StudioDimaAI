import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CCard,
  CCardBody,
  CCardHeader
} from '@coreui/react';
import { SimulatedAction } from '../services/simulation.service';
import CIcon from '@coreui/icons-react';
import { cilEnvelopeClosed, cilChatBubble, cilFile } from '@coreui/icons';

interface Props {
  visible: boolean;
  action: SimulatedAction | null;
  onClose: () => void;
}

const PreviewDialog: React.FC<Props> = ({ visible, action, onClose }) => {
  if (!action) return null;

  const isEmail = !!action.accountant_email;
  const isMessage = !!action.message;

  return (
    <CModal visible={visible} onClose={onClose} size="lg">
      <CModalHeader onClose={onClose}>
        <CModalTitle>Anteprima Azione Simulata</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {isMessage && (
          <CCard className="mb-3">
            <CCardHeader>
              <CIcon icon={cilChatBubble} className="me-2" />
              Messaggio di {action.type === 'recall' ? 'Richiamo' : 'Reminder'}
            </CCardHeader>
            <CCardBody>
              <div className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>
                {action.message}
              </div>
              <div className="mt-2 small text-muted">
                <strong>Destinatario:</strong> {action.patient_name} ({action.phone})<br />
                <strong>Canale:</strong> {action.channel}
              </div>
            </CCardBody>
          </CCard>
        )}

        {isEmail && (
          <>
            <CCard className="mb-3 border-danger">
              <CCardHeader className="bg-danger text-white">
                <CIcon icon={cilFile} className="me-2" />
                Salvataggio PDF (Locale)
              </CCardHeader>
              <CCardBody>
                <div className="mb-2">
                  <strong>File:</strong> {action.attachment_name}
                </div>
                <div>
                  <strong>Percorso:</strong> <span className="font-monospace small">{action.save_path}</span>
                </div>
                <div className="mt-3 p-3 border rounded bg-light text-center">
                  <CIcon icon={cilFile} size="xl" className="text-danger mb-2" />
                  <div>[ANTEPRIMA PDF SIMULATA]</div>
                </div>
              </CCardBody>
            </CCard>

            <CCard className="mb-3">
              <CCardHeader>
                <CIcon icon={cilEnvelopeClosed} className="me-2" />
                Email per il Commercialista
              </CCardHeader>
              <CCardBody>
                <div className="mb-2">
                  <strong>A:</strong> {action.accountant_email?.to}
                </div>
                <div className="mb-2">
                  <strong>Oggetto:</strong> {action.accountant_email?.subject}
                </div>
                <hr />
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {action.accountant_email?.body}
                </div>
                <div className="mt-3 small text-muted italic">
                  * Allegato: {action.attachment_name}
                </div>
              </CCardBody>
            </CCard>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Chiudi
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default PreviewDialog;
