import { create } from "zustand";
import {
  DEFAULT_STREAMER_SETTINGS,
  type StreamerSettings,
} from "@lzt/shared";

interface State {
  settings: StreamerSettings;
  loaded: boolean;
  load: () => Promise<void>;
  subscribe: () => () => void;
  patch: (patch: Partial<StreamerSettings>) => Promise<void>;
  reset: () => Promise<void>;
  exportJson: () => Promise<string>;
  importJson: (raw: string) => Promise<void>;
}

export const useStreamerStore = create<State>((set) => ({
  settings: { ...DEFAULT_STREAMER_SETTINGS },
  loaded: false,
  load: async () => {
    const s = await window.moderator.streamer.get();
    set({ settings: s, loaded: true });
  },
  subscribe: () =>
    window.moderator.streamer.onChanged((s) =>
      set({ settings: s, loaded: true }),
    ),
  patch: async (p) => {
    const s = await window.moderator.streamer.set(p);
    set({ settings: s, loaded: true });
  },
  reset: async () => {
    const s = await window.moderator.streamer.reset();
    set({ settings: s, loaded: true });
  },
  exportJson: () => window.moderator.streamer.exportJson(),
  importJson: async (raw) => {
    const s = await window.moderator.streamer.importJson(raw);
    set({ settings: s, loaded: true });
  },
}));

export const useStreamerFlag = (
  key: keyof StreamerSettings,
): boolean => {
  return useStreamerStore((s) => {
    if (!s.settings.enabled) return false;
    const v = s.settings[key];
    return typeof v === "boolean" ? v : Boolean(v);
  });
};
