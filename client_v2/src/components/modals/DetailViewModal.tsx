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
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPanel
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilX, cilInfo } from '@coreui/icons';

export interface DetailViewField {
  key: string;
  label: string;
  value: any;
  type?: 'text' | 'email' | 'tel' | 'badge' | 'date' | 'currency' | 'link';
  badgeColor?: string; // Per type 'badge'
  colSize?: number; // Dimensione colonna (1-12)
  section?: string; // Sezione di appartenenza
}

export interface DetailViewSection {
  key: string;
  title: string;
  icon?: any;
  fields: DetailViewField[];
  component?: React.ReactNode; // Componente personalizzato per la sezione
}

export interface DetailViewModalProps {
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  title: string;
  subtitle?: string;
  sections: DetailViewSection[];
  actions?: Array<{
    label: string;
    color: string;
    icon?: any;
    onClick: () => void;
  }>;
  size?: 'sm' | 'lg' | 'xl';
  useTabs?: boolean; // Se true, usa i tab per le sezioni
}

const DetailViewModal: React.FC<DetailViewModalProps> = ({
  visible,
  onClose,
  onEdit,
  title,
  subtitle,
  sections,
  actions = [],
  size = 'xl',
  useTabs = true
}) => {
  // Render valore campo
  const renderFieldValue = (field: DetailViewField) => {
    if (!field.value && field.value !== 0) {
      return <span className="text-muted">-</span>;
    }

    switch (field.type) {
      case 'email':
        return (
          <a href={`mailto:${field.value}`} className="text-decoration-none">
            {field.value}
          </a>
        );
      
      case 'tel':
        return (
          <a href={`tel:${field.value}`} className="text-decoration-none">
            {field.value}
          </a>
        );
      
      case 'link':
        return (
          <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
            {field.value}
          </a>
        );
      
      case 'badge':
        return (
          <CBadge color={field.badgeColor || 'primary'}>
            {field.value}
          </CBadge>
        );
      
      case 'date':
        return new Date(field.value).toLocaleDateString('it-IT');
      
      case 'currency':
        return new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: 'EUR'
        }).format(field.value);
      
      default:
        return String(field.value);
    }
  };

  // Render singolo campo
  const renderField = (field: DetailViewField) => {
    const colSize = field.colSize || 6;

    return (
      <CCol md={colSize} key={field.key} className="mb-3">
        <div className="detail-field">
          <label className="form-label text-muted small fw-bold mb-1">
            {field.label}
          </label>
          <div className="field-value">
            {renderFieldValue(field)}
          </div>
        </div>
      </CCol>
    );
  };

  // Render sezione
  const renderSection = (section: DetailViewSection) => {
    if (section.component) {
      return section.component;
    }

    return (
      <CRow className="g-3">
        {section.fields.map(renderField)}
      </CRow>
    );
  };

  // Render con tabs
  const renderWithTabs = () => (
    <CTabs activeItemKey={sections[0]?.key}>
      <CTabList variant="tabs">
        {sections.map(section => (
          <CTab itemKey={section.key} key={section.key}>
            {section.icon && <CIcon icon={section.icon} className="me-1" />}
            {section.title}
          </CTab>
        ))}
      </CTabList>
      <CTabContent className="pt-3">
        {sections.map(section => (
          <CTabPanel itemKey={section.key} key={section.key}>
            {renderSection(section)}
          </CTabPanel>
        ))}
      </CTabContent>
    </CTabs>
  );

  // Render con cards
  const renderWithCards = () => (
    <div className="detail-sections">
      {sections.map(section => (
        <CCard key={section.key} className="mb-3">
          <CCardHeader>
            <h6 className="mb-0">
              {section.icon && <CIcon icon={section.icon} className="me-2" />}
              {section.title}
            </h6>
          </CCardHeader>
          <CCardBody>
            {renderSection(section)}
          </CCardBody>
        </CCard>
      ))}
    </div>
  );

  return (
    <CModal 
      visible={visible} 
      onClose={onClose}
      backdrop="static"
      size={size}
    >
      <CModalHeader>
        <CModalTitle>
          <CIcon icon={cilInfo} className="me-2" />
          {title}
          {subtitle && (
            <div className="text-muted fs-6 fw-normal mt-1">
              {subtitle}
            </div>
          )}
        </CModalTitle>
      </CModalHeader>
      
      <CModalBody>
        {sections.length === 0 ? (
          <div className="text-center text-muted py-4">
            <CIcon icon={cilInfo} size="3xl" className="mb-3" />
            <p>Nessun dettaglio disponibile</p>
          </div>
        ) : (
          useTabs ? renderWithTabs() : renderWithCards()
        )}
      </CModalBody>
      
      <CModalFooter>
        <CButton 
          color="secondary" 
          onClick={onClose}
        >
          <CIcon icon={cilX} size="sm" className="me-1" />
          Chiudi
        </CButton>
        
        {/* Azioni personalizzate */}
        {actions.map((action, index) => (
          <CButton 
            key={index}
            color={action.color} 
            onClick={action.onClick}
          >
            {action.icon && <CIcon icon={action.icon} size="sm" className="me-1" />}
            {action.label}
          </CButton>
        ))}
        
        {/* Pulsante Edit standard */}
        {onEdit && (
          <CButton 
            color="primary" 
            onClick={onEdit}
          >
            <CIcon icon={cilPencil} size="sm" className="me-1" />
            Modifica
          </CButton>
        )}
      </CModalFooter>
    </CModal>
  );
};

export default DetailViewModal;