import React, { useState, useEffect } from "react";
import { CBadge, CButton, CTooltip, CSpinner } from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPencil, cilTrash, cilPlus } from "@coreui/icons";
import ClassificazioneGerarchica from "./ClassificazioneGerarchica";
import type { ClassificazioneCosto } from "../types";
import { useConti, useBranche, useSottoconti } from "@/store/conti.store";

interface ClassificazioneStatusProps {
  fornitoreId: string;
  fornitoreNome?: string;
  classificazione: ClassificazioneCosto | null;
  onClassificazioneChange?: (
    contoid: number | null,
    brancaid: number | null,
    sottocontoid: number | null
  ) => void;
}

const ClassificazioneStatus: React.FC<ClassificazioneStatusProps> = ({
  fornitoreId,
  fornitoreNome,
  classificazione,
  onClassificazioneChange,
}) => {
  const [showEdit, setShowEdit] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [contoNome, setContoNome] = useState<string>("");
  const [brancaNome, setBrancaNome] = useState<string>("");
  const [sottocontoNome, setSottocontoNome] = useState<string>("");

  // Hooks per ottenere i nomi
  const { conti, isLoading: contiLoading } = useConti();
  const { branche, isLoading: brancheLoading } = useBranche(
    classificazione?.contoid || null
  );
  const { sottoconti, isLoading: sottocontiLoading } = useSottoconti(
    classificazione?.brancaid || null
  );

  // Aggiorna i nomi quando cambiano i dati
  useEffect(() => {
    if (classificazione && conti.length > 0) {
      const conto = conti.find((c) => c.id === classificazione.contoid);
      setContoNome(conto?.nome || `Conto ID: ${classificazione.contoid}`);
    } else {
      setContoNome("");
    }
  }, [classificazione, conti]);

  useEffect(() => {
    if (classificazione?.brancaid && branche.length > 0) {
      const branca = branche.find((b) => b.id === classificazione.brancaid);
      setBrancaNome(branca?.nome || `Branca ID: ${classificazione.brancaid}`);
    } else {
      setBrancaNome("");
    }
  }, [classificazione, branche]);

  useEffect(() => {
    if (classificazione?.sottocontoid && sottoconti.length > 0) {
      const sottoconto = sottoconti.find(
        (s) => s.id === classificazione.sottocontoid
      );
      setSottocontoNome(
        sottoconto?.nome || `Sottoconto ID: ${classificazione.sottocontoid}`
      );
    } else {
      setSottocontoNome("");
    }
  }, [classificazione, sottoconti]);

  // Determina il tipo di classificazione
  const getClassificationType = () => {
    if (!classificazione) return "non_classificato";

    const hasContoid = classificazione.contoid && classificazione.contoid > 0;
    const hasBrancaid =
      classificazione.brancaid && classificazione.brancaid > 0;
    const hasSottocontoid =
      classificazione.sottocontoid && classificazione.sottocontoid > 0;

    if (hasContoid && hasBrancaid && hasSottocontoid) {
      return "completo";
    } else if (
      hasContoid &&
      (!classificazione.brancaid ||
        classificazione.brancaid === 0 || // Solo conto
        (hasBrancaid &&
          (!classificazione.sottocontoid ||
            classificazione.sottocontoid === 0))) // Conto + branca
    ) {
      return "parziale";
    } else {
      return "non_classificato";
    }
  };

  const classificationType = getClassificationType();

  const handleRemoveClassificazione = async () => {
    if (removing || !classificazione) return;

    setRemoving(true);
    try {
      const classificazioniService = await import(
        "../services/classificazioni.service"
      );
      const response =
        await classificazioniService.default.rimuoviClassificazioneFornitore(
          fornitoreId
        );

      if (response.success) {
        if (onClassificazioneChange) {
          onClassificazioneChange(null, null, null);
        }
      }
    } catch (error) {
      console.error("Errore nella rimozione classificazione:", error);
    } finally {
      setRemoving(false);
    }
  };


  // Se stiamo modificando, mostra il componente di modifica
  if (showEdit) {
    return (
      <div className="d-flex flex-column gap-2">
        <ClassificazioneGerarchica
          fornitoreId={fornitoreId}
          fornitoreNome={fornitoreNome}
          classificazione={classificazione}
          onClassificazioneChange={(contoid, brancaid, sottocontoid) => {
            if (onClassificazioneChange) {
              onClassificazioneChange(contoid, brancaid, sottocontoid);
            }
            setShowEdit(false); // Chiudi immediatamente dato che ora abbiamo feedback immediato
          }}
        />
        <CButton
          color="secondary"
          size="sm"
          variant="ghost"
          onClick={() => setShowEdit(false)}
        >
          Annulla
        </CButton>
      </div>
    );
  }

  const styled = () => {
    return {
      padding: "0.575rem 0.75rem", // Stesse dimensioni del CButton size="sm"
      fontSize: "0.875rem", // Font size uguale al CButton
      fontWeight: "400",
      borderRadius: "0.25rem",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "80px",
    };
  };

  // Visualizzazione dello stato
  const renderStatus = () => {
    if (contiLoading || brancheLoading || sottocontiLoading) {
      return <CSpinner size="sm" />;
    }

    switch (classificationType) {
      case "completo":
        return (
          <div
            className="d-flex align-items-center justify-content-between"
            style={{ width: "100%" }}
          >
            {/* Badge container - float left */}
            <div className="d-flex align-items-center gap-2">
              {/* Badge conto */}
              <CBadge color="primary" className="text-nowrap" style={styled()}>
                {contoNome}
              </CBadge>

              {/* Badge branca con freccia condizionale */}
              {brancaNome && (
                <>
                  <span style={{ color: "#666", fontSize: "14px" }}>→</span>
                  <CBadge color="info" className="text-nowrap" style={styled()}>
                    {brancaNome}
                  </CBadge>
                </>
              )}

              {/* Badge sottoconto con freccia condizionale */}
              {sottocontoNome && (
                <>
                  <span style={{ color: "#666", fontSize: "14px" }}>→</span>
                  <CBadge
                    color="success"
                    className="text-nowrap"
                    style={styled()}
                  >
                    {sottocontoNome}
                  </CBadge>
                </>
              )}
            </div>

            {/* Action buttons - float right */}
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Modifica classificazione">
                <CButton
                  color="secondary"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEdit(true)}
                  disabled={removing}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>

              <CTooltip content="Rimuovi classificazione">
                <CButton
                  color="danger"
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveClassificazione}
                  disabled={removing}
                >
                  {removing ? (
                    <CSpinner size="sm" />
                  ) : (
                    <CIcon icon={cilTrash} size="sm" />
                  )}
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case "parziale":
        return (
          <div
            className="d-flex align-items-center justify-content-between"
            style={{ width: "100%" }}
          >
            {/* Badge container - float left */}
            <div className="d-flex align-items-center gap-2">
              {/* Badge conto (sempre presente) */}
              <CBadge color="primary" className="text-nowrap" style={styled()}>
                {contoNome.length > 12
                  ? contoNome.substring(0, 12) + "..."
                  : contoNome}
              </CBadge>

              {/* Badge branca con freccia condizionale (se presente) */}
              {brancaNome && (
                <>
                  <span style={{ color: "#666", fontSize: "14px" }}>→</span>
                  <CBadge
                    className="text-nowrap"
                    style={{
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: "400",
                      borderRadius: "0.25rem",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "80px",
                      backgroundColor: "#ff8c00", // Arancione per parziale
                      color: "white",
                      border: "none",
                    }}
                  >
                    {brancaNome.length > 12
                      ? brancaNome.substring(0, 12) + "..."
                      : brancaNome}
                  </CBadge>
                </>
              )}
            </div>

            {/* Action buttons - float right */}
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Completa classificazione">
                <CButton
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEdit(true)}
                  disabled={removing}
                  style={{
                    color: "#ff8c00", // Testo arancione
                    borderColor: "#ff8c00",
                  }}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>

              <CTooltip content="Rimuovi classificazione">
                <CButton
                  color="danger"
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveClassificazione}
                  disabled={removing}
                >
                  {removing ? (
                    <CSpinner size="sm" />
                  ) : (
                    <CIcon icon={cilTrash} size="sm" />
                  )}
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case "non_classificato":
      default:
        return (
          <div
            className="d-flex align-items-center justify-content-between"
            style={{ width: "100%" }}
          >
            {/* Badge container - float left */}
            <div className="d-flex align-items-center gap-2">
              <CButton
                color="warning"
                variant="outline"
                size="sm"
                className="text-nowrap"
                onClick={() => setShowEdit(true)}
              >
                DA CLASSIFICARE
              </CButton>
            </div>

            {/* Action buttons - float right */}
            <div className="d-flex align-items-center gap-1">
              <CTooltip content="Aggiungi classificazione">
                <CButton
                  color="primary"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEdit(true)}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div>{renderStatus()}</div>
    </>
  );
};

export default ClassificazioneStatus;
