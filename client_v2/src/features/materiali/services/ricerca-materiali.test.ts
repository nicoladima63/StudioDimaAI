import { describe, expect, it } from 'vitest';
import { ricercaMateriali, type RigaRicercabile } from './ricerca-materiali';

const righe = [
  { id: 1, nome: 'AROMA FINE PLUS NORMAL ROSA 1 KG', codicearticolo: 'A-1', fornitoreid: 'K', fornitorenome: 'Henry Schein', tipo_di_costo: 1, contoid: 10, brancaid: 20, sottocontoid: 30, confermato: 1 },
  { id: 2, nome: 'AROMA FINE NORMAL BUSTA 1KG', fornitoreid: 'U', fornitorenome: 'UMBRA SPA', tipo_di_costo: 2, contoid: 11, confermato: 0 },
  { id: 3, nome: 'GC Alginato aroma fine Plus presa normale colore ROSA', fornitoreid: 'I', fornitorenome: 'ITALTRADING S.R.L.', tipo_di_costo: 3, contoid: 12, confermato: 1 },
  { id: 4, nome: ' Èlite   HD ', fornitoreid: 'U', fornitorenome: 'Umbra Spa', confermato: 0 },
  { id: 5, nome: '123 prodotto', fornitoreid: 'U' },
];
const ids = (risultati: typeof righe) => risultati.map(r => r.id);

describe('ricerca materiali condivisa', () => {
  it('non esclude righe per classificazione o conferma senza filtri espliciti', () => {
    expect(ids(ricercaMateriali(righe, { testo: 'arom' }))).toEqual([1, 2, 3]);
    expect(ricercaMateriali(righe)).toEqual(righe);
    expect(ricercaMateriali(righe, { testo: '   ', tipiCosto: [], fornitoriId: [] })).toEqual(righe);
  });
  it('normalizza accenti, maiuscole e spazi e cerca parole in ordine libero', () => {
    expect(ids(ricercaMateriali(righe, { testo: ' HD  elite ' }))).toEqual([4]);
    expect(ids(ricercaMateriali(righe, { testo: 'rosa arom' }))).toEqual([1, 3]);
  });
  it('permette di cercare soltanto nel campo selezionato', () => {
    expect(ids(ricercaMateriali(righe, { testo: 'umbra', campi: ['fornitorenome'] }))).toEqual([2, 4]);
    expect(ricercaMateriali(righe, { testo: 'umbra', campi: ['nome'] })).toEqual([]);
    expect(ids(ricercaMateriali(righe, { testo: 'a-1', campi: ['codicearticolo'] }))).toEqual([1]);
  });
  it('cerca nomi ufficiali e storici tramite ID senza confondere i fornitori', () => {
    const contesto = { fornitori: { K: { nome: 'HENRY SCHEIN KRUGG S.R.L.' } } };
    expect(ids(ricercaMateriali(righe, { testo: 'krugg' }, contesto))).toEqual([1]);
    expect(ids(ricercaMateriali(righe, { testo: 'henry' }, contesto))).toEqual([1]);
    expect(ids(ricercaMateriali(righe, { fornitoriId: ['U'] }))).toEqual([2, 4, 5]);
  });
  it('combina i tre tipi di costo e la gerarchia contabile con gli altri filtri', () => {
    expect(ids(ricercaMateriali(righe, { tipiCosto: [1, 3], testo: 'arom' }))).toEqual([1, 3]);
    expect(ids(ricercaMateriali(righe, { tipiCosto: [1], contiId: [10], brancheId: [20], sottocontiId: [30], confermato: true, fornitoriId: ['K'] }))).toEqual([1]);
    expect(ricercaMateriali(righe, { contiId: [10], brancheId: [99] })).toEqual([]);
    expect(ids(ricercaMateriali(righe, { confermato: false }))).toEqual([2, 4]);
  });
  it('accetta la classificazione esterna e non inventa tipi di costo mancanti', () => {
    expect(ids(ricercaMateriali(righe, { tipiCosto: [2] }, { tipoCosto: r => r.id === 4 ? 2 : null }))).toEqual([4]);
    expect(ricercaMateriali([{}] as RigaRicercabile[], { tipiCosto: [1, 2, 3] })).toEqual([]);
  });
  it('combina iniziale e testo, gestendo accenti e nomi numerici', () => {
    expect(ids(ricercaMateriali(righe, { iniziale: 'A', testo: 'arom' }))).toEqual([1, 2]);
    expect(ids(ricercaMateriali(righe, { iniziale: 'E' }))).toEqual([4]);
    expect(ids(ricercaMateriali(righe, { iniziale: '#' }))).toEqual([5]);
  });
  it('gestisce dati mancanti e mantiene ordine, duplicati e oggetti originali', () => {
    expect(ricercaMateriali([{}], { testo: 'arom' })).toEqual([]);
    const input = Object.freeze([Object.freeze(righe[2]), Object.freeze(righe[0]), righe[0]]);
    const risultato = ricercaMateriali(input, { testo: 'arom' });
    expect(risultato.map(r => r.id)).toEqual([3, 1, 1]);
    expect(risultato[0]).toBe(input[0]);
  });
});
