// store/classificazioniStore.ts
import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface ClassificazioneCosto {
  id: number;
  codice_riferimento: string;
  tipo_entita: "fornitore" | "spesa";
  tipo_di_costo: 1 | 2 | 3;
  note: string | null;
  contoid: number | null;
  brancaid: number | null;
  sottocontoid: number | null;
  data_classificazione: string;
  data_modifica: string;
  fornitore_nome?: string;
  // Campi aggregati dai JOIN
  conto_nome?: string;
  branca_nome?: string;
  sottoconto_nome?: string;
}

interface State {
  classificazioni: ClassificazioneCosto[];
  classificazioniByFornitore: Record<number, ClassificazioneCosto[]>;
  classificazioniByConto: Record<number, ClassificazioneCosto[]>;

  classificazioniMap: Record<string, number>;

  isLoading: boolean;
  errors: Record<string, string | null>;

  lastUpdated: number;

  operations: {
    creating: boolean;
    updating: Record<number, boolean>;
    deleting: Record<number, boolean>;
  };

  loadClassificazioni: (options?: { force?: boolean }) => Promise<void>;

  invalidateCache: () => void;
  getClassificazioneById: (id: number) => ClassificazioneCosto | undefined;
}

export const useClassificazioniStore = create<State>()(
  persist(
    (set, get) => ({
      classificazioni: [],
      classificazioniByConto: {},
      classificazioniByFornitore: {},
      classificazioniMap: {},
      isLoading: false,
      errors: { classificazioni: null },
      lastUpdated: 0,
      operations: {
        creating: false,
        updating: {},
        deleting: {},
      },

      loadClassificazioni: async (options = {}) => {
        const { force = false } = options;
        const state = get();
        const now = Date.now();

        if (
          !force &&
          state.classificazioni.length > 0 &&
          now - state.lastUpdated < CACHE_DURATION
        ) {
          return;
        }

        set({ isLoading: true, errors: { classificazioni: null } });

        let retries = 0;
        while (retries < MAX_RETRIES) {
          try {
            const response = await apiClient.get("/api/classificazioni/all");

            if (response.data.success) {
              set({
                classificazioni: response.data.data,
                lastUpdated: now,
                isLoading: false,
              });
              return;
            } else {
              throw new Error(
                response.data.error || "Errore nel caricamento classificazioni"
              );
            }
          } catch (error: any) {
            retries++;
            if (retries >= MAX_RETRIES) {
              set({
                errors: {
                  classificazioni: error.message || "Errore di connessione",
                },
                isLoading: false,
              });
              return;
            }
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retries)
            );
          }
        }
      },

      invalidateCache: () => {
        set({
          lastUpdated: 0,
          classificazioni: [],
        });
      },

      getClassificazioneById: (id: number) => {
        return get().classificazioni.find((c) => c.id === id);
      },
    }),
    {
      name: "classificazioni-store",
      version: 1,
      partialize: (state) => ({
        classificazioni: state.classificazioni,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

// Hook generico per filtrare classificazioni
export const useClassificazioni = (filtro?: string) => {
  const { classificazioni, loadClassificazioni, isLoading, errors } =
    useClassificazioniStore();

  React.useEffect(() => {
    loadClassificazioni();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classificazioniFiltrate = React.useMemo(() => {
    if (!filtro) return classificazioni;

    const filtroUpper = filtro.toUpperCase();
    return classificazioni.filter(
      (c) =>
        c.conto_nome?.toUpperCase().includes(filtroUpper) ||
        c.branca_nome?.toUpperCase().includes(filtroUpper) ||
        c.sottoconto_nome?.toUpperCase().includes(filtroUpper)
    );
  }, [classificazioni, filtro]);

  return {
    classificazioni: classificazioniFiltrate,
    isLoading,
    errors,
  };
};
