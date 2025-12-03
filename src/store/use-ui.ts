import { create } from "zustand";

interface UIState {
  genHint: boolean;
  setGenHint: (v?: boolean) => void;
  clearGenHint: () => void;
  generatedOpen: boolean;
  openGenerated: () => void;
  closeGenerated: () => void;
}

export const useUI = create<UIState>((set) => ({
  genHint: false,
  setGenHint: (v = true) => set({ genHint: !!v }),
  clearGenHint: () => set({ genHint: false }),

  generatedOpen: false,
  openGenerated: () => set({ generatedOpen: true, genHint: false }),
  closeGenerated: () => set({ generatedOpen: false }),
}));

