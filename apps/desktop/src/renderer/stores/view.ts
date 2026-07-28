import { create } from "zustand";
import { useMarketRoute } from "./marketRoute";
import { useForumStore } from "~/features/forum/forum-store";

export type ViewId =
  | "market"
  | "forum"
  | "tools"
  | "profile"
  | "settings"
  | "messages"
  | "faq"
  | "ads"
  | `plugin:${string}`;

interface ViewState {
  view: ViewId;
  profileNonce: number;
  setView: (view: ViewId) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: "market",
  profileNonce: 0,
  setView: (view) => {
    if (view === "market") useMarketRoute.getState().back();
    if (view === "forum")
      useForumStore.getState().selectSection({ type: "all" });
    set((state) => ({
      view,
      profileNonce:
        view === "profile" ? state.profileNonce + 1 : state.profileNonce,
    }));
  },
}));
