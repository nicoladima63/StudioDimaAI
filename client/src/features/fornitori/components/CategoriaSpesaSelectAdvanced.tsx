import React, { useState, useEffect } from "react";
import { CCard, CCardBody, CSpinner, CBadge, CAlert } from "@coreui/react";
import ContoBrancheSottocontoSelect from "@/components/selects/ContoBrancheSottocontoSelect";
import classificazioniService from "../services/classificazioni.service";
import type { ClassificazioneCosto } from "../types";

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
  const [selectedContoId, setSelectedContoId] = useState<number | null>(null);
  const [selectedBrancaId, setSelectedBrancaId] = useState<number | null>(null);
  const [selectedSottocontoId, setSelectedSottocontoId] = useState<number | null>(null);
  
  // Suggestion state
  const [suggestedConto, setSuggestedConto] = useState<string | null>(null);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number>(0);
  const [suggestionMotivo, setSuggestionMotivo] = useState<string>("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Inizializza dalla classificazione esistente
  useEffect(() => {
    if (classificazione?.categoria_conto) {
      // setSelectedContoId(classificazione.categoria_conto);
      // setSelectedSottocontoId(classificazione.sottoconto || null);
    } else {
      setSelectedContoId(null);
      setSelectedSottocontoId(null);
      
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
          // setSelectedContoId(suggestion.data.categoria_suggerita);
        }
      }
    } catch (error) {
      console.error("Errore nella suggestion automatica:", error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  // Le funzioni handleContoChange e handleSottocontoChange non sono più necessarie
  // Il componente ContoBrancheSottocontoSelect gestisce direttamente le selezioni


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
        // setSelectedContoId(null);
        // setSelectedSottocontoId(null);
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento categoria:", error);
      // Ripristina valori precedenti
      // setSelectedContoId(null);
      // setSelectedSottocontoId(null);
    } finally {
      setUpdating(false);
    }
  };

  const applySuggestion = () => {
    if (suggestedConto) {
      // setSelectedContoId(suggestedConto);
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
          <ContoBrancheSottocontoSelect
            contoId={selectedContoId}
            setContoId={setSelectedContoId}
            brancaId={selectedBrancaId}
            setBrancaId={setSelectedBrancaId}
            sottocontoId={selectedSottocontoId}
            setSottocontoId={setSelectedSottocontoId}
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
      {(selectedContoId || selectedSottocontoId) && (
        <div className="mt-2">
          <small className="text-muted">
            Classificazione attuale: 
            {selectedContoId && <span className="ms-1 fw-bold">Conto: {selectedContoId}</span>}
            {selectedSottocontoId && <span className="ms-1">→ Sottoconto: {selectedSottocontoId}</span>}
          </small>
        </div>
      )}
    </div>
  );
};

export default CategoriaSpesaSelectAdvanced;