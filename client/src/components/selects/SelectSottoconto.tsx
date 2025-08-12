// components/selects/SelectSottoconto.tsx
import React, { useEffect } from "react";
import { CFormSelect } from "@coreui/react";
import { useSottoconti } from "@/store/contiStore";

interface SelectSottocontoProps {
  brancaId: number | null;
  value: number | null;
  onChange: (id: number | null) => void;
  autoSelectIfSingle?: boolean;
  disabled?: boolean;
}

export const SelectSottoconto: React.FC<SelectSottocontoProps> = ({
  brancaId,
  value,
  onChange,
  autoSelectIfSingle = false,
  disabled = false,
}) => {
  const { sottoconti, isLoading, error } = useSottoconti(brancaId);

  useEffect(() => {
    onChange(null); // reset quando cambia branca
  }, [brancaId]);

  useEffect(() => {
    if (
      brancaId &&
      !isLoading &&
      sottoconti.length === 1 &&
      autoSelectIfSingle &&
      value !== sottoconti[0].id  // Evita loop se già selezionato
    ) {
      onChange(sottoconti[0].id);
    }
  }, [sottoconti, isLoading, autoSelectIfSingle, brancaId, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue ? Number(selectedValue) : null);
  };

  return (
    <CFormSelect
      value={value ?? ""}
      onChange={handleChange}
      disabled={disabled || !brancaId || isLoading}
      aria-invalid={!!error}
    >
      <option value="">-- Seleziona sottoconto --</option>
      
      {isLoading && <option disabled>Caricamento sottoconti...</option>}
      
      {error && (
        <option disabled className="text-danger">
          Errore: {error}
        </option>
      )}
      
      {sottoconti.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nome}
        </option>
      ))}
    </CFormSelect>
  );
};
