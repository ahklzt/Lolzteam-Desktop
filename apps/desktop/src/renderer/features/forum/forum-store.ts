
import { create } from "zustand";

export const CONTEST_FORUM_ID = 766;
export const CONTEST_HIDDEN_IDS = new Set<number>([766, 771]);

export type ForumSection =
  | { type: "forum"; forumId: number; title: string }
  | { type: "customTab"; tabId: string; forumId: number; title: string }
  | { type: "all" }
  | { type: "my" }
  | { type: "userPosts" }
  | { type: "userThreads"; userId: number; username: string }
  | { type: "bookmarks" }
  | { type: "read" };

export type ForumScreen =
  | { type: "list" }
  | { type: "thread"; threadId: number };

export type ForumOrder =
  | "last_post_date"
  | "thread_create_date"
  | "thread_post_count"
  | "first_post_likes"
  | "noReply";

export interface ForumFilters {
  prefixId: number | null;
  excludePrefixId: number | null;
  order: ForumOrder;
  direction: "asc" | "desc";
  period: "" | "day" | "week" | "month" | "year";
  state: "" | "active" | "closed";
  dateFrom: string | null;
  dateTo: string | null;
  title: string;
  titleOnly: boolean;
}

export const DEFAULT_FORUM_FILTERS: ForumFilters = {
  prefixId: null,
  excludePrefixId: null,
  order: "last_post_date",
  direction: "desc",
  period: "",
  state: "",
  dateFrom: null,
  dateTo: null,
  title: "",
  titleOnly: false,
};

interface ForumState {
  section: ForumSection;
  screen: ForumScreen;
  page: number;
  order: ForumOrder;
  search: string;
  searchOpen: boolean;
  createOpen: boolean;
  createForumId: number | null;
  hiddenThreadIds: number[];
  filters: ForumFilters;
  selectSection: (section: ForumSection) => void;
  selectCustomTab: (tab: {
    id: string;
    name: string;
    forumIds: number[];
    filters: ForumFilters;
  }) => void;
  setFilters: (patch: Partial<ForumFilters>) => void;
  resetFilters: () => void;
  openThread: (threadId: number) => void;
  openCreate: () => void;
  closeCreate: () => void;
  backToList: () => void;
  setPage: (page: number) => void;
  setOrder: (order: ForumOrder) => void;
  setSearch: (search: string) => void;
  toggleSearch: () => void;
  hideThreadLocally: (threadId: number) => void;
}

export const useForumStore = create<ForumState>((set) => ({
  section: { type: "all" },
  screen: { type: "list" },
  page: 1,
  order: "last_post_date",
  search: "",
  searchOpen: false,
  createOpen: false,
  createForumId: null,
  hiddenThreadIds: [],
  filters: DEFAULT_FORUM_FILTERS,
  selectSection: (section) =>
    set({
      section,
      screen: { type: "list" },
      page: 1,
      filters: DEFAULT_FORUM_FILTERS,
    }),
  selectCustomTab: (tab) =>
    set({
      section: {
        type: "customTab",
        tabId: tab.id,
        forumId: tab.forumIds[0] ?? 0,
        title: tab.name,
      },
      screen: { type: "list" },
      page: 1,
      filters: tab.filters,
    }),
  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch }, page: 1 })),
  resetFilters: () => set({ filters: DEFAULT_FORUM_FILTERS, page: 1 }),
  openThread: (threadId) => set({ screen: { type: "thread", threadId } }),
  openCreate: () =>
    set((state) => ({
      createOpen: true,
      createForumId:
        state.section.type === "forum" ||
        state.section.type === "customTab"
          ? state.section.forumId
          : null,
    })),
  closeCreate: () => set({ createOpen: false }),
  backToList: () => set({ screen: { type: "list" } }),
  setPage: (page) => set({ page }),
  setOrder: (order) => set({ order, page: 1 }),
  setSearch: (search) => set({ search }),
  toggleSearch: () =>
    set((state) => ({ searchOpen: !state.searchOpen, search: "" })),
  hideThreadLocally: (threadId) =>
    set((state) => ({
      hiddenThreadIds: state.hiddenThreadIds.includes(threadId)
        ? state.hiddenThreadIds
        : [...state.hiddenThreadIds, threadId],
    })),
}));
