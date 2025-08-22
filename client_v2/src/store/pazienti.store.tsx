import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface Paziente {
  id: string;
  nome: string;
  codice_fiscale?: string;
  data_nascita?: string; // ISO date string
  luogo_nascita?: string;
  provincia_nascita?: string;
  sesso?: "M" | "F" | "N";
  telefono?: string;
  cellulare?: string;
  email?: string;
  indirizzo?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
  note?: string;
  ultima_visita?: string; // ISO date string
  mesi_richiamo?: number;
  tipo_richiamo?: string;
  da_richiamare?: string; // 1 carattere: S=si
  non_in_cura?: boolean;
}

interface PazientiState {
    // Dati
    pazienti: Paziente[];
    pazientiMap: Record<string, Paziente>;
    
    // Filtri e ricerca
    filteredPazienti: Paziente[];
    searchTerm: string;
    
    // Stati
    isLoading: boolean;
    error: string | null;
    
    // Cache
    lastUpdated: number | null;
    
    // Azioni
    loadPazienti: (options?: { force?: boolean; loadAll?: boolean }) => Promise<void>;
    loadAllPazienti: () => Promise<void>;
    searchPazienti: (term: string) => void;
    getPazienteById: (id: string) => Paziente | undefined;
    clearSearch: () => void;
    
    // Utilità
    invalidateCache: () => void;
    }

export const usePazientiStore = create<PazientiState>()(
    persist(
        (set, get) => ({
            //Stato iniziale
            pazienti: [],
            pazientiMap: {},
            filteredPazienti: [],
            searchTerm: "",
            isLoading: false,
            error: null,
            lastUpdated: null,
            
            //Carica tutti i pazienti dalla tabella pazienti
            loadPazienti: async ({ force = false, loadAll = false } = {}) => {
                const { lastUpdated, isLoading } = get();
                
                if (isLoading) return; // Evita chiamate concorrenti
                
                // Controlla cache
                if (!force && 
                    lastUpdated && 
                    (Date.now() - lastUpdated < CACHE_DURATION)) {
                    return;
                }
                
                set({ isLoading: true, error: null });
                
                let attempts = 0;
                while (attempts < MAX_RETRIES) {
                    try {
                        const response = await apiClient.get<Paziente[]>("/pazienti", {
                            params: { all: loadAll ? 1 : 0 }
                        });
                        const pazienti = response.data;
                        const pazientiMap = pazienti.reduce((map, paziente) => {
                            map[paziente.id] = paziente;
                            return map;
                        }, {} as Record<string, Paziente>);
                        
                        set({
                            pazienti,
                            pazientiMap,
                            filteredPazienti: pazienti,
                            lastUpdated: Date.now(),
                            isLoading: false,
                            error: null
                        });
                        return;
                    } catch (error) {
                        attempts++;
                        if (attempts >= MAX_RETRIES) {
                            set({ isLoading: false, error: "Errore nel caricamento dei pazienti." });
                        }
                    }
                }
            },
            
            loadAllPazienti: async () => {
                await get().loadPazienti({ force: true, loadAll: true });
            },
            
            searchPazienti: (term: string) => {
                const { pazienti } = get();
                const lowerTerm = term.toLowerCase();
                const filteredPazienti = pazienti.filter(paziente =>
                    paziente.nome.toLowerCase().includes(lowerTerm) ||
                    paziente.codice_fiscale?.toLowerCase().includes(lowerTerm) ||
                    paziente.telefono?.toLowerCase().includes(lowerTerm) ||
                    paziente.cellulare?.toLowerCase().includes(lowerTerm) ||
                    paziente.email?.toLowerCase().includes(lowerTerm)
                );
                set({ searchTerm: term, filteredPazienti });
            }
            ,
            getPazienteById: (id: string) => {
                const { pazientiMap } = get();
                return pazientiMap[id];
            },
            
            clearSearch: () => {
                const { pazienti } = get();
                set({ searchTerm: "", filteredPazienti: pazienti });
            },
            
            invalidateCache: () => {
                set({ lastUpdated: null });
            }
        }),
        {
            name: "pazienti-storage", // nome della chiave nello storage
            partialize: (state) => ({
                pazienti: state.pazienti,
                pazientiMap: state.pazientiMap,
                lastUpdated: state.lastUpdated
            }),
        }
    )
);