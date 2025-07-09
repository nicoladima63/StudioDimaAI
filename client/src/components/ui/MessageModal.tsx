import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CSpinner
} from '@coreui/react';

interface NetworkModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
  loading?: boolean;
  link?: string;
}

const NetworkModal: React.FC<NetworkModalProps> = ({ open, onClose, message, loading, link }) => {
  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Connessione di rete</CModalTitle>
      </CModalHeader>
      <CModalBody className="text-center">
        {loading && <CSpinner color="primary" className="mb-3" />}
        <div>{message}</div>
        {link && (
          <div className="mt-3">
            <a href={link} target="_blank" rel="noopener noreferrer">Apri cartella di rete</a>
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="dark" variant="outline" onClick={onClose}>Chiudi</CButton>
      </CModalFooter>
    </CModal>
  );
};

export default NetworkModal; 