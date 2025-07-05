import React, { useEffect, useState } from "react";
import debounce from "lodash/debounce";
import {
  getPazientiList,
  searchDiagnosi,
  searchFarmaci,
  inviaRicetta,
} from '@/api/apiClient';

interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  indirizzo: string;
}

interface Diagnosi {
  codice: string;
  descrizione: string;
}

interface Farmaco {
  codice: string;
  principio_attivo: string;
  descrizione: string;
}

export default function RicettaElettronica() {
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [diagnosiList, setDiagnosiList] = useState<Diagnosi[]>([]);
  const [farmaciList, setFarmaciList] = useState<Farmaco[]>([]);

  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [diagnosiSelezionata, setDiagnosiSelezionata] = useState<Diagnosi | null>(null);
  const [farmacoSelezionato, setFarmacoSelezionato] = useState<Farmaco | null>(null);

  const [posologia, setPosologia] = useState("");
  const [durata, setDurata] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    getPazientiList()
      .then(pazientiRaw => {
        const pazienti = pazientiRaw.map((p: any) => ({
          id: p.DB_CODE,
          nome: p.DB_PANOME,
          codiceFiscale: p.DB_PACODFI,
          indirizzo: p.DB_PAINDIR,
          cap: p.DB_PACAP,
          citta: p.DB_PACITTA,
          provincia: p.DB_PAPROVI,
          telefono: p.DB_PACELLU,
          // aggiungi altri campi se servono
        }));
        setPazienti(pazienti);
      })
      .catch(err => console.error("Errore caricamento pazienti:", err));
  }, []);
  
  const fetchDiagnosi = debounce((q: string) => {
    if (!q) return;
    searchDiagnosi(q)
      .then(setDiagnosiList)
      .catch(err => console.error("Errore fetch diagnosi:", err));
  }, 400);

  const fetchFarmaci = debounce((q: string) => {
    if (!q) return;
    searchFarmaci(q)
      .then(setFarmaciList)
      .catch(err => console.error("Errore fetch farmaci:", err));
  }, 400);

  const submitRicetta = () => {
    if (!pazienteSelezionato || !diagnosiSelezionata || !farmacoSelezionato) {
      alert("Compila tutti i campi obbligatori.");
      return;
    }

    const payload = {
      paziente: pazienteSelezionato,
      diagnosi: diagnosiSelezionata,
      farmaco: farmacoSelezionato,
      posologia,
      durata,
      note,
    };

    inviaRicetta(payload)
      .then(data => {
        alert("Ricetta inviata con successo.");
        console.log("Risposta:", data);
      })
      .catch(err => {
        console.error("Errore invio ricetta:", err);
        alert("Errore durante l'invio della ricetta.");
      });
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Ricetta Elettronica Privata</h2>

      {/* Selezione Paziente */}
      <div>
        <label className="block">Paziente</label>
        <select
          className="w-full border rounded p-2"
          onChange={e => {
            const selected = pazienti.find(p => p.id === e.target.value);
            setPazienteSelezionato(selected || null);
          }}
        >
          <option value="">-- Seleziona --</option>
          {pazienti.map(p => (
            <option key={p.id} value={p.id}>
              {p.cognome} {p.nome} - {p.indirizzo}
            </option>
          ))}
        </select>
      </div>

      {/* Ricerca Diagnosi */}
      <div>
        <label className="block">Diagnosi</label>
        <input
          className="w-full border p-2 rounded"
          placeholder="Cerca diagnosi..."
          onChange={e => fetchDiagnosi(e.target.value)}
        />
        {diagnosiList.length > 0 && (
          <ul className="border mt-1 max-h-40 overflow-y-auto text-sm">
            {diagnosiList.map(d => (
              <li
                key={d.codice}
                className="p-1 hover:bg-gray-200 cursor-pointer"
                onClick={() => {
                  setDiagnosiSelezionata(d);
                  setDiagnosiList([]);
                }}
              >
                {d.codice} - {d.descrizione}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ricerca Farmaco */}
      <div>
        <label className="block">Farmaco</label>
        <input
          className="w-full border p-2 rounded"
          placeholder="Cerca farmaco..."
          onChange={e => fetchFarmaci(e.target.value)}
        />
        {farmaciList.length > 0 && (
          <ul className="border mt-1 max-h-40 overflow-y-auto text-sm">
            {farmaciList.map(f => (
              <li
                key={f.codice}
                className="p-1 hover:bg-gray-200 cursor-pointer"
                onClick={() => {
                  setFarmacoSelezionato(f);
                  setFarmaciList([]);
                }}
              >
                {f.principio_attivo} - {f.descrizione}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Posologia e Note */}
      <div>
        <label className="block">Posologia</label>
        <input className="w-full border p-2 rounded" value={posologia} onChange={e => setPosologia(e.target.value)} />
      </div>

      <div>
        <label className="block">Durata</label>
        <input className="w-full border p-2 rounded" value={durata} onChange={e => setDurata(e.target.value)} />
      </div>

      <div>
        <label className="block">Note aggiuntive</label>
        <textarea className="w-full border p-2 rounded" value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <button onClick={submitRicetta} className="bg-blue-600 text-white px-4 py-2 rounded">
        Invia Ricetta
      </button>
    </div>
  );
}