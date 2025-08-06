import React, { useState, useEffect } from "react";
import { CCard, CCardBody, CSpinner, CBadge, CAlert } from "@coreui/react";
import ContoSottocontoSelect from "@/components/ContoSottocontoSelect";
import classificazioniService from "../services/classificazioni.service";
import type { ClassificazioneCosto } from "../types";
import type { Conto, Sottoconto } from "@/store/contiStore";

interface CategoriaSpesaSelectAdvancedProps {
  fornitoreId: string;
  classificazione: ClassificazioneCosto | null;
  onCategoriaChange?: (conto: string | null, sottoconto: string | null) => void;
  showSuggestions?: boolean;
}

const CategoriaSpesaSelectAdvanced: React.FC<CategoriaSpesaSelectAdvancedProps> = ({
  fornitoreId,
  classificazione,
  onCategoriaChange,
  showSuggestions = true
}) => {
  const [updating, setUpdating] = useState(false);
  const [selectedConto, setSelectedConto] = useState<string>("");
  const [selectedSottoconto, setSelectedSottoconto] = useState<string>("");
  
  // Suggestion state
  const [suggestedConto, setSuggestedConto] = useState<string | null>(null);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number>(0);
  const [suggestionMotivo, setSuggestionMotivo] = useState<string>("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Inizializza dalla classificazione esistente
  useEffect(() => {
    if (classificazione?.categoria_conto) {
      setSelectedConto(classificazione.categoria_conto);
      setSelectedSottoconto(classificazione.sottoconto || "");
    } else {
      setSelectedConto("");
      setSelectedSottoconto("");
      
      if (showSuggestions) {
        suggerisciCategoriaAutomatica();
      }
    }
  }, [classificazione, fornitoreId, showSuggestions]);

  const suggerisciCategoriaAutomatica = async () => {
    if (!fornitoreId) return;

    setSuggestionLoading(true);
    try {
      const suggestion = await classificazioniService.suggestCategoriaFornitore(fornitoreId);
      
      if (suggestion.success && suggestion.data?.categoria_suggerita) {
        setSuggestedConto(suggestion.data.categoria_suggerita);
        setSuggestionConfidence(suggestion.data.confidence);
        setSuggestionMotivo(suggestion.data.motivo);
        
        // Se la confidenza è molto alta (>= 0.9), pre-seleziona automaticamente
        if (suggestion.data.confidence >= 0.9) {
          setSelectedConto(suggestion.data.categoria_suggerita);
        }
      }
    } catch (error) {
      console.error("Errore nella suggestion automatica:", error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleContoChange = async (codice: string | null, conto: Conto | null) => {
    setSelectedConto(codice || "");
    
    // Se cambia il conto, salva subito (il sottoconto verrà salvato dopo)
    if (codice) {
      await saveClassificazione(codice, null);
    }
  };

  const handleSottocontoChange = async (codice: string | null, sottoconto: Sottoconto | null) => {
    setSelectedSottoconto(codice || "");
    
    // Salva con il sottoconto
    if (selectedConto) {
      await saveClassificazione(selectedConto, codice);
    }
  };

  const saveClassificazione = async (conto: string, sottoconto: string | null) => {
    if (!fornitoreId) return;

    setUpdating(true);
    try {
      const tipoDefault = classificazione?.tipo_di_costo || 1;
      
      const response = await classificazioniService.classificaFornitore(fornitoreId, {
        tipo_di_costo: tipoDefault,
        categoria: classificazione?.categoria,
        categoria_conto: conto,
        sottoconto: sottoconto || undefined,
        note: classificazione?.note
      });

      if (response.success) {
        onCategoriaChange?.(conto, sottoconto);
      } else {
        // Ripristina valori precedenti in caso di errore
        setSelectedConto(classificazione?.categoria_conto || "");
        setSelectedSottoconto(classificazione?.sottoconto || "");
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento categoria:", error);
      // Ripristina valori precedenti
      setSelectedConto(classificazione?.categoria_conto || "");
      setSelectedSottoconto(classificazione?.sottoconto || "");
    } finally {
      setUpdating(false);
    }
  };

  const applySuggestion = () => {
    if (suggestedConto) {
      setSelectedConto(suggestedConto);
      saveClassificazione(suggestedConto, null);
    }
  };

  return (
    <div>
      {/* Suggestion Alert */}
      {showSuggestions && suggestedConto && suggestionConfidence > 0.5 && (
        <CAlert 
          color={suggestionConfidence >= 0.8 ? "success" : "warning"} 
          className="mb-3 small"
        >
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Suggestion: </strong>
              {suggestionMotivo}
              <CBadge color="info" className="ms-2">
                {Math.round(suggestionConfidence * 100)}% sicuro
              </CBadge>
            </div>
            {suggestionConfidence < 0.9 && (
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={applySuggestion}
                disabled={updating}
              >
                Applica
              </button>
            )}
          </div>
        </CAlert>
      )}

      {/* Loading Suggestions */}
      {suggestionLoading && (
        <div className="text-center mb-3">
          <CSpinner size="sm" /> Analisi automatica in corso...
        </div>
      )}

      {/* Selezione Conto/Sottoconto */}
      <CCard className="border-0 bg-light">
        <CCardBody className="p-3">
          <ContoSottocontoSelect
            selectedConto={selectedConto}
            selectedSottoconto={selectedSottoconto}
            onContoChange={handleContoChange}
            onSottocontoChange={handleSottocontoChange}
            disabled={updating}
            size="sm"
            showLabels={true}
            autoSelectIfSingle={true}
          />
          
          {updating && (
            <div className="text-center mt-2">
              <CSpinner size="sm" /> Salvataggio in corso...
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Info sulla classificazione corrente */}
      {(selectedConto || selectedSottoconto) && (
        <div className="mt-2">
          <small className="text-muted">
            Classificazione attuale: 
            {selectedConto && <span className="ms-1 fw-bold">{selectedConto}</span>}
            {selectedSottoconto && <span className="ms-1">→ {selectedSottoconto}</span>}
          </small>
        </div>
      )}
    </div>
  );
};

export default CategoriaSpesaSelectAdvanced;