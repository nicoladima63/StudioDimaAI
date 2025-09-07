import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useConti } from "@/store/conti.store";

interface ContiSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoSelectIfSingle?: boolean;
}

const ContiSelect: React.FC<ContiSelectProps> = ({
  value,
  onChange,
  placeholder = "-- Seleziona conto --",
  disabled = false,
  autoSelectIfSingle = false,
}) => {
  const { conti, isLoading, error } = useConti();

  // Auto-select se c'è un solo conto
  useEffect(() => {
    if (!isLoading && !error && conti.length === 1 && autoSelectIfSingle && !value) {
      onChange(conti[0].id);
    }
  }, [conti, isLoading, error, autoSelectIfSingle, value, onChange]);

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || isLoading}
      aria-invalid={!!error}
    >
      <option value="">{placeholder}</option>
      
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

export default ContiSelect;