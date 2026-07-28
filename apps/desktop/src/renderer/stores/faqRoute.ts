import { create } from "zustand";
import type { FaqTab } from "~/features/faq/pages";

interface FaqRouteState {
  tab: FaqTab | null;
  nonce: number;
  open: (tab: FaqTab) => void;
  clear: () => void;
}

export const useFaqRoute = create<FaqRouteState>((set) => ({
  tab: null,
  nonce: 0,
  open: (tab) => set((state) => ({ tab, nonce: state.nonce + 1 })),
  clear: () => set({ tab: null }),
}));
