import React, { useState } from "react";
import { CForm, CRow, CCol, CFormSelect } from "@coreui/react";
import Select from "react-select";

export type PeriodoType = "mese" | "trimestre" | "quadrimestre" | "semestre" | "anno";

export interface SelectPeriodoProps {
  anniDisponibili: number[];
  onChange: (val: { anni: number[]; tipo: PeriodoType; sottoperiodo: string }) => void;
  defaultTipo?: PeriodoType;
  defaultAnni?: number[];
  defaultSottoperiodo?: string;
  disabled?: boolean;
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

const SelectPeriodo: React.FC<SelectPeriodoProps> = ({
  anniDisponibili,
  onChange,
  defaultTipo = "mese",
  defaultAnni = [],
  defaultSottoperiodo = "",
  disabled = false,
}) => {
  const [anni, setAnni] = useState<number[]>(defaultAnni);
  const [tipo, setTipo] = useState<PeriodoType>(defaultTipo);
  const [sottoperiodo, setSottoperiodo] = useState<string>(defaultSottoperiodo);

  React.useEffect(() => {
    onChange({ anni, tipo, sottoperiodo });
    // eslint-disable-next-line
  }, [anni, tipo, sottoperiodo]);

  return (
    <CForm className="mb-3">
      <CRow className="g-2 align-items-end">
        <CCol xs={12} md={4}>
          <label className="form-label">Anno</label>
          <Select
            isMulti
            options={anniDisponibili.slice().sort((a, b) => b - a).map(a => ({ value: a, label: a }))}
            value={anni.map(a => ({ value: a, label: a }))}
            onChange={opts => setAnni(opts.map(o => o.value))}
            placeholder="Seleziona anni"
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

export default SelectPeriodo;
