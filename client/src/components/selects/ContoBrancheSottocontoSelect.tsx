import React from "react";
import {
  CFormSelect,
  CSpinner,
  CRow,
  CCol
} from "@coreui/react";
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

  // Auto-select conto se ce n'è uno solo
  React.useEffect(() => {
    if (autoSelectIfSingle && conti.length === 1 && contoId !== conti[0].id) {
      setContoId(conti[0].id);
    }
  }, [autoSelectIfSingle, conti, setContoId, contoId]);

  // Reset branca e sottoconto quando cambia conto
  React.useEffect(() => {
    setBrancaId(null);
    setSottocontoId(null);
  }, [contoId, setBrancaId, setSottocontoId]);

  // Auto-select branca se ce n'è una sola
  React.useEffect(() => {
    if (autoSelectIfSingle && branche.length === 1 && brancaId !== branche[0].id) {
      setBrancaId(branche[0].id);
    }
  }, [autoSelectIfSingle, branche, setBrancaId, brancaId]);

  // Reset sottoconto quando cambia branca
  React.useEffect(() => {
    setSottocontoId(null);
  }, [brancaId, setSottocontoId]);

  // Auto-select sottoconto se ce n'è uno solo
  React.useEffect(() => {
    if (autoSelectIfSingle && sottoconti.length === 1 && sottocontoId !== sottoconti[0].id) {
      setSottocontoId(sottoconti[0].id);
    }
  }, [autoSelectIfSingle, sottoconti, setSottocontoId, sottocontoId]);

  return (
    <CRow className="g-3">
      {/* Select Conto */}
      <CCol md={4}>
        <div className="d-flex align-items-center">
          <CFormSelect
            value={contoId ?? ""}
            onChange={(e) => setContoId(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingConti}
          >
            <option value="">Seleziona conto</option>
            {conti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </CFormSelect>
          {loadingConti && <CSpinner size="sm" className="ms-2" />}
        </div>
      </CCol>

      {/* Select Branca */}
      <CCol md={4}>
        <div className="d-flex align-items-center">
          <CFormSelect
            value={brancaId ?? ""}
            onChange={(e) => setBrancaId(e.target.value ? Number(e.target.value) : null)}
            disabled={!contoId || loadingBranche}
          >
            <option value="">Seleziona branca</option>
            {branche.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </CFormSelect>
          {loadingBranche && <CSpinner size="sm" className="ms-2" />}
        </div>
      </CCol>

      {/* Select Sottoconto */}
      <CCol md={4}>
        <div className="d-flex align-items-center">
          <CFormSelect
            value={sottocontoId ?? ""}
            onChange={(e) => setSottocontoId(e.target.value ? Number(e.target.value) : null)}
            disabled={!brancaId || loadingSottoconti}
          >
            <option value="">Seleziona sottoconto</option>
            {sottoconti.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </CFormSelect>
          {loadingSottoconti && <CSpinner size="sm" className="ms-2" />}
        </div>
      </CCol>
    </CRow>
  );
};

export default ContoBrancaSottocontoSelect;
