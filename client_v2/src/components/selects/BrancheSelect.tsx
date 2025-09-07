import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useBranche } from "../../store/conti.store";

interface BrancheSelectProps {
  contoId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoSelectIfSingle?: boolean;
}

const BrancheSelect: React.FC<BrancheSelectProps> = ({
  contoId,
  value,
  onChange,
  placeholder = "-- Seleziona branca --",
  disabled = false,
  autoSelectIfSingle = false,
}) => {
  const { branche, isLoading, error } = useBranche(contoId);

  // Auto-select se c'è una sola branca
  useEffect(() => {
    if (!isLoading && !error && branche.length === 1 && autoSelectIfSingle && !value) {
      onChange(branche[0].id);
    }
  }, [branche, isLoading, error, autoSelectIfSingle, value, onChange]);

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || isLoading || !contoId}
      aria-invalid={!!error}
    >
      <option value="">{placeholder}</option>
      
      {isLoading && <option disabled>Caricamento branche...</option>}
      
      {error && (
        <option disabled className="text-danger">
          Errore: {error}
        </option>
      )}
      
      {branche.map((branca) => (
        <option key={branca.id} value={branca.id}>
          {branca.nome}
        </option>
      ))}
    </CFormSelect>
  );
};

export default BrancheSelect;