import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CAlert,
  CSpinner
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash, cilX, cilWarning } from '@coreui/icons';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemName: string;
  itemType: string; // es. "fornitore", "paziente", "fattura"
  warning?: string; // Messaggio di avvertimento aggiuntivo
  details?: Array<{ label: string; value: string }>; // Dettagli aggiuntivi da mostrare
  loading?: boolean;
  error?: string | null;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  warning,
  details = [],
  loading = false,
  error = null
}) => {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // L'errore sarà gestito dal componente parent tramite la prop error
    }
  };

  return (
    <CModal 
      visible={visible} 
      onClose={onClose}
      backdrop="static"
      size="md"
    >
      <CModalHeader>
        <CModalTitle className="text-danger">
          <CIcon icon={cilWarning} className="me-2" />
          {title}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        {error && (
          <CAlert color="danger" className="mb-3">
            {error}
          </CAlert>
        )}
        
        <div className="text-center mb-4">
          <div className="display-1 text-danger mb-3">
            <CIcon icon={cilTrash} />
          </div>
          
          <h5 className="mb-3">
            Sei sicuro di voler eliminare {itemType}:
          </h5>
          
          <div className="bg-light p-3 rounded mb-3">
            <strong className="fs-5">{itemName}</strong>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mb-3">
            <h6 className="text-muted mb-2">Dettagli:</h6>
            <div className="bg-light p-3 rounded">
              {details.map((detail, index) => (
                <div key={index} className="d-flex justify-content-between mb-1">
                  <span className="text-muted">{detail.label}:</span>
                  <strong>{detail.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {warning && (
          <CAlert color="warning" className="mb-0">
            <CIcon icon={cilWarning} className="me-2" />
            <strong>Attenzione:</strong> {warning}
          </CAlert>
        )}

        <div className="text-muted small mt-3 text-center">
          <strong>Questa azione non può essere annullata!</strong>
        </div>
      </CModalBody>
      
      <CModalFooter className="justify-content-center">
        <CButton 
          color="secondary" 
          onClick={onClose}
          disabled={loading}
          size="lg"
        >
          <CIcon icon={cilX} size="sm" className="me-1" />
          Annulla
        </CButton>
        <CButton 
          color="danger" 
          onClick={handleConfirm}
          disabled={loading}
          size="lg"
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-1" />
              Eliminando...
            </>
          ) : (
            <>
              <CIcon icon={cilTrash} size="sm" className="me-1" />
              Elimina Definitivamente
            </>
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  );
};

export default ConfirmDeleteModal;