export interface FatturaIntestazione {
  id: string;
  numero_documento: string;
  fornitoreid: string;
  fornitorenome: string;
  data_spesa: string;
  costo_netto_totale: number;
  costo_iva_totale: number;
  costo_totale: number;
}

export interface DettaglioRigaFattura {
  codice_articolo: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  sconto: number;
  aliquota_iva: number;
  totale_riga: number;
}

export interface FatturaCompleta {
  intestazione: FatturaIntestazione;
  dettagli: DettaglioRigaFattura[];
}
