import React, { useState, useEffect } from "react";
import { CBadge, CSpinner } from "@coreui/react";
import { useConti, useBranche, useSottoconti } from "@/store/contiStore";

interface MaterialeClassificazione {
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
}

interface MaterialeClassificazioneStatusProps {
  classificazione: MaterialeClassificazione | null;
  isLoading?: boolean;
  size?: "sm" | "md";
}

const MaterialeClassificazioneStatus: React.FC<MaterialeClassificazioneStatusProps> = ({
  classificazione,
  isLoading = false,
  size = "sm"
}) => {
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
    const hasBrancaid = classificazione.brancaid && classificazione.brancaid > 0;
    const hasSottocontoid = classificazione.sottocontoid && classificazione.sottocontoid > 0;

    if (hasContoid && hasBrancaid && hasSottocontoid) {
      return "completo";
    } else if (hasContoid && (!classificazione.brancaid || classificazione.brancaid === 0 || 
               (hasBrancaid && (!classificazione.sottocontoid || classificazione.sottocontoid === 0)))) {
      return "parziale";
    } else {
      return "non_classificato";
    }
  };

  const classificationType = getClassificationType();

  const badgeSize = size === "sm" ? {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    minWidth: "60px"
  } : {
    padding: "0.375rem 0.75rem", 
    fontSize: "0.875rem",
    minWidth: "80px"
  };

  // Loading state
  if (isLoading || contiLoading || brancheLoading || sottocontiLoading) {
    return <CSpinner size="sm" />;
  }

  // Visualizzazione dello stato (solo read-only per materiali)
  const renderStatus = () => {
    switch (classificationType) {
      case "completo":
        return (
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {/* Badge conto */}
            <CBadge color="primary" className="text-nowrap" style={badgeSize}>
              {size === "sm" && contoNome.length > 8 ? contoNome.substring(0, 8) + "..." : contoNome}
            </CBadge>

            {/* Badge branca con freccia */}
            {brancaNome && (
              <>
                <span style={{ color: "#666", fontSize: "12px" }}>→</span>
                <CBadge color="info" className="text-nowrap" style={badgeSize}>
                  {size === "sm" && brancaNome.length > 8 ? brancaNome.substring(0, 8) + "..." : brancaNome}
                </CBadge>
              </>
            )}

            {/* Badge sottoconto con freccia */}
            {sottocontoNome && (
              <>
                <span style={{ color: "#666", fontSize: "12px" }}>→</span>
                <CBadge color="success" className="text-nowrap" style={badgeSize}>
                  {size === "sm" && sottocontoNome.length > 8 ? sottocontoNome.substring(0, 8) + "..." : sottocontoNome}
                </CBadge>
              </>
            )}
          </div>
        );

      case "parziale":
        return (
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {/* Badge conto */}
            <CBadge color="primary" className="text-nowrap" style={badgeSize}>
              {size === "sm" && contoNome.length > 8 ? contoNome.substring(0, 8) + "..." : contoNome}
            </CBadge>

            {/* Badge branca arancione se presente */}
            {brancaNome && (
              <>
                <span style={{ color: "#666", fontSize: "12px" }}>→</span>
                <CBadge 
                  className="text-nowrap" 
                  style={{
                    ...badgeSize,
                    backgroundColor: "#ff8c00",
                    color: "white",
                    border: "none"
                  }}
                >
                  {size === "sm" && brancaNome.length > 8 ? brancaNome.substring(0, 8) + "..." : brancaNome}
                </CBadge>
              </>
            )}
          </div>
        );

      case "non_classificato":
      default:
        return (
          <CBadge color="danger" style={badgeSize}>
            Non classificato
          </CBadge>
        );
    }
  };

  return <div>{renderStatus()}</div>;
};

export default MaterialeClassificazioneStatus;