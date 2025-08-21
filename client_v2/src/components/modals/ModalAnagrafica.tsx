import React from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CRow,
  CCol,
  CFormLabel,
  CFormInput,
  CFormTextarea,
  CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilUser, cilX, cilList } from '@coreui/icons';
import './modals.css';

export interface CampoAnagrafica {
  key: string;
  label: string;
  value: any;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'badge';
  badgeColor?: string;
  colSize?: number;
}

export interface ModalAnagraficaProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  campi: CampoAnagrafica[];
  onViewFatture?: () => void; // Callback per aprire ModalFattureElenco
  showFattureButton?: boolean;
  size?: 'sm' | 'lg' | 'xl';
}

const ModalAnagrafica: React.FC<ModalAnagraficaProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  campi,
  onViewFatture,
  showFattureButton = true,
  size = 'lg'
}) => {

  // Render singolo campo
  const renderCampo = (campo: CampoAnagrafica) => {
    const colSize = campo.colSize || 6;
    
    if (!campo.value && campo.value !== 0) {
      return (
        <CCol md={colSize} key={campo.key} className="mb-3">
          <CFormLabel htmlFor={campo.key}><strong>{campo.label}</strong></CFormLabel>
          <CFormInput 
            type="text" 
            id={campo.key}
            value="-" 
            readOnly 
            className="form-control-plaintext text-muted"
          />
        </CCol>
      );
    }

    let inputElement;
    switch (campo.type) {
      case 'textarea':
        inputElement = (
          <CFormTextarea 
            id={campo.key}
            value={String(campo.value)} 
            readOnly 
            rows={3}
            className="form-control-plaintext"
          />
        );
        break;
      
      case 'badge':
        inputElement = (
          <div className="pt-2">
            <CBadge color={campo.badgeColor || 'primary'}>
              {String(campo.value)}
            </CBadge>
          </div>
        );
        break;
      
      case 'email':
        inputElement = (
          <CFormInput 
            type="text" 
            id={campo.key}
            value={String(campo.value)} 
            readOnly 
            className="form-control-plaintext"
          />
        );
        break;
      
      case 'tel':
        inputElement = (
          <CFormInput 
            type="text" 
            id={campo.key}
            value={String(campo.value)} 
            readOnly 
            className="form-control-plaintext"
          />
        );
        break;
      
      default:
        inputElement = (
          <CFormInput 
            type="text" 
            id={campo.key}
            value={String(campo.value)} 
            readOnly 
            className="form-control-plaintext"
          />
        );
    }

    return (
      <CCol md={colSize} key={campo.key} className="mb-3">
        <CFormLabel htmlFor={campo.key}><strong>{campo.label}</strong></CFormLabel>
        {inputElement}
      </CCol>
    );
  };

  return (
    <CModal visible={visible} onClose={onClose} size={size} scrollable className="modal-anagrafica">
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilUser} className="me-2" />
          {title}
          {subtitle && (
            <div className="text-muted fs-6 fw-normal mt-1">
              {subtitle}
            </div>
          )}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        <CRow>
          {campi.map(renderCampo)}
        </CRow>
      </CModalBody>
      
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          <CIcon icon={cilX} size="sm" className="me-1" />
          Chiudi
        </CButton>
        
        {showFattureButton && onViewFatture && (
          <CButton color="primary" onClick={onViewFatture}>
            <CIcon icon={cilList} size="sm" className="me-1" />
            Visualizza Fatture
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  );
};

export default ModalAnagrafica;