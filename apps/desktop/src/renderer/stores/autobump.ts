import type { AutoBumpState, AutoBumpThread } from "@lzt/shared";
import { create } from "zustand";

interface AutoBumpStore {
  state: AutoBumpState | null;
  loading: boolean;
  load: () => Promise<void>;
  subscribe: () => () => void;
  setGlobal: (patch: {
    enabled?: boolean;
    tickSeconds?: number;
    jitterMin?: number;
  }) => Promise<void>;
  addThread: (ref: string) => Promise<{ ok: boolean; message?: string }>;
  updateThread: (
    threadId: number,
    patch: Partial<AutoBumpThread>,
  ) => Promise<void>;
  removeThread: (threadId: number) => Promise<void>;
  bumpNow: (threadId: number) => Promise<{ ok: boolean; message?: string }>;
  clearLog: () => Promise<void>;
}

export const useAutoBumpStore = create<AutoBumpStore>((set) => ({
  state: null,
  loading: false,
  load: async () => {
    set({ loading: true });
    const state = await window.moderator.autobump.get();
    set({ state, loading: false });
  },
  subscribe: () =>
    window.moderator.autobump.onChanged((state) => set({ state })),
  setGlobal: async (patch) => {
    set({ state: await window.moderator.autobump.setGlobal(patch) });
  },
  addThread: async (ref) => {
    const res = await window.moderator.autobump.addThread(ref);
    if (res.ok && res.state) set({ state: res.state });
    return { ok: res.ok, message: res.message };
  },
  updateThread: async (threadId, patch) => {
    set({ state: await window.moderator.autobump.updateThread(threadId, patch) });
  },
  removeThread: async (threadId) => {
    set({ state: await window.moderator.autobump.removeThread(threadId) });
  },
  bumpNow: async (threadId) => {
    const res = await window.moderator.autobump.bumpNow(threadId);
    if (res.state) set({ state: res.state });
    return { ok: res.ok, message: res.message };
  },
  clearLog: async () => {
    set({ state: await window.moderator.autobump.clearLog() });
  },
}));
