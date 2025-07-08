import React, { useState } from 'react';
import { CForm, CRow, CCol, CFormInput, CFormSelect, CButton } from '@coreui/react';

interface IncassiPeriodoFormProps {
  onSubmit: (params: { anno: string; tipo: string; numero: string }) => void;
}

const IncassiPeriodoForm: React.FC<IncassiPeriodoFormProps> = ({ onSubmit }) => {
  const [anno, setAnno] = useState('');
  const [tipo, setTipo] = useState('mese');
  const [numero, setNumero] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anno && tipo && numero) {
      onSubmit({ anno, tipo, numero });
    }
  };

  return (
    <CForm onSubmit={handleSubmit} className="mb-3">
      <CRow className="g-2 align-items-end">
        <CCol xs={12} md={4}>
          <CFormInput
            type="number"
            label="Anno"
            placeholder="Anno"
            value={anno}
            onChange={e => setAnno(e.target.value)}
            min="2000"
            max="2100"
            required
          />
        </CCol>
        <CCol xs={12} md={4}>
          <CFormSelect
            label="Tipo"
            value={tipo}
            onChange={e => setTipo(e.target.value)}
          >
            <option value="mese">Mese</option>
            <option value="trimestre">Trimestre</option>
            <option value="quadrimestre">Quadrimestre</option>
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={3}>
          <CFormInput
            type="number"
            label="Numero"
            placeholder="Numero"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            min="1"
            max={tipo === 'mese' ? '12' : tipo === 'trimestre' ? '4' : '3'}
            required
          />
        </CCol>
        <CCol xs={12} md={1}>
          <CButton color="primary" type="submit" className="w-100">Cerca</CButton>
        </CCol>
      </CRow>
    </CForm>
  );
};

export default IncassiPeriodoForm; 