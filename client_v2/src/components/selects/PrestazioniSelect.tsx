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
  searchable = true,
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
  const [isOpen, setIsOpen] = useState(false);

  // Carica prestazioni al mount - COME PAZIENTI
  useEffect(() => {
    loadPrestazioni();
  }, []); // Solo al mount, array vuoto come PazientiSelect

  // Sincronizza stato interno con value prop
  useEffect(() => {
    if (value && categorieList.length > 0) {
      const prestazione = getPrestazioneById(value);
      if (prestazione) {
        setSelectedCategoria(prestazione.categoria_id);
      }
    } else if (!value) {
      setSelectedCategoria(null);
    }
  }, [value, categorieList, getPrestazioneById]);

  // Trova la prestazione selezionata - STABILIZZATO
  const selectedPrestazione = useMemo(() => {
    if (!value) return null;
    return getPrestazioneById(value);
  }, [value]); // Rimuovo getPrestazioneById dalle dipendenze

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
    setIsOpen(false);
  };

  // Gestione clear
  const handleClear = () => {
    onChange(null);
    setSelectedCategoria(null);
    setSearchTerm("");
  };

  // Formatta display prestazione
  const formatPrestazioneDisplay = (prestazione: Prestazione) => {
    if (showCategory) {
      return `${prestazione.nome} (${prestazione.categoria_nome})`;
    }
    return prestazione.nome;
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
          className="form-select form-select-sm"
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
      <div className="position-relative">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            value={selectedPrestazione ? formatPrestazioneDisplay(selectedPrestazione) : ""}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            readOnly
            onClick={() => setIsOpen(!isOpen)}
          />
          
          {clearable && selectedPrestazione && (
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={handleClear}
              disabled={disabled}
            >
              ×
            </button>
          )}
          
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
          >
            {isLoading ? "..." : "▼"}
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="position-absolute w-100 bg-white border rounded shadow-lg" style={{ zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
            {/* Search */}
            {searchable && (
              <div className="p-2 border-bottom">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Cerca prestazione..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {/* Lista prestazioni */}
            <div className="list-group list-group-flush">
              {filteredPrestazioni.length === 0 ? (
                <div className="list-group-item text-muted text-center py-3">
                  {searchTerm ? "Nessuna prestazione trovata" : "Nessuna prestazione disponibile"}
                </div>
              ) : (
                filteredPrestazioni.map(prestazione => (
                  <button
                    key={prestazione.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${
                      selectedPrestazione?.id === prestazione.id ? 'active' : ''
                    }`}
                    onClick={() => handlePrestazioneChange(prestazione)}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-medium">{prestazione.nome}</div>
                        {showCategory && (
                          <small className="text-muted">{prestazione.categoria_nome}</small>
                        )}
                      </div>
                      <div className="text-end">
                        <small className="text-muted">{prestazione.codice_breve}</small>
                        <br />
                        <small className="text-success">€{prestazione.costo.toFixed(2)}</small>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
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
