import { create } from "zustand";

interface ForumMiniProfileState {
  userId: string | number | null;
  open: (userId: string | number) => void;
  close: () => void;
}

export const useForumMiniProfile = create<ForumMiniProfileState>((set) => ({
  userId: null,
  open: (userId) => set({ userId }),
  close: () => set({ userId: null }),
}));
