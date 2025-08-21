import React, { useState, useEffect, useMemo } from "react";
import { useMaterialiByFornitore, type Materiale } from "../../store/materiali.store";

interface MaterialiSelectProps {
  fornitoreId?: string;
  value: string | null;
  onChange: (materiale: Materiale | null) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
  filterByClassificazione?: {
    contoid?: number;
    brancaid?: number;
    sottocontoid?: number;
  };
}

const MaterialiSelect: React.FC<MaterialiSelectProps> = ({
  fornitoreId,
  value,
  onChange,
  placeholder = "-- Seleziona materiale --",
  disabled = false,
  searchable = true,
  className = "",
  filterByClassificazione
}) => {
  const { materiali, isLoading, error, load } = useMaterialiByFornitore(fornitoreId);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Carica materiali all'inizializzazione
  useEffect(() => {
    load();
  }, []); // Carica una volta sola all'avvio

  // Filtra materiali in base alla ricerca locale e classificazione
  const filteredMateriali = useMemo(() => {
    let filtered = Array.isArray(materiali) ? materiali : [];
    
    // Applica filtro di classificazione se specificato
    if (filterByClassificazione) {
      if (filterByClassificazione.contoid) {
        filtered = filtered.filter(m => m.contoid === filterByClassificazione.contoid);
      }
      if (filterByClassificazione.brancaid) {
        filtered = filtered.filter(m => m.brancaid === filterByClassificazione.brancaid);
      }
      if (filterByClassificazione.sottocontoid) {
        filtered = filtered.filter(m => m.sottocontoid === filterByClassificazione.sottocontoid);
      }
    }
    
    // Applica filtro di ricerca se presente
    if (searchTerm.trim()) {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(materiale =>
        materiale.nome.toLowerCase().includes(searchTermLower) ||
        materiale.codicearticolo?.toLowerCase().includes(searchTermLower)
      );
    }
    
    return filtered;
  }, [materiali, searchTerm, filterByClassificazione]);

  // Reset search quando chiude
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Trova il materiale selezionato
  const selectedMateriale = value ? materiali.find(m => 
    m.id.toString() === value ||
    m.codicearticolo === value
  ) : null;

  // Funzione per ottenere il badge di confidence
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 95) return <span className="badge bg-success">95%+</span>;
    if (confidence >= 80) return <span className="badge bg-warning">80%+</span>;
    return <span className="badge bg-danger">&lt;80%</span>;
  };

  if (!searchable) {
    // Versione semplice senza ricerca
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const selectedValue = e.target.value;
          const materiale = selectedValue ? materiali.find(m => 
            m.id.toString() === selectedValue ||
            m.codicearticolo === selectedValue
          ) : null;
          onChange(materiale || null);
        }}
        disabled={disabled || isLoading || !fornitoreId}
        className={`form-select ${className}`}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        
        {!fornitoreId && <option disabled>Seleziona prima un fornitore</option>}
        
        {fornitoreId && isLoading && <option disabled>Caricamento materiali...</option>}
        
        {error && (
          <option disabled className="text-danger">
            Errore: {error}
          </option>
        )}
        
        {filteredMateriali.map((materiale) => (
          <option key={materiale.id} value={materiale.id.toString()}>
            {materiale.nome} {materiale.codicearticolo ? `(${materiale.codicearticolo})` : ''}
          </option>
        ))}
      </select>
    );
  }

  // Versione con ricerca
  return (
    <div className={`position-relative ${className}`}>
      <input
        type="text"
        className="form-control"
        placeholder={selectedMateriale ? 
          `${selectedMateriale.nome} ${selectedMateriale.codicearticolo ? `(${selectedMateriale.codicearticolo})` : ''}` : 
          placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={disabled || isLoading || !fornitoreId}
        aria-invalid={!!error}
      />
      
      {isOpen && (
        <div className="position-absolute w-100" style={{ zIndex: 1050, top: '100%' }}>
          <div className="border border-top-0 bg-white shadow-sm" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {!fornitoreId && (
              <div className="px-3 py-2 text-muted">
                Seleziona prima un fornitore
              </div>
            )}
            
            {fornitoreId && isLoading && (
              <div className="px-3 py-2 text-muted">
                Caricamento materiali...
              </div>
            )}
            
            {fornitoreId && error && (
              <div className="px-3 py-2 text-danger">
                Errore: {error}
              </div>
            )}
            
            {fornitoreId && !isLoading && !error && filteredMateriali.length === 0 && (
              <div className="px-3 py-2 text-muted">
                Nessun materiale trovato
              </div>
            )}
            
            {filteredMateriali.map((materiale) => (
              <div
                key={materiale.id}
                className={`px-3 py-2 cursor-pointer hover-bg-light ${value === materiale.id.toString() ? 'bg-primary text-white' : ''}`}
                onClick={() => {
                  onChange(materiale);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="fw-bold">{materiale.nome}</div>
                    {materiale.codicearticolo && (
                      <div className="small text-muted">
                        Codice: {materiale.codicearticolo}
                      </div>
                    )}
                    <div className="small text-muted">
                      Prezzo: €{materiale.costo_unitario.toFixed(2)}
                    </div>
                    {materiale.confidence > 0 && (
                      <div className="small">
                        <span className="text-muted">Classificazione: </span>
                        {getConfidenceBadge(materiale.confidence)}
                      </div>
                    )}
                    <div className="small text-muted">
                      {materiale.contonome && `${materiale.contonome}`}
                      {materiale.brancanome && ` > ${materiale.brancanome}`}
                      {materiale.sottocontonome && ` > ${materiale.sottocontonome}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialiSelect;