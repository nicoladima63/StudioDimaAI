import React from "react";
import { useConti, useBranche, useSottoconti } from "@/store/contiStore";

interface Props {
  contoId: number | null;
  setContoId: (id: number | null) => void;
  brancaId: number | null;
  setBrancaId: (id: number | null) => void;
  sottocontoId: number | null;
  setSottocontoId: (id: number | null) => void;
  autoSelectIfSingle?: boolean;
}

const ContoBrancaSottocontoSelect: React.FC<Props> = ({
  contoId,
  setContoId,
  brancaId,
  setBrancaId,
  sottocontoId,
  setSottocontoId,
  autoSelectIfSingle = false,
}) => {
  const { conti, isLoading: loadingConti } = useConti();
  const { branche, isLoading: loadingBranche } = contoId ? useBranche(contoId) : { branche: [], isLoading: false };
  const { sottoconti, isLoading: loadingSottoconti } = brancaId ? useSottoconti(brancaId) : { sottoconti: [], isLoading: false };

  // Auto-select conto se ce n’è uno solo
  React.useEffect(() => {
    if (autoSelectIfSingle && conti.length === 1) {
      setContoId(conti[0].id);
    }
  }, [autoSelectIfSingle, conti, setContoId]);

  // Reset branca e sottoconto quando cambia conto
  React.useEffect(() => {
    setBrancaId(null);
    setSottocontoId(null);
  }, [contoId, setBrancaId, setSottocontoId]);

  // Auto-select branca se ce n’è una sola
  React.useEffect(() => {
    if (autoSelectIfSingle && branche.length === 1) {
      setBrancaId(branche[0].id);
    }
  }, [autoSelectIfSingle, branche, setBrancaId]);

  // Reset sottoconto quando cambia branca
  React.useEffect(() => {
    setSottocontoId(null);
  }, [brancaId, setSottocontoId]);

  // Auto-select sottoconto se ce n’è uno solo
  React.useEffect(() => {
    if (autoSelectIfSingle && sottoconti.length === 1) {
      setSottocontoId(sottoconti[0].id);
    }
  }, [autoSelectIfSingle, sottoconti, setSottocontoId]);

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {/* Select Conto */}
      <select
        value={contoId ?? ""}
        onChange={(e) => setContoId(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Seleziona conto</option>
        {conti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      {loadingConti && <span>⏳</span>}

      {/* Select Branca */}
      <select
        value={brancaId ?? ""}
        onChange={(e) => setBrancaId(e.target.value ? Number(e.target.value) : null)}
        disabled={!contoId}
      >
        <option value="">Seleziona branca</option>
        {branche.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nome}
          </option>
        ))}
      </select>
      {loadingBranche && <span>⏳</span>}

      {/* Select Sottoconto */}
      <select
        value={sottocontoId ?? ""}
        onChange={(e) => setSottocontoId(e.target.value ? Number(e.target.value) : null)}
        disabled={!brancaId}
      >
        <option value="">Seleziona sottoconto</option>
        {sottoconti.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      {loadingSottoconti && <span>⏳</span>}
    </div>
  );
};

export default ContoBrancaSottocontoSelect;
