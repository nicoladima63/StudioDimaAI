// components/selects/SelectBranca.tsx
import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useBranche } from "@/store/contiStore";

interface SelectBrancaProps {
  contoId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  autoSelectIfSingle?: boolean;
  disabled?: boolean;
}

export const SelectBranca: React.FC<SelectBrancaProps> = ({
  contoId,
  value,
  onChange,
  autoSelectIfSingle = false,
  disabled = false,
}) => {
  const { branche, isLoading, error } = useBranche(contoId);

  useEffect(() => {
    // Reset solo se il value attuale non è più valido per questo contoId
    if (value && branche.length > 0 && !branche.some(b => b.id === value)) {
      onChange(null);
    }
  }, [contoId, branche, value, onChange]);

  useEffect(() => {
    if (
      contoId &&
      !isLoading &&
      branche.length === 1 &&
      autoSelectIfSingle &&
      value !== branche[0].id  // Evita loop se già selezionato
    ) {
      onChange(branche[0].id);
    }
  }, [branche, isLoading, autoSelectIfSingle, contoId, onChange, value]);

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : null)
      }
      disabled={disabled || !contoId || isLoading}
      aria-invalid={!!error}
    >
      <option value="">-- Seleziona branca --</option>
      
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
