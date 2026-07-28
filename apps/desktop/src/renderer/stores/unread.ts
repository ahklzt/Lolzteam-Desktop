import { create } from "zustand";
import { i18n } from "~/i18n";
import { pushToast } from "./toast";

interface UnreadState {
  messages: number;
  notifications: number;
  loaded: boolean;
  setMessages: (n: number) => void;
  setNotifications: (n: number) => void;
  refresh: () => Promise<void>;
}

export const useUnread = create<UnreadState>((set) => ({
  messages: 0,
  notifications: 0,
  loaded: false,
  setMessages: (n) => set({ messages: n }),
  setNotifications: (n) => set({ notifications: n }),
  refresh: async () => {
    const [conv, notif] = await Promise.all([
      window.moderator.profile.getConversations().catch(() => null),
      window.moderator.profile.getNotifications().catch(() => null),
    ]);
    const prev = useUnread.getState();
    const messages = conv && conv.ok ? conv.unreadTotal : prev.messages;
    const notifications =
      notif && notif.ok ? notif.unreadTotal : prev.notifications;

    if (prev.loaded) {
      if (messages > prev.messages) {
        pushToast({
          kind: "info",
          title: i18n.t("toast.newMessages"),
          message: `+${messages - prev.messages}`,
        });
      }
      if (notifications > prev.notifications) {
        pushToast({
          kind: "info",
          title: i18n.t("toast.newNotifications"),
          message: `+${notifications - prev.notifications}`,
        });
      }
    }

    set({ messages, notifications, loaded: true });
  },
}));

export const startUnreadPolling = (intervalMs = 45_000): (() => void) => {
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    void useUnread.getState().refresh();
  };

  void useUnread.getState().refresh();
  const timer = setInterval(tick, intervalMs);

  const onFocus = () => void useUnread.getState().refresh();
  const onVisible = () => {
    if (!document.hidden) void useUnread.getState().refresh();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    clearInterval(timer);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  };
};
