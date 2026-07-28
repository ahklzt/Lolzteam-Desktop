
import { create } from "zustand";
import { DEFAULT_FORUM_FILTERS, type ForumFilters } from "./forum-store";

export interface ForumCustomTab {
  id: string;
  name: string;
  forumIds: number[];
  filters: ForumFilters;
  isDefault: boolean;
}

const STORAGE_KEY = "lzt.forum.customTabs";

const genId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
};

const loadTabs = (): ForumCustomTab[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ForumCustomTab[]) : [];
  } catch {
    return [];
  }
};

const saveTabs = (tabs: ForumCustomTab[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
  }
};

interface ForumTabsState {
  tabs: ForumCustomTab[];
  addTab: (input: {
    name: string;
    forumIds: number[];
    filters: ForumFilters;
    isDefault: boolean;
  }) => ForumCustomTab;
  removeTab: (id: string) => void;
  setDefault: (id: string, value: boolean) => void;
}

export const useForumTabsStore = create<ForumTabsState>((set) => ({
  tabs: loadTabs(),
  addTab: (input) => {
    const tab: ForumCustomTab = {
      id: genId(),
      name: input.name.trim() || "",
      forumIds: input.forumIds,
      filters: { ...DEFAULT_FORUM_FILTERS, ...input.filters },
      isDefault: input.isDefault,
    };
    set((state) => {
      const others = tab.isDefault
        ? state.tabs.map((t) => ({ ...t, isDefault: false }))
        : state.tabs;
      const tabs = [...others, tab];
      saveTabs(tabs);
      return { tabs };
    });
    return tab;
  },
  removeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      saveTabs(tabs);
      return { tabs };
    }),
  setDefault: (id, value) =>
    set((state) => {
      const tabs = state.tabs.map((t) => ({
        ...t,
        isDefault: t.id === id ? value : value ? false : t.isDefault,
      }));
      saveTabs(tabs);
      return { tabs };
    }),
}));

export const getDefaultForumTab = (): ForumCustomTab | null =>
  useForumTabsStore.getState().tabs.find((t) => t.isDefault) ?? null;
