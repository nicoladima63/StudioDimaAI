import React, { useState, useEffect } from "react";
import { CFormSelect, CSpinner } from "@coreui/react";
import classificazioniService from "../services/classificazioni.service";
import type { CategoriaSpesa, ClassificazioneCosto } from "../types";

interface CategoriaSpesaSelectProps {
  fornitoreId: string;
  classificazione: ClassificazioneCosto | null;
  categorie: CategoriaSpesa[];  // Ricevute dall'esterno
  onCategoriaChange?: (codiceCategoria: string | null) => void;
}

const CategoriaSpesaSelect: React.FC<CategoriaSpesaSelectProps> = ({
  fornitoreId,
  classificazione,
  categorie,  // Ricevute dall'esterno
  onCategoriaChange,
}) => {
  const [updating, setUpdating] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("");
  // const [suggestedCategoria, setSuggestedCategoria] = useState<string | null>(null);
  // const [suggestionConfidence, setSuggestionConfidence] = useState<number>(0);
  // const [suggestionMotivo, setSuggestionMotivo] = useState<string>("");

  useEffect(() => {
    // Aggiorna la selezione quando cambia la classificazione
    if (classificazione?.categoria_conto) {
      setSelectedCategoria(classificazione.categoria_conto);
    } else {
      // Se non c'è categoria assegnata, prova a suggerire automaticamente
      setSelectedCategoria("");
      suggeriscategoriaAutomatica();
    }
  }, [classificazione, fornitoreId]);

  const suggeriscategoriaAutomatica = async () => {
    try {
      const suggestion = await classificazioniService.suggestCategoriaFornitore(fornitoreId);
      
      if (suggestion.success && suggestion.data?.categoria_suggerita) {
        // setSuggestedCategoria(suggestion.data.categoria_suggerita);
        // setSuggestionConfidence(suggestion.data.confidence);
        // setSuggestionMotivo(suggestion.data.motivo);
        
        // Se la confidenza è alta (>= 0.8), pre-seleziona automaticamente
        if (suggestion.data.confidence >= 0.8) {
          setSelectedCategoria(suggestion.data.categoria_suggerita);
        }
      }
    } catch (error) {
      console.error("Errore nella suggestion automatica:", error);
    }
  };


  const handleCategoriaChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nuovaCategoria = event.target.value;
    
    try {
      setUpdating(true);
      setSelectedCategoria(nuovaCategoria);

      // Se non c'è una classificazione esistente, creane una nuova con tipo_di_costo = 1 (default)
      const tipoDefault = classificazione?.tipo_di_costo || 1;
      
      const response = await classificazioniService.classificaFornitore(fornitoreId, {
        tipo_di_costo: tipoDefault,
        categoria: classificazione?.categoria,
        categoria_conto: nuovaCategoria || undefined,
        note: classificazione?.note
      });

      if (response.success) {
        onCategoriaChange?.(nuovaCategoria || null);
      } else {
        // Ripristina il valore precedente in caso di errore
        setSelectedCategoria(classificazione?.categoria_conto || "");
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento categoria:", error);
      // Ripristina il valore precedente in caso di errore
      setSelectedCategoria(classificazione?.categoria_conto || "");
    } finally {
      setUpdating(false);
    }
  };


  return (
    <div className="d-flex align-items-center">
      <CFormSelect
        size="sm"
        value={selectedCategoria}
        onChange={handleCategoriaChange}
        disabled={updating}
        className="me-2"
        style={{ minWidth: "150px" }}
      >
        <option value="">-- Seleziona categoria --</option>
        {categorie.map((categoria) => (
          <option key={categoria.codice_conto} value={categoria.codice_conto}>
            {categoria.descrizione}
          </option>
        ))}
      </CFormSelect>
      
      {updating && <CSpinner size="sm" />}
    </div>
  );
};

export default CategoriaSpesaSelect;