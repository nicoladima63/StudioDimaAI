import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/services/api/client";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

export interface SearchResult {
  id: number;
  type: 'conto' | 'branca' | 'sottoconto';
  nome: string;
  path: string;
}

export interface Conto { id: number; nome: string; }
export interface Branca { id: number; nome: string; contoId: number; }
export interface Sottoconto { id: number; nome: string; brancaId: number; contoId: number; }

interface ContiState {
  // Dati
  conti: Conto[];
  brancheByConto: Record<number, Branca[]>;
  sottocontiByBranca: Record<number, Sottoconto[]>;
  
  // Mappe id→nome per lookup rapidi
  contiMap: Record<number, string>;
  brancheMap: Record<number, string>;
  sottocontiMap: Record<number, string>;
  
  // Stati
  isLoading: boolean;
  errors: Record<string, string | null>;
  
  // Cache
  lastUpdated: {
    conti: number;
    branche: Record<number, number>;
    sottoconti: Record<number, number>;
  };
  
  // Operazioni in corso
  operations: {
    creating: boolean;
    updating: Record<number, boolean>;
    deleting: Record<number, boolean>;
    creatingBranca: boolean;
    updatingBranca: Record<number, boolean>;
    deletingBranca: Record<number, boolean>;
    creatingSottoconto: boolean;
    updatingSottoconto: Record<number, boolean>;
    deletingSottoconto: Record<number, boolean>;
  };
  
  // Azioni CRUD per Conti
  loadConti: (options?: { force?: boolean }) => Promise<void>;
  createConto: (data: Omit<Conto, 'id'>) => Promise<Conto>;
  updateConto: (id: number, data: Partial<Conto>) => Promise<Conto>;
  deleteConto: (id: number) => Promise<void>;
  
  // Azioni CRUD per Branche
  loadBranche: (contoId: number, options?: { force?: boolean }) => Promise<void>;
  createBranca: (data: Omit<Branca, 'id'>) => Promise<Branca>;
  updateBranca: (id: number, data: Partial<Branca>) => Promise<Branca>;
  deleteBranca: (id: number) => Promise<void>;
  
  // Azioni CRUD per Sottoconti
  loadSottoconti: (brancaId: number, options?: { force?: boolean }) => Promise<void>;
  createSottoconto: (data: Omit<Sottoconto, 'id'>) => Promise<Sottoconto>;
  updateSottoconto: (id: number, data: Partial<Sottoconto>) => Promise<Sottoconto>;
  deleteSottoconto: (id: number) => Promise<void>;
  
  // Utilità
  invalidateCache: () => void;
  getContoById: (id: number) => Conto | undefined;
  getBrancaById: (id: number) => Branca | undefined;
  getSottocontoById: (id: number) => Sottoconto | undefined;
  getFlatData: () => SearchResult[];
}

export const useContiStore = create<ContiState>()(
  persist(
    (set, get) => ({
      conti: [],
      brancheByConto: {},
      sottocontiByBranca: {},
      contiMap: {},
      brancheMap: {},
      sottocontiMap: {},
      isLoading: false,
      errors: { conti: null, branche: null, sottoconti: null },
      lastUpdated: { conti: 0, branche: {}, sottoconti: {} },
      operations: {
        creating: false,
        updating: {},
        deleting: {},
        creatingBranca: false,
        updatingBranca: {},
        deletingBranca: {},
        creatingSottoconto: false,
        updatingSottoconto: {},
        deletingSottoconto: {},
      },

      // Caricamento conti con retry
      loadConti: async ({ force = false } = {}) => {
        const state = get();
        if (!force && state.conti.length > 0 && Date.now() - state.lastUpdated.conti < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, conti: null } });
        
        let retry = 0;
        while (retry < MAX_RETRIES) {
          try {
            const res = await apiClient.get("/conti");
            if (!res.data.success) throw new Error(res.data.error || "Errore caricamento conti");
            
            const contiMap = res.data.data.reduce((map: Record<number, string>, conto: Conto) => {
              map[conto.id] = conto.nome;
              return map;
            }, {});
            
            set({
              conti: res.data.data,
              contiMap,
              isLoading: false,
              lastUpdated: { ...state.lastUpdated, conti: Date.now() },
              errors: { ...state.errors, conti: null }
            });
            return;
          } catch (err: any) {
            retry++;
            if (retry >= MAX_RETRIES) {
              set({
                isLoading: false,
                errors: { ...state.errors, conti: err.message || "Errore sconosciuto" }
              });
            }
          }
        }
      },

      // CREATE Conto
      createConto: async (data) => {
        set({ operations: { ...get().operations, creating: true } });
        
        try {
          const res = await apiClient.post("/conti", data);
          if (!res.data.success) throw new Error(res.data.error || "Errore creazione conto");
          
          const newConto = res.data.data;
          set(state => ({
            conti: [...state.conti, newConto],
            contiMap: { ...state.contiMap, [newConto.id]: newConto.nome },
            lastUpdated: { ...state.lastUpdated, conti: Date.now() },
            operations: { ...state.operations, creating: false }
          }));
          
          return newConto;
        } catch (error: any) {
          set(state => ({
            errors: { ...state.errors, conti: error.message },
            operations: { ...state.operations, creating: false }
          }));
          throw error;
        }
      },

      // UPDATE Conto
      updateConto: async (id, data) => {
        const state = get();
        const previousConto = state.conti.find(c => c.id === id);
        
        // Optimistic update
        set(state => ({
          conti: state.conti.map(conto => 
            conto.id === id ? { ...conto, ...data } : conto
          ),
          contiMap: data.nome ? { ...state.contiMap, [id]: data.nome } : state.contiMap,
          operations: { 
            ...state.operations, 
            updating: { ...state.operations.updating, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.put(`/conti/${id}`, data);
          if (!res.data.success) throw new Error(res.data.error || "Errore aggiornamento conto");
          
          const updatedConto = res.data.data;
          set(state => ({
            conti: state.conti.map(conto => 
              conto.id === id ? updatedConto : conto
            ),
            contiMap: { ...state.contiMap, [id]: updatedConto.nome },
            lastUpdated: { ...state.lastUpdated, conti: Date.now() },
            operations: { 
              ...state.operations, 
              updating: { ...state.operations.updating, [id]: false } 
            }
          }));
          
          return updatedConto;
        } catch (error: any) {
          // Rollback in caso di errore
          set(state => ({
            conti: previousConto 
              ? state.conti.map(conto => conto.id === id ? previousConto : conto)
              : state.conti.filter(conto => conto.id !== id),
            contiMap: previousConto 
              ? { ...state.contiMap, [id]: previousConto.nome }
              : Object.fromEntries(Object.entries(state.contiMap).filter(([key]) => parseInt(key) !== id)),
            errors: { ...state.errors, conti: error.message },
            operations: { 
              ...state.operations, 
              updating: { ...state.operations.updating, [id]: false } 
            }
          }));
          throw error;
        }
      },

      // DELETE Conto
      deleteConto: async (id) => {
        const state = get();
        const contoToDelete = state.conti.find(c => c.id === id);
        
        if (!contoToDelete) throw new Error("Conto non trovato");
        
        // Optimistic delete
        set(state => ({
          conti: state.conti.filter(conto => conto.id !== id),
          contiMap: Object.fromEntries(
            Object.entries(state.contiMap).filter(([key]) => parseInt(key) !== id)
          ),
          operations: { 
            ...state.operations, 
            deleting: { ...state.operations.deleting, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.delete(`/conti/${id}`);
          if (!res.data.success) throw new Error(res.data.error || "Errore eliminazione conto");
          
          set(state => ({
            lastUpdated: { ...state.lastUpdated, conti: Date.now() },
            operations: { 
              ...state.operations, 
              deleting: { ...state.operations.deleting, [id]: false } 
            }
          }));
        } catch (error: any) {
          // Rollback in caso di errore
          set(state => ({
            conti: contoToDelete ? [...state.conti, contoToDelete] : state.conti,
            contiMap: contoToDelete 
              ? { ...state.contiMap, [id]: contoToDelete.nome } 
              : state.contiMap,
            errors: { ...state.errors, conti: error.message },
            operations: { 
              ...state.operations, 
              deleting: { ...state.operations.deleting, [id]: false } 
            }
          }));
          throw error;
        }
      },

      // Caricamento branche con cache per conto
      loadBranche: async (contoId, { force = false } = {}) => {
        const state = get();
        if (!force && 
            state.brancheByConto[contoId] && 
            Date.now() - (state.lastUpdated.branche[contoId] || 0) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, branche: null } });
        
        try {
          const res = await apiClient.get(`/branche?conto_id=${contoId}`);
          if (!res.data.success) throw new Error("Errore caricamento branche");
          
          const newBrancheMap = { ...state.brancheMap };
          res.data.data.forEach((branca: Branca) => {
            newBrancheMap[branca.id] = branca.nome;
          });
          
          set({
            brancheByConto: { ...state.brancheByConto, [contoId]: res.data.data },
            brancheMap: newBrancheMap,
            isLoading: false,
            lastUpdated: { 
              ...state.lastUpdated, 
              branche: { ...state.lastUpdated.branche, [contoId]: Date.now() } 
            },
            errors: { ...state.errors, branche: null }
          });
        } catch (err: any) {
          set({
            isLoading: false,
            errors: { ...state.errors, branche: err.message || "Errore sconosciuto" }
          });
        }
      },

      // CREATE Branca
      createBranca: async (data) => {
        set({ operations: { ...get().operations, creatingBranca: true } });
        
        try {
          // Map frontend data to backend format
          const backendData = {
            nome: data.nome,
            contoid: data.contoId || data.contoid
          };
          
          const res = await apiClient.post("/branche", backendData);
          if (!res.data.success) throw new Error(res.data.error || "Errore creazione branca");
          
          const newBranca = res.data.data;
          set(state => ({
            brancheByConto: {
              ...state.brancheByConto,
              [data.contoId]: [...(state.brancheByConto[data.contoId] || []), newBranca]
            },
            brancheMap: { ...state.brancheMap, [newBranca.id]: newBranca.nome },
            operations: { ...state.operations, creatingBranca: false }
          }));
          
          return newBranca;
        } catch (error: any) {
          set(state => ({
            errors: { ...state.errors, branche: error.message },
            operations: { ...state.operations, creatingBranca: false }
          }));
          throw error;
        }
      },

      // UPDATE Branca
      updateBranca: async (id, data) => {
        const state = get();
        const previousBranca = Object.values(state.brancheByConto)
          .flat()
          .find(b => b.id === id);
        
        // Optimistic update
        set(state => ({
          brancheByConto: Object.fromEntries(
            Object.entries(state.brancheByConto).map(([contoId, branche]) => [
              contoId,
              branche.map(branca => 
                branca.id === id ? { ...branca, ...data } : branca
              )
            ])
          ),
          brancheMap: data.nome ? { ...state.brancheMap, [id]: data.nome } : state.brancheMap,
          operations: { 
            ...state.operations, 
            updatingBranca: { ...state.operations.updatingBranca, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.put(`/branche/${id}`, data);
          if (!res.data.success) throw new Error(res.data.error || "Errore aggiornamento branca");
          
          const updatedBranca = res.data.data;
          set(state => ({
            brancheByConto: Object.fromEntries(
              Object.entries(state.brancheByConto).map(([contoId, branche]) => [
                contoId,
                branche.map(branca => 
                  branca.id === id ? updatedBranca : branca
                )
              ])
            ),
            brancheMap: { ...state.brancheMap, [id]: updatedBranca.nome },
            operations: { 
              ...state.operations, 
              updatingBranca: { ...state.operations.updatingBranca, [id]: false } 
            }
          }));
          
          return updatedBranca;
        } catch (error: any) {
          // Rollback in caso di errore
          set(state => ({
            brancheByConto: previousBranca
              ? Object.fromEntries(
                  Object.entries(state.brancheByConto).map(([contoId, branche]) => [
                    contoId,
                    branche.map(branca => 
                      branca.id === id ? previousBranca : branca
                    )
                  ])
                )
              : Object.fromEntries(
                  Object.entries(state.brancheByConto).map(([contoId, branche]) => [
                    contoId,
                    branche.filter(b => b.id !== id)
                  ])
                ),
            brancheMap: previousBranca
              ? { ...state.brancheMap, [id]: previousBranca.nome }
              : Object.fromEntries(Object.entries(state.brancheMap).filter(([key]) => parseInt(key) !== id)),
            errors: { ...state.errors, branche: error.message },
            operations: { 
              ...state.operations, 
              updatingBranca: { ...state.operations.updatingBranca, [id]: false } 
            }
          }));
          throw error;
        }
      },

      // DELETE Branca
      deleteBranca: async (id) => {
        const state = get();
        const brancaToDelete = Object.values(state.brancheByConto)
          .flat()
          .find(b => b.id === id);
        
        if (!brancaToDelete) throw new Error("Branca non trovata");
        
        // Optimistic delete
        set(state => ({
          brancheByConto: Object.fromEntries(
            Object.entries(state.brancheByConto).map(([contoId, branche]) => [
              contoId,
              branche.filter(b => b.id !== id)
            ])
          ),
          brancheMap: Object.fromEntries(
            Object.entries(state.brancheMap).filter(([key]) => parseInt(key) !== id)
          ),
          operations: { 
            ...state.operations, 
            deletingBranca: { ...state.operations.deletingBranca, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.delete(`/branche/${id}`);
          if (!res.data.success) throw new Error(res.data.error || "Errore eliminazione branca");
          
          set(state => ({
            operations: { 
              ...state.operations, 
              deletingBranca: { ...state.operations.deletingBranca, [id]: false } 
            }
          }));
        } catch (error: any) {
          // Rollback in caso di errore
          set(state => ({
            brancheByConto: Object.fromEntries(
              Object.entries(state.brancheByConto).map(([contoId, branche]) => [
                contoId,
                brancaToDelete.contoId === parseInt(contoId) 
                  ? [...branche, brancaToDelete] 
                  : branche
              ])
            ),
            brancheMap: { ...state.brancheMap, [id]: brancaToDelete.nome },
            errors: { ...state.errors, branche: error.message },
            operations: { 
              ...state.operations, 
              deletingBranca: { ...state.operations.deletingBranca, [id]: false } 
            }
          }));
          throw error;
        }
      },

      // Caricamento sottoconti con cache per branca
      loadSottoconti: async (brancaId, { force = false } = {}) => {
        const state = get();
        if (!force && 
            state.sottocontiByBranca[brancaId] && 
            Date.now() - (state.lastUpdated.sottoconti[brancaId] || 0) < CACHE_DURATION) {
          return;
        }

        set({ isLoading: true, errors: { ...state.errors, sottoconti: null } });
        
        try {
          const res = await apiClient.get(`/sottoconti?branca_id=${brancaId}`);
          if (!res.data.success) throw new Error("Errore caricamento sottoconti");
          
          const newSottocontiMap = { ...state.sottocontiMap };
          res.data.data.forEach((sottoconto: Sottoconto) => {
            newSottocontiMap[sottoconto.id] = sottoconto.nome;
          });
          
          set({
            sottocontiByBranca: { ...state.sottocontiByBranca, [brancaId]: res.data.data },
            sottocontiMap: newSottocontiMap,
            isLoading: false,
            lastUpdated: { 
              ...state.lastUpdated, 
              sottoconti: { ...state.lastUpdated.sottoconti, [brancaId]: Date.now() } 
            },
            errors: { ...state.errors, sottoconti: null }
          });
        } catch (err: any) {
          set({
            isLoading: false,
            errors: { ...state.errors, sottoconti: err.message || "Errore sconosciuto" }
          });
        }
      },

      // CREATE Sottoconto
      createSottoconto: async (data) => {
        set({ operations: { ...get().operations, creatingSottoconto: true } });
        
        try {
          // Map frontend data to backend format
          const backendData = {
            nome: data.nome,
            brancaid: data.brancaId || data.brancaid
          };
          
          const res = await apiClient.post("/sottoconti", backendData);
          if (!res.data.success) throw new Error(res.data.error || "Errore creazione sottoconto");
          
          const newSottoconto = res.data.data;
          set(state => ({
            sottocontiByBranca: {
              ...state.sottocontiByBranca,
              [data.brancaId]: [...(state.sottocontiByBranca[data.brancaId] || []), newSottoconto]
            },
            sottocontiMap: { ...state.sottocontiMap, [newSottoconto.id]: newSottoconto.nome },
            operations: { ...state.operations, creatingSottoconto: false }
          }));
          
          return newSottoconto;
        } catch (error: any) {
          set(state => ({
            errors: { ...state.errors, sottoconti: error.message },
            operations: { ...state.operations, creatingSottoconto: false }
          }));
          throw error;
        }
      },

      // Funzioni per Sottoconti (UPDATE e DELETE) - simile a quelle per Branche
      updateSottoconto: async (id, data) => {
        // Implementazione simile a updateBranca
        const state = get();
        const previousSottoconto = Object.values(state.sottocontiByBranca)
          .flat()
          .find(s => s.id === id);
        
        set(state => ({
          sottocontiByBranca: Object.fromEntries(
            Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
              brancaId,
              sottoconti.map(sottoconto => 
                sottoconto.id === id ? { ...sottoconto, ...data } : sottoconto
              )
            ])
          ),
          sottocontiMap: data.nome ? { ...state.sottocontiMap, [id]: data.nome } : state.sottocontiMap,
          operations: { 
            ...state.operations, 
            updatingSottoconto: { ...state.operations.updatingSottoconto, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.put(`/sottoconti/${id}`, data);
          if (!res.data.success) throw new Error(res.data.error || "Errore aggiornamento sottoconto");
          
          const updatedSottoconto = res.data.data;
          set(state => ({
            sottocontiByBranca: Object.fromEntries(
              Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
                brancaId,
                sottoconti.map(sottoconto => 
                  sottoconto.id === id ? updatedSottoconto : sottoconto
                )
              ])
            ),
            sottocontiMap: { ...state.sottocontiMap, [id]: updatedSottoconto.nome },
            operations: { 
              ...state.operations, 
              updatingSottoconto: { ...state.operations.updatingSottoconto, [id]: false } 
            }
          }));
          
          return updatedSottoconto;
        } catch (error: any) {
          set(state => ({
            sottocontiByBranca: previousSottoconto
              ? Object.fromEntries(
                  Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
                    brancaId,
                    sottoconti.map(sottoconto => 
                      sottoconto.id === id ? previousSottoconto : sottoconto
                    )
                  ])
                )
              : Object.fromEntries(
                  Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
                    brancaId,
                    sottoconti.filter(s => s.id !== id)
                  ])
                ),
            sottocontiMap: previousSottoconto
              ? { ...state.sottocontiMap, [id]: previousSottoconto.nome }
              : Object.fromEntries(Object.entries(state.sottocontiMap).filter(([key]) => parseInt(key) !== id)),
            errors: { ...state.errors, sottoconti: error.message },
            operations: { 
              ...state.operations, 
              updatingSottoconto: { ...state.operations.updatingSottoconto, [id]: false } 
            }
          }));
          throw error;
        }
      },

      // DELETE Sottoconto
      deleteSottoconto: async (id) => {
        const state = get();
        const sottocontoToDelete = Object.values(state.sottocontiByBranca)
          .flat()
          .find(s => s.id === id);
        
        if (!sottocontoToDelete) throw new Error("Sottoconto non trovato");
        
        set(state => ({
          sottocontiByBranca: Object.fromEntries(
            Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
              brancaId,
              sottoconti.filter(s => s.id !== id)
            ])
          ),
          sottocontiMap: Object.fromEntries(
            Object.entries(state.sottocontiMap).filter(([key]) => parseInt(key) !== id)
          ),
          operations: { 
            ...state.operations, 
            deletingSottoconto: { ...state.operations.deletingSottoconto, [id]: true } 
          }
        }));
        
        try {
          const res = await apiClient.delete(`/sottoconti/${id}`);
          if (!res.data.success) throw new Error(res.data.error || "Errore eliminazione sottoconto");
          
          set(state => ({
            operations: { 
              ...state.operations, 
              deletingSottoconto: { ...state.operations.deletingSottoconto, [id]: false } 
            }
          }));
        } catch (error: any) {
          set(state => ({
            sottocontiByBranca: Object.fromEntries(
              Object.entries(state.sottocontiByBranca).map(([brancaId, sottoconti]) => [
                brancaId,
                sottocontoToDelete.brancaId === parseInt(brancaId) 
                  ? [...sottoconti, sottocontoToDelete] 
                  : sottoconti
              ])
            ),
            sottocontiMap: { ...state.sottocontiMap, [id]: sottocontoToDelete.nome },
            errors: { ...state.errors, sottoconti: error.message },
            operations: { 
              ...state.operations, 
              deletingSottoconto: { ...state.operations.deletingSottoconto, [id]: false } 
            }
          }));
          throw error;
        }
      },

      invalidateCache: () => set({
        conti: [],
        brancheByConto: {},
        sottocontiByBranca: {},
        lastUpdated: { conti: 0, branche: {}, sottoconti: {} }
      }),

      getContoById: (id) => get().conti.find(c => c.id === id),
      
      getBrancaById: (id) => {
        const state = get();
        const branca = Object.values(state.brancheByConto)
          .flat()
          .find(b => b.id === id);
        return branca;
      },
      
      getSottocontoById: (id) => {
        const state = get();
        const sottoconto = Object.values(state.sottocontiByBranca)
          .flat()
          .find(s => s.id === id);
        return sottoconto;
      },

      getFlatData: () => {
        const { conti, brancheByConto, sottocontiByBranca } = get();
        const data: SearchResult[] = [];

        conti.forEach(conto => {
          data.push({ id: conto.id, type: 'conto', nome: conto.nome, path: conto.nome });

          const branche = brancheByConto[conto.id] || [];
          branche.forEach(branca => {
            const path = `${conto.nome} > ${branca.nome}`;
            data.push({ id: branca.id, type: 'branca', nome: branca.nome, path });

            const sottoconti = sottocontiByBranca[branca.id] || [];
            sottoconti.forEach(sottoconto => {
              const subPath = `${path} > ${sottoconto.nome}`;
              data.push({ id: sottoconto.id, type: 'sottoconto', nome: sottoconto.nome, path: subPath });
            });
          });
        });

        return data;
      }
    }),
    {
      name: "conti-store",
      partialize: (state) => ({
        conti: state.conti,
        brancheByConto: state.brancheByConto,
        sottocontiByBranca: state.sottocontiByBranca,
        lastUpdated: state.lastUpdated
      })
    }
  )
);

// Hook ottimizzati con caricamento automatico
export const useConti = () => {
  const { conti, isLoading, errors, loadConti, createConto, updateConto, deleteConto, operations } = useContiStore();
  
  useEffect(() => {
    loadConti();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    conti,
    isLoading,
    error: errors.conti,
    load: () => loadConti({ force: true }),
    createConto,
    updateConto,
    deleteConto,
    isCreating: operations.creating,
    isUpdating: operations.updating,
    isDeleting: operations.deleting
  };
};

export const useBranche = (contoId: number | null) => {
  const { brancheByConto, isLoading, errors, loadBranche, createBranca, updateBranca, deleteBranca, operations } = useContiStore();
  
  const stableLoadBranche = useCallback((id: number) => {
    loadBranche(id);
  }, [loadBranche]);
  
  useEffect(() => {
    if (contoId) stableLoadBranche(contoId);
  }, [contoId, stableLoadBranche]);

  return {
    branche: contoId ? (brancheByConto[contoId] || []) : [],
    isLoading,
    error: errors.branche,
    load: () => contoId && loadBranche(contoId, { force: true }),
    createBranca,
    updateBranca,
    deleteBranca,
    isCreating: operations.creatingBranca,
    isUpdating: operations.updatingBranca,
    isDeleting: operations.deletingBranca
  };
};

export const useSottoconti = (brancaId: number | null) => {
  const { sottocontiByBranca, isLoading, errors, loadSottoconti, createSottoconto, updateSottoconto, deleteSottoconto, operations } = useContiStore();
  
  const stableLoadSottoconti = useCallback((id: number) => {
    loadSottoconti(id);
  }, [loadSottoconti]);
  
  useEffect(() => {
    if (brancaId) stableLoadSottoconti(brancaId);
  }, [brancaId, stableLoadSottoconti]);

  return {
    sottoconti: brancaId ? (sottocontiByBranca[brancaId] || []) : [],
    isLoading,
    error: errors.sottoconti,
    load: () => brancaId && loadSottoconti(brancaId, { force: true }),
    createSottoconto,
    updateSottoconto,
    deleteSottoconto,
    isCreating: operations.creatingSottoconto,
    isUpdating: operations.updatingSottoconto,
    isDeleting: operations.deletingSottoconto
  };
};