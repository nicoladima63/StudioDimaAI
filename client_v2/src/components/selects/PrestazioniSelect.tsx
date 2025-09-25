import React, { useState, useEffect, useMemo } from "react";
import { 
  usePrestazioniStore, 
  type Prestazione
} from "@/store/prestazioni.store";

interface PrestazioniSelectProps {
  value: string | null;
  onChange: (prestazioneId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  showCategory?: boolean; // Mostra categoria nel display
}

const PrestazioniSelect: React.FC<PrestazioniSelectProps> = ({
  value,
  onChange,
  placeholder = "-- Seleziona prestazione --",
  disabled = false,
  searchable = false,
  clearable = false,
  className = "",
  showCategory = true
}) => {
  const { 
    categorieList, 
    isLoading, 
    error, 
    getPrestazioneById,
    getPrestazioniByCategoria,
    loadPrestazioni
  } = usePrestazioniStore();
  
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // Dropdown stato non più necessario: usiamo una select nativa

  // Carica prestazioni al mount - COME PAZIENTI
  useEffect(() => {
    loadPrestazioni();
  }, []); // Solo al mount, array vuoto come PazientiSelect

  // Sincronizza stato interno con value prop
  useEffect(() => {
    if (value && categorieList.length > 0) {
      const prestazione = getPrestazioneById(value);
      // Inizializza la categoria SOLO se non è stata scelta manualmente
      if (prestazione && selectedCategoria === null) {
        setSelectedCategoria(prestazione.categoria_id);
      }
    }
  }, [value, categorieList, getPrestazioneById, selectedCategoria]);

  // Trova la prestazione selezionata - STABILIZZATO
  const selectedPrestazione = useMemo(() => {
    if (!value) return null;
    return getPrestazioneById(value);
  }, [value]); // Rimuovo getPrestazioneById dalle dipendenze

  // Mantieni l'input sincronizzato con la selezione
  useEffect(() => {
    // Mantieni vuoto il campo ricerca dopo selezione/cambio categoria
    if (!selectedPrestazione) {
      setSearchTerm("");
    }
  }, [selectedPrestazione?.id]);

  // Filtra prestazioni per categoria e ricerca - STABILIZZATO
  const filteredPrestazioni = useMemo(() => {
    if (!categorieList.length) return [];

    let prestazioni: Prestazione[] = [];

    if (selectedCategoria) {
      // Mostra solo prestazioni della categoria selezionata
      const categoria = getPrestazioniByCategoria(selectedCategoria);
      prestazioni = categoria?.prestazioni || [];
    } else {
      // Mostra tutte le prestazioni
      prestazioni = categorieList.flatMap(cat => cat.prestazioni);
    }

    // Filtra per ricerca
    if (searchTerm) {
      prestazioni = prestazioni.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codice_breve.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return prestazioni;
  }, [categorieList, selectedCategoria, searchTerm]); // Rimuovo getPrestazioniByCategoria

  // Gestione selezione categoria
  const handleCategoriaChange = (categoriaId: number | null) => {
    setSelectedCategoria(categoriaId);
    // Reset selezione prestazione solo se la categoria cambia
    if (selectedCategoria !== categoriaId) {
      onChange(null);
    }
  };

  // Gestione selezione prestazione
  const handlePrestazioneChange = (prestazione: Prestazione | null) => {
    onChange(prestazione?.id || null);
  };

  // Gestione clear
  const handleClear = () => {
    onChange(null);
    setSearchTerm("");
  };

  // Formatta display prestazione
  const formatPrestazioneDisplay = (prestazione: Prestazione) => {
    const label = `${prestazione.codice_breve} - ${prestazione.nome}`;
    if (showCategory) {
      return `${label}`;
    }
    return label;
  };

  if (error) {
    return (
      <div className={`form-control is-invalid ${className}`}>
        <div className="invalid-feedback d-block">
          Errore caricamento prestazioni: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`prestazioni-select ${className}`}>
      {/* Select Categoria */}
      <div className="mb-2">
        <label className="form-label small text-muted">Categoria</label>
        <select
          className="form-select"
          value={selectedCategoria || ""}
          onChange={(e) => handleCategoriaChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled || isLoading}
        >
          <option value="">-- Tutte le categorie --</option>
          {categorieList.map(categoria => (
            <option key={categoria.categoria_id} value={categoria.categoria_id}>
              {categoria.categoria_nome} ({categoria.prestazioni.length})
            </option>
          ))}
        </select>
      </div>

      {/* Select Prestazioni */}
      {/* Ricerca prestazione */}
      {/* Ricerca disabilitata per richiesta utente */}

      {/* Select Prestazioni nativa (stile uguale alle categorie) */}
      <div className="input-group">
        <select
          className="form-select"
          value={value || ""}
          onChange={(e) => {
            const id = e.target.value || null;
            const p = id ? getPrestazioneById(id) : null;
            handlePrestazioneChange(p);
          }}
          disabled={disabled || isLoading}
        >
          <option value="">{placeholder}</option>
          {filteredPrestazioni.map((prestazione) => (
            <option key={prestazione.id} value={prestazione.id}>
              {formatPrestazioneDisplay(prestazione)}
            </option>
          ))}
        </select>

        {clearable && (
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={handleClear}
            disabled={disabled}
            title="Pulisci selezione"
          >
            ×
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="form-text">
          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
          Caricamento prestazioni...
        </div>
      )}
    </div>
  );
};

export default PrestazioniSelect;
