import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CSpinner,
  CAlert,
  CRow,
  CCol
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilX } from '@coreui/icons';

export interface EditModalField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'select' | 'readonly';
  required?: boolean;
  placeholder?: string;
  options?: { value: string | number; label: string }[]; // Per select
  validation?: (value: any) => string | null; // Funzione di validazione personalizzata
  disabled?: boolean;
  colSize?: number; // Dimensione colonna (1-12)
}

export interface EditModalProps<T = any> {
  visible: boolean;
  onClose: () => void;
  onSave: (data: T) => Promise<void>;
  title: string;
  data: T | null;
  fields: EditModalField[];
  loading?: boolean;
  error?: string | null;
  size?: 'sm' | 'lg' | 'xl';
}

const EditModal = <T extends Record<string, any>>({
  visible,
  onClose,
  onSave,
  title,
  data,
  fields,
  loading = false,
  error = null,
  size = 'lg'
}: EditModalProps<T>) => {
  const [formData, setFormData] = useState<T>({} as T);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or data changes
  useEffect(() => {
    if (visible && data) {
      setFormData({ ...data });
      setValidationErrors({});
    } else if (visible && !data) {
      // Nuovo oggetto - inizializza con valori vuoti
      const emptyData = fields.reduce((acc, field) => {
        acc[field.key] = '';
        return acc;
      }, {} as T);
      setFormData(emptyData);
      setValidationErrors({});
    }
  }, [visible, data, fields]);

  // Validazione campo singolo
  const validateField = (field: EditModalField, value: any): string | null => {
    // Validazione required
    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label} è obbligatorio`;
    }

    // Validazione email
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Formato email non valido';
    }

    // Validazione personalizzata
    if (field.validation && value) {
      return field.validation(value);
    }

    return null;
  };

  // Validazione completa form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    fields.forEach(field => {
      const error = validateField(field, formData[field.key]);
      if (error) {
        errors[field.key] = error;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handler cambio valore campo
  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
    
    // Rimuovi errore di validazione quando l'utente modifica il campo
    if (validationErrors[fieldKey]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[fieldKey];
        return updated;
      });
    }
  };

  // Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      // L'errore sarà gestito dal componente parent tramite la prop error
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render campo form
  const renderField = (field: EditModalField) => {
    const value = formData[field.key] || '';
    const hasError = !!validationErrors[field.key];
    const colSize = field.colSize || (field.type === 'textarea' ? 12 : 6);

    const commonProps = {
      id: field.key,
      value: value,
      invalid: hasError,
      disabled: field.disabled || loading || isSubmitting,
      placeholder: field.placeholder
    };

    let input;
    switch (field.type) {
      case 'textarea':
        input = (
          <CFormTextarea
            {...commonProps}
            rows={3}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );
        break;
      
      case 'select':
        input = (
          <select
            {...commonProps}
            className={`form-select ${hasError ? 'is-invalid' : ''}`}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          >
            <option value="">Seleziona...</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        break;

      case 'readonly':
        input = (
          <CFormInput
            {...commonProps}
            readOnly
            className="form-control-plaintext"
          />
        );
        break;

      default:
        input = (
          <CFormInput
            {...commonProps}
            type={field.type}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );
    }

    return (
      <CCol md={colSize} key={field.key}>
        <CFormLabel htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-danger ms-1">*</span>}
        </CFormLabel>
        {input}
        {hasError && (
          <div className="invalid-feedback d-block">
            {validationErrors[field.key]}
          </div>
        )}
      </CCol>
    );
  };

  return (
    <CModal 
      visible={visible} 
      onClose={onClose}
      backdrop="static"
      size={size}
    >
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      
      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
            </CAlert>
          )}
          
          <CRow className="g-3">
            {fields.map(renderField)}
          </CRow>
        </CModalBody>
        
        <CModalFooter>
          <CButton 
            color="secondary" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            <CIcon icon={cilX} size="sm" className="me-1" />
            Annulla
          </CButton>
          <CButton 
            color="primary" 
            type="submit"
            disabled={loading || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <CSpinner size="sm" className="me-1" />
                Salvando...
              </>
            ) : (
              <>
                <CIcon icon={cilSave} size="sm" className="me-1" />
                Salva
              </>
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
};

export default EditModal;