import { useState } from "react";
import SelectConto from "@/components/selects/SelectConto";
import { SelectBranca } from "@/components/selects/SelectBranca";
import { SelectSottoconto } from "@/components/selects/SelectSottoconto";

export default function EsempioForm() {
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  return (
    <div>
      <SelectConto value={contoId} onChange={setContoId} autoSelectIfSingle />
      <SelectBranca contoId={contoId} value={brancaId} onChange={setBrancaId} autoSelectIfSingle />
      <SelectSottoconto brancaId={brancaId} value={sottocontoId} onChange={setSottocontoId} autoSelectIfSingle />
    </div>
  );
}
