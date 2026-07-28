import type {
  DataUsage,
  HistoryEntry,
  HistoryKind,
  HistoryMarkers,
  HistoryPage,
  HistoryQuery,
} from "@lzt/shared";
import { create } from "zustand";

interface HistoryStore {
  markers: HistoryMarkers;
  loaded: boolean;
  loadMarkers: () => Promise<void>;
  subscribe: () => () => void;
  query: (q: HistoryQuery) => Promise<HistoryPage>;
  getEntry: (id: string) => Promise<HistoryEntry | null>;
  deleteEntry: (id: string) => Promise<void>;
  clear: (kinds?: HistoryKind[]) => Promise<void>;
  usage: () => Promise<DataUsage>;
  purge: () => Promise<number>;
  hasEdited: (kind: "post" | "message", id: number) => boolean;
  hasDeleted: (kind: "post" | "message", id: number) => boolean;
}

const EMPTY: HistoryMarkers = { edited: {}, deleted: {} };

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  markers: EMPTY,
  loaded: false,
  loadMarkers: async () => {
    const markers = await window.moderator.history.markers();
    set({ markers: markers ?? EMPTY, loaded: true });
  },
  subscribe: () =>
    window.moderator.history.onChanged((markers) =>
      set({ markers: markers ?? EMPTY }),
    ),
  query: (q) => window.moderator.history.query(q),
  getEntry: (id) => window.moderator.history.getEntry(id),
  deleteEntry: (id) => window.moderator.history.deleteEntry(id),
  clear: (kinds) => window.moderator.history.clear(kinds),
  usage: () => window.moderator.history.usage(),
  purge: () => window.moderator.history.purge(),
  hasEdited: (kind, id) => {
    const key = (kind === "post" ? "p" : "m") + id;
    return Boolean(get().markers.edited[key]);
  },
  hasDeleted: (kind, id) => {
    const key = (kind === "post" ? "p" : "m") + id;
    return Boolean(get().markers.deleted[key]);
  },
}));
