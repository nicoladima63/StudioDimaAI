import { create } from 'zustand';

interface FattureState {
  anniDisponibili: number[];
  setAnniDisponibili: (anni: number[]) => void;
}

export const useFattureStore = create<FattureState>()((set) => ({
  anniDisponibili: [],
  setAnniDisponibili: (anni: number[]) => set({ anniDisponibili: anni }),
})); 