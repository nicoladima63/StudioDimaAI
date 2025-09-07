import React, { useState, useEffect } from "react";
import { CForm, CRow, CCol, CFormSelect } from "@coreui/react";
import Select from 'react-select';

export type PeriodoType = "mese" | "trimestre" | "quadrimestre" | "semestre" | "anno";

export interface PeriodoSelectProps {
  anniDisponibili: number[];
  onChange: (val: { anni: number[]; tipo: PeriodoType; sottoperiodo: string }) => void;
  defaultTipo?: PeriodoType;
  defaultAnni?: number[];
  defaultSottoperiodo?: string;
  disabled?: boolean;
  className?: string;
}

const PERIODI: { value: PeriodoType; label: string }[] = [
  { value: "mese", label: "Mese" },
  { value: "trimestre", label: "Trimestre" },
  { value: "quadrimestre", label: "Quadrimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "anno", label: "Anno intero" },
];

const SOTTOPERIODI: Record<PeriodoType, { value: string; label: string }[]> = {
  mese: [
    { value: "1", label: "Gennaio" },
    { value: "2", label: "Febbraio" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Aprile" },
    { value: "5", label: "Maggio" },
    { value: "6", label: "Giugno" },
    { value: "7", label: "Luglio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Settembre" },
    { value: "10", label: "Ottobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Dicembre" },
  ],
  trimestre: [
    { value: "1", label: "Primo trimestre" },
    { value: "2", label: "Secondo trimestre" },
    { value: "3", label: "Terzo trimestre" },
    { value: "4", label: "Quarto trimestre" },
  ],
  quadrimestre: [
    { value: "1", label: "Primo quadrimestre" },
    { value: "2", label: "Secondo quadrimestre" },
    { value: "3", label: "Terzo quadrimestre" },
  ],
  semestre: [
    { value: "1", label: "Primo semestre" },
    { value: "2", label: "Secondo semestre" },
  ],
  anno: [
    { value: "", label: "Anno intero" },
  ],
};

const PeriodoSelect: React.FC<PeriodoSelectProps> = ({
  anniDisponibili,
  onChange,
  defaultTipo = "mese",
  defaultAnni = [],
  defaultSottoperiodo = "",
  disabled = false,
  className = ""
}) => {
  const [anni, setAnni] = useState<number[]>(defaultAnni);
  const [tipo, setTipo] = useState<PeriodoType>(defaultTipo);
  const [sottoperiodo, setSottoperiodo] = useState<string>(defaultSottoperiodo);

  useEffect(() => {
    onChange({ anni, tipo, sottoperiodo });
  }, [anni, tipo, sottoperiodo]);

  // Prepara le opzioni per react-select
  const anniOptions = anniDisponibili
    .slice() // copia per non mutare la prop
    .sort((a, b) => b - a) // ordina decrescente
    .map(anno => ({ value: anno, label: anno.toString() }));

  // Valori selezionati per react-select
  const selectedAnniValues = anni.map(anno => ({ value: anno, label: anno.toString() }));

  return (
    <CForm className={`mb-3 ${className}`}>
      <CRow className="g-2 align-items-end">
        <CCol xs={12} md={4}>
          <label className="form-label">Anni</label>
          <Select
            isMulti
            options={anniOptions}
            value={selectedAnniValues}
            onChange={(opts) => {
              const anniNumerici = opts ? opts.map(o => o.value).sort((a, b) => b - a) : [];
              setAnni(anniNumerici);
            }}
            placeholder="Seleziona anni..."
            closeMenuOnSelect={false}
            isDisabled={disabled}
            styles={{
              control: base => ({ ...base, minHeight: 38, fontSize: 16 }),
              multiValue: base => ({ ...base, fontSize: 15 })
            }}
          />
        </CCol>
        <CCol xs={12} md={4}>
          <CFormSelect
            label="Tipo periodo"
            value={tipo}
            onChange={e => {
              setTipo(e.target.value as PeriodoType);
              setSottoperiodo("");
            }}
            disabled={disabled}
          >
            {PERIODI.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol xs={12} md={4}>
          <CFormSelect
            label="Sottoperiodo"
            value={sottoperiodo}
            onChange={e => setSottoperiodo(e.target.value)}
            disabled={disabled || tipo === "anno"}
          >
            {SOTTOPERIODI[tipo].map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </CFormSelect>
        </CCol>
      </CRow>
    </CForm>
  );
};

export default PeriodoSelect;
