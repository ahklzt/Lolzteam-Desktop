import type {
  DiscordRpcSettings,
  DiscordRpcSnapshot,
} from "@lzt/shared";
import { create } from "zustand";

interface DiscordRpcStore {
  snapshot: DiscordRpcSnapshot | null;
  loading: boolean;
  load: () => Promise<void>;
  subscribe: () => () => void;
  patch: (patch: Partial<DiscordRpcSettings>) => Promise<void>;
  reconnect: () => Promise<void>;
}

export const useDiscordRpcStore = create<DiscordRpcStore>((set) => ({
  snapshot: null,
  loading: false,
  load: async () => {
    set({ loading: true });
    const snapshot = await window.moderator.discordRpc.get();
    set({ snapshot, loading: false });
  },
  subscribe: () =>
    window.moderator.discordRpc.onChanged((snapshot) => set({ snapshot })),
  patch: async (patch) => {
    set({ snapshot: await window.moderator.discordRpc.set(patch) });
  },
  reconnect: async () => {
    set({ snapshot: await window.moderator.discordRpc.reconnect() });
  },
}));
