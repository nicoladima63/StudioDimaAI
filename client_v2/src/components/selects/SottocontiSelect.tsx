import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useSottoconti } from "../../store/conti.store";

interface SottocontiSelectProps {
  brancaId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoSelectIfSingle?: boolean;
}

const SottocontiSelect: React.FC<SottocontiSelectProps> = ({
  brancaId,
  value,
  onChange,
  placeholder = "-- Seleziona sottoconto --",
  disabled = false,
  autoSelectIfSingle = false,
}) => {
  const { sottoconti, isLoading, error } = useSottoconti(brancaId);

  // Auto-select se c'è un solo sottoconto
  useEffect(() => {
    if (!isLoading && !error && sottoconti.length === 1 && autoSelectIfSingle && !value) {
      onChange(sottoconti[0].id);
    }
  }, [sottoconti, isLoading, error, autoSelectIfSingle, value, onChange]);

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || isLoading || !brancaId}
      aria-invalid={!!error}
    >
      <option value="">{placeholder}</option>
      
      {isLoading && <option disabled>Caricamento sottoconti...</option>}
      
      {error && (
        <option disabled className="text-danger">
          Errore: {error}
        </option>
      )}
      
      {sottoconti.map((sottoconto) => (
        <option key={sottoconto.id} value={sottoconto.id}>
          {sottoconto.nome}
        </option>
      ))}
    </CFormSelect>
  );
};

export default SottocontiSelect;