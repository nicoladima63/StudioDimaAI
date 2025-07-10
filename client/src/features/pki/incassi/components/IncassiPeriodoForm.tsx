import React, { useState } from 'react';
import { CForm, CRow, CCol, CFormSelect, CButton } from '@coreui/react';
import Select from 'react-select';

interface IncassiPeriodoFormProps {
  onSubmit: (params: { anni: number[]; tipo: string; numero: string }) => void;
  anniDisponibili: number[];
}

const IncassiPeriodoForm: React.FC<IncassiPeriodoFormProps> = ({ onSubmit, anniDisponibili }) => {
  const [anni, setAnni] = useState<number[]>([]);
  const [tipo, setTipo] = useState('mese');
  const [numero, setNumero] = useState('');

  const getNumeroOptions = () => {
    switch (tipo) {
      case 'mese':
        return [
          { value: 1, label: 'Gennaio' },
          { value: 2, label: 'Febbraio' },
          { value: 3, label: 'Marzo' },
          { value: 4, label: 'Aprile' },
          { value: 5, label: 'Maggio' },
          { value: 6, label: 'Giugno' },
          { value: 7, label: 'Luglio' },
          { value: 8, label: 'Agosto' },
          { value: 9, label: 'Settembre' },
          { value: 10, label: 'Ottobre' },
          { value: 11, label: 'Novembre' },
          { value: 12, label: 'Dicembre' },
        ];
      case 'trimestre':
        return [
          { value: 1, label: 'Primo trimestre' },
          { value: 2, label: 'Secondo trimestre' },
          { value: 3, label: 'Terzo trimestre' },
          { value: 4, label: 'Quarto trimestre' },
        ];
      case 'quadrimestre':
        return [
          { value: 1, label: 'Primo quadrimestre' },
          { value: 2, label: 'Secondo quadrimestre' },
          { value: 3, label: 'Terzo quadrimestre' },
        ];
      case 'semestre':
        return [
          { value: 1, label: 'Primo semestre' },
          { value: 2, label: 'Secondo semestre' },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (anni.length > 0 && tipo && numero) {
      onSubmit({ anni, tipo, numero });
    }
  };

  return (
    <CForm onSubmit={handleSubmit} className="mb-3">
      <CRow className="g-2 align-items-end">
        <CCol xs={12} md={4}>
          <label className="form-label">Anno</label>
          <Select
            isMulti
            options={anniDisponibili
              .slice() // copia per non mutare la prop
              .sort((a, b) => b - a) // ordina decrescente
              .map(a => ({ value: a, label: a }))}
            value={anni.map(a => ({ value: a, label: a }))}
            onChange={opts => setAnni(opts.map(o => o.value))}
            placeholder="Seleziona anni"
            closeMenuOnSelect={false}
            styles={{
              control: base => ({ ...base, minHeight: 38, fontSize: 16 }),
              multiValue: base => ({ ...base, fontSize: 15 })
            }}
          />
        </CCol>
        <CCol xs={12} md={4}>
          <CFormSelect
            label="Tipo"
            value={tipo}
            onChange={e => {
              setTipo(e.target.value);
              setNumero(''); // reset numero quando cambia tipo
            }}
          >
            <option value="mese">Mese</option>
            <option value="trimestre">Trimestre</option>
            <option value="quadrimestre">Quadrimestre</option>
            <option value="semestre">Semestre</option>
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={3}>
          <CFormSelect
            label="Numero"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            required
          >
            <option value="">Seleziona</option>
            {getNumeroOptions().map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={1}>
          <CButton color="primary" type="submit" className="w-100">Cerca</CButton>
        </CCol>
      </CRow>
    </CForm>
  );
};

export default IncassiPeriodoForm; 