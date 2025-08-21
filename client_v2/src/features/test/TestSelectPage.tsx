import React, { useState } from "react";
import PeriodoSelect, { type PeriodoType } from "../../components/selects/PeriodoSelect";
import FornitoriSelect from "../../components/selects/FornitoriSelect";
import ContiSelect from "../../components/selects/ContiSelect";
import BrancheSelect from "../../components/selects/BrancheSelect";
import MaterialiSelect from "../../components/selects/MaterialiSelect";
import SottocontiSelect from "../../components/selects/SottocontiSelect";
import { CCard, CCardBody, CCardHeader, CRow, CCol, CBadge } from "@coreui/react";

// Import real types from store
import type { Fornitore } from "../../store/fornitori.store";

// Types per i test
// interface Fornitore {  // Rimosso - usiamo quello vero dal store
//   id: number;
//   nome: string;
//   codice?: string;
// }

interface Materiale {
  id: number;
  descrizione: string;
  codice?: string;
}

interface PeriodoValue {
  anni: number[];
  tipo: PeriodoType;
  sottoperiodo: string;
}

const TestSelectPage: React.FC = () => {
  const anniDisponibili = [2025, 2024, 2023];
  const [periodo, setPeriodo] = useState<PeriodoValue>({ 
    anni: [2025], 
    tipo: "mese" as PeriodoType, 
    sottoperiodo: "" 
  });

  // Stati per le altre select
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);
  const [fornitoreId, setFornitoreId] = useState<string | null>(null);
  const [fornitore, setFornitore] = useState<Fornitore | null>(null);
  const [materiale, setMateriale] = useState<Materiale | null>(null);

  // Handler per il cambio fornitore
  const handleFornitoreChange = (selectedFornitore: Fornitore | null) => {
    const id = selectedFornitore ? selectedFornitore.id : null;
    setFornitoreId(id);
    setFornitore(selectedFornitore);
    // Reset materiale quando cambia fornitore
    setMateriale(null);
  };

  // Handler per il cambio materiale
  const handleMaterialeChange = (id: number | null, selectedMateriale?: Materiale) => {
    setMateriale(selectedMateriale || null);
  };

  return (
    <CCard className="mt-4">
      <CCardHeader>
        <h5 className="mb-0">🧪 Test delle Select Components</h5>
      </CCardHeader>
      <CCardBody>
        {/* Sezione Periodo */}
        <div className="mb-4">
          <h6 className="text-primary mb-3">Selezione Periodo</h6>
          <CRow>
            <CCol lg={8} xl={6}>
              <PeriodoSelect
                anniDisponibili={anniDisponibili}
                onChange={setPeriodo}
                defaultAnni={[2025]}
              />
            </CCol>
          </CRow>
          <div className="mt-2 p-2 bg-light rounded">
            <small className="text-muted">
              <strong>Risultato:</strong>{' '}
              <CBadge color="info">{periodo.anni.join(", ")}</CBadge>{' '}
              <CBadge color="secondary">{periodo.tipo}</CBadge>{' '}
              {periodo.sottoperiodo && <CBadge color="warning">{periodo.sottoperiodo}</CBadge>}
              {!periodo.sottoperiodo && <span className="text-muted">Tutto il periodo</span>}
            </small>
          </div>
        </div>

        {/* Sezione Gerarchia Conti */}
        <div className="mb-4">
          <h6 className="text-primary mb-3">Gerarchia Conti → Branche → Sottoconti</h6>
          <CRow>
            <CCol md={6} lg={4} className="mb-3">
              <ContiSelect 
                value={contoId} 
                onChange={(id) => {
                  setContoId(id);
                  setBrancaId(null); // Reset dipendenti
                  setSottocontoId(null);
                }} 
              />
              <div className="mt-1">
                <small className="text-muted">ID: </small>
                <CBadge color={contoId ? "success" : "secondary"}>
                  {contoId ?? 'Nessuno'}
                </CBadge>
              </div>
            </CCol>
            <CCol md={6} lg={4} className="mb-3">
              <BrancheSelect 
                contoId={contoId} 
                value={brancaId} 
                onChange={(id) => {
                  setBrancaId(id);
                  setSottocontoId(null); // Reset dipendenti
                }} 
              />
              <div className="mt-1">
                <small className="text-muted">ID: </small>
                <CBadge color={brancaId ? "success" : "secondary"}>
                  {brancaId ?? 'Nessuno'}
                </CBadge>
              </div>
            </CCol>
            <CCol md={6} lg={4} className="mb-3">
              <SottocontiSelect 
                brancaId={brancaId} 
                value={sottocontoId} 
                onChange={setSottocontoId} 
              />
              <div className="mt-1">
                <small className="text-muted">ID: </small>
                <CBadge color={sottocontoId ? "success" : "secondary"}>
                  {sottocontoId ?? 'Nessuno'}
                </CBadge>
              </div>
            </CCol>
          </CRow>
        </div>

        {/* Sezione Fornitori e Materiali */}
        <div className="mb-4">
          <h6 className="text-primary mb-3">Fornitori → Materiali</h6>
          <CRow>
            <CCol md={6} lg={4} className="mb-3">
              <FornitoriSelect 
                value={fornitoreId} 
                onChange={handleFornitoreChange} 
              />
              <div className="mt-1">
                <small className="text-muted">
                  {fornitore ? (
                    <>
                      <CBadge color="success">{fornitore.id}</CBadge>
                      {' - '}
                      <span>{fornitore.nome}</span>
                    </>
                  ) : (
                    <CBadge color="secondary">Nessun fornitore</CBadge>
                  )}
                </small>
              </div>
            </CCol>
            <CCol md={6} lg={4} className="mb-3">
              <MaterialiSelect 
                fornitoreId={fornitoreId || undefined} 
                value={materiale?.id ?? null} 
                onChange={handleMaterialeChange} 
              />
              <div className="mt-1">
                <small className="text-muted">
                  {materiale ? (
                    <>
                      <CBadge color="success">{materiale.id}</CBadge>
                      {' - '}
                      <span>{materiale.descrizione}</span>
                    </>
                  ) : (
                    <CBadge color="secondary">Nessun materiale</CBadge>
                  )}
                </small>
              </div>
            </CCol>
          </CRow>
        </div>

        {/* Sezione Riepilogo */}
        <div className="mt-4 p-3 bg-light rounded">
          <h6 className="text-primary mb-2">📊 Riepilogo Selezioni</h6>
          <div className="row text-sm">
            <div className="col-md-6">
              <strong>Periodo:</strong> {periodo.anni.join(", ")} ({periodo.tipo})
            </div>
            <div className="col-md-6">
              <strong>Gerarchia:</strong> {contoId ?? "-"} / {brancaId ?? "-"} / {sottocontoId ?? "-"}
            </div>
            <div className="col-md-6">
              <strong>Fornitore:</strong> {fornitore?.nome ?? "Non selezionato"}
            </div>
            <div className="col-md-6">
              <strong>Materiale:</strong> {materiale?.descrizione ?? "Non selezionato"}
            </div>
          </div>
        </div>
      </CCardBody>
    </CCard>
  );
};

export default TestSelectPage;
