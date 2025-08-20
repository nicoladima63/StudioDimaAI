import React from "react";
import { CFormSelect, CRow, CCol } from "@coreui/react";

export type TimeRangeSelectProps = {
  anniDisponibili: number[];
  anno: number | null;
  setAnno: (anno: number) => void;
  mese?: string;
  setMese?: (mese: string) => void;
  giorniDisponibili?: number[];
  giorno?: number | null;
  setGiorno?: (giorno: number) => void;
  showMese?: boolean;
  showGiorno?: boolean;
  disabled?: boolean;
};

const MONTHS = [
  { value: '', label: 'Tutti i mesi' },
  { value: '1', label: 'Gennaio' },
  { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' },
  { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' },
  { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Dicembre' },
];

const TimeRangeSelect: React.FC<TimeRangeSelectProps> = ({
  anniDisponibili,
  anno,
  setAnno,
  mese = '',
  setMese,
  giorniDisponibili = [],
  giorno = null,
  setGiorno,
  showMese = true,
  showGiorno = false,
  disabled = false,
}) => (
  <CRow className="g-2">
    <CCol xs={12} md={4}>
      <CFormSelect
        label="Anno"
        value={anno || ''}
        onChange={e => setAnno(Number(e.target.value))}
        disabled={disabled}
      >
        {anniDisponibili.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </CFormSelect>
    </CCol>
    {showMese && setMese && (
      <CCol xs={12} md={4}>
        <CFormSelect
          label="Mese"
          value={mese}
          onChange={e => setMese(e.target.value)}
          disabled={disabled}
        >
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </CFormSelect>
      </CCol>
    )}
    {showGiorno && setGiorno && (
      <CCol xs={12} md={4}>
        <CFormSelect
          label="Giorno"
          value={giorno || ''}
          onChange={e => setGiorno(Number(e.target.value))}
          disabled={disabled}
        >
          <option value="">Tutti i giorni</option>
          {giorniDisponibili.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </CFormSelect>
      </CCol>
    )}
  </CRow>
);

export default TimeRangeSelect;
