import React, { useState, useEffect } from "react";
import { CButton, CSpinner, CTooltip } from "@coreui/react";
import classificazioniService from "../services/classificazioni.service";
import type { TipoDiCosto, ClassificazioneCosto } from "../types";

interface ClassificazioneToggleProps {
  fornitoreId: string;
  classificazioneIniziale?: ClassificazioneCosto | null;
  onClassificazioneChange?: (classificazione: ClassificazioneCosto | null) => void;
}

const ClassificazioneToggle: React.FC<ClassificazioneToggleProps> = ({
  fornitoreId,
  classificazioneIniziale,
  onClassificazioneChange,
}) => {
  const [classificazione, setClassificazione] = useState<ClassificazioneCosto | null>(classificazioneIniziale || null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setClassificazione(classificazioneIniziale || null);
  }, [classificazioneIniziale]);

  const handleToggle = async () => {
    if (updating) return;

    try {
      setUpdating(true);
      
      let nuovoTipo: TipoDiCosto;
      
      if (!classificazione) {
        // Non classificato -> Diretto
        nuovoTipo = 1; // TipoDiCosto.DIRETTO
      } else if (classificazione.tipo_di_costo === 1) {
        // Diretto -> Indiretto  
        nuovoTipo = 2; // TipoDiCosto.INDIRETTO
      } else if (classificazione.tipo_di_costo === 2) {
        // Indiretto -> Non Deducibile
        nuovoTipo = 3; // TipoDiCosto.NON_DEDUCIBILE
      } else {
        // Non Deducibile -> Non classificato (rimuovi)
        const response = await classificazioniService.rimuoviClassificazioneFornitore(fornitoreId);
        if (response.success) {
          setClassificazione(null);
          onClassificazioneChange?.(null);
        }
        return;
      }

      // Aggiorna classificazione
      const response = await classificazioniService.classificaFornitore(fornitoreId, {
        tipo_di_costo: nuovoTipo,
      });

      if (response.success && response.data) {
        setClassificazione(response.data);
        onClassificazioneChange?.(response.data);
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento classificazione:", error);
    } finally {
      setUpdating(false);
    }
  };

  const getButtonProps = () => {
    if (!classificazione) {
      return {
        color: "warning" as const,
        variant: "outline" as const,
        text: "DA CLASSIFICARE",
        tooltip: "Clicca per classificare come Diretto",
        icon: "⚪"
      };
    }

    switch (classificazione.tipo_di_costo) {
      case 1: // DIRETTO
        return {
          color: "danger" as const,
          variant: "outline" as const,
          text: "DIRETTO",
          tooltip: "Clicca per cambiare in Indiretto",
          icon: "🔴"
        };
      case 2: // INDIRETTO
        return {
          color: "primary" as const,
          variant: "outline" as const,
          text: "INDIRETTO", 
          tooltip: "Clicca per cambiare in Non Deducibile",
          icon: "🔵"
        };
      case 3: // NON_DEDUCIBILE
        return {
          color: "dark" as const,
          variant: "outline" as const,
          text: "INDEDUCIBILE",
          tooltip: "Clicca per rimuovere classificazione",
          icon: "⚫"
        };
      default:
        return {
          color: "warning" as const,
          variant: "outline" as const,
          text: "NON CLASSIFICATO",
          tooltip: "Clicca per classificare",
          icon: "⚪"
        };
    }
  };


  const buttonProps = getButtonProps();

  return (
    <CTooltip content={buttonProps.tooltip}>
      <CButton
        color={buttonProps.color}
        variant={buttonProps.variant}
        size="sm"
        onClick={handleToggle}
        disabled={updating}
        className="text-nowrap text-start"
        style={{ minWidth: "160px" }}
      >
        {updating ? (
          <>
            <CSpinner size="sm" className="me-1" />
            Aggiornamento...
          </>
        ) : (
          <>
            <span className="me-1">{buttonProps.icon}</span>
            {buttonProps.text}
          </>
        )}
      </CButton>
    </CTooltip>
  );
};

export default ClassificazioneToggle;