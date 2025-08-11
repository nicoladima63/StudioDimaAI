// components/selects/SelectConto.tsx
import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useConti } from "@/store/contiStore";

interface SelectContoProps {
  value: number | null;
  onChange: (id: number | null) => void;
  autoSelectIfSingle?: boolean;
  disabled?: boolean;
}

const SelectConto: React.FC<SelectContoProps> = ({
  value,
  onChange,
  autoSelectIfSingle = false,
  disabled = false,
}) => {
  const { conti, isLoading, error } = useConti();


  // Auto-select if single conto is available
  useEffect(() => {
    if (!isLoading && !error && conti.length === 1 && autoSelectIfSingle && !value) {
      onChange(conti[0].id);
    }
  }, [conti, isLoading, error, autoSelectIfSingle, onChange, value]);

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || isLoading}
      aria-invalid={!!error}
    >
      <option value="">-- Seleziona conto --</option>
      
      {isLoading && <option disabled>Caricamento conti...</option>}
      
      {error && (
        <option disabled className="text-danger">
          Errore: {error}
        </option>
      )}
      
      {conti.map((conto) => (
        <option key={conto.id} value={conto.id}>
          {conto.nome}
        </option>
      ))}
    </CFormSelect>
  );
};

export default SelectConto;