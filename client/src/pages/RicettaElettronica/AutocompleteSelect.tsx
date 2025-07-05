import React, { useState, useEffect, useMemo } from "react";
import debounce from "lodash/debounce";
// import DatiMedicoForm from "./DatiMedicoForm";
// import DatiPazienteForm from "./DatiPazienteForm";
// import RicettaElettronica from "./RicettaElettronica";

interface AutocompleteSelectProps<T> {
  label: string;
  placeholder: string;
  fetchOptions: (q: string) => Promise<T[]>;
  onChange: (value: T | null) => void;
  value: T | null;
}

export function AutocompleteSelect<T extends { codice?: string; principio_attivo?: string; descrizione?: string }>({ 
  label, 
  placeholder, 
  fetchOptions, 
  onChange, 
  value 
}: AutocompleteSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log("AutocompleteSelect render", label);

  // Funzione debounced per chiamare l'API
  const debouncedFetch = useMemo(() => 
    debounce(async (q: string) => {
      //console.log("debouncedFetch chiamato con:", q);
      if (!q) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const opts = await fetchOptions(q);
        setOptions(opts);
      } catch (e) {
        setError("Errore nel caricamento");
      } finally {
        setLoading(false);
      }
    }, 400)
  , [fetchOptions]);

  // Esegui fetch al cambio query
  useEffect(() => {
    //console.log("AutocompleteSelect useEffect, query:", query);
    debouncedFetch(query);
    return () => debouncedFetch.cancel();
  }, [query, debouncedFetch]);

  return (
    <div className="autocomplete-select">
      <label>{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => {
          setQuery(e.target.value);
        }}
      />
      {loading && <div>Caricamento...</div>}
      {error && <div style={{color: "red"}}>{error}</div>}
      {!loading && options.length > 0 && (
        <ul className="options-list" style={{border: "1px solid #ccc", maxHeight: 150, overflowY: "auto", margin: 0, padding: 0, listStyle: "none"}}>
          {options.map(opt => (
            <li
              key={opt.codice || opt.principio_attivo}
              style={{padding: "4px", cursor: "pointer"}}
              onClick={() => {
                onChange(opt);
                setQuery(opt.codice || opt.principio_attivo || "");
                setOptions([]);
              }}
            >
              {opt.codice || opt.principio_attivo} - {opt.descrizione || opt.principio_attivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RicettaWizard() {
  const [step, setStep] = useState(1);
  const [datiMedico, setDatiMedico] = useState({});
  const [datiPaziente, setDatiPaziente] = useState({});
  const [datiRicetta, setDatiRicetta] = useState({});

  return (
    <div>
      {step === 1 && (
        <DatiMedicoForm
          initialValues={datiMedico}
          onNext={values => { setDatiMedico(values); setStep(2); }}
        />
      )}
      {step === 2 && (
        <DatiPazienteForm
          initialValues={datiPaziente}
          onNext={values => { setDatiPaziente(values); setStep(3); }}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <RicettaElettronica
          datiMedico={datiMedico}
          datiPaziente={datiPaziente}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}
