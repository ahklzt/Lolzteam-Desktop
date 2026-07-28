import type { DiscordPresenceActivity } from "@lzt/shared";
import { useEffect } from "react";
import { create } from "zustand";

interface PresenceStore {
  activity: DiscordPresenceActivity;
  set: (activity: DiscordPresenceActivity) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  activity: { kind: "idle" },
  set: (activity) => set({ activity }),
}));

export const useReportPresence = (
  activity: DiscordPresenceActivity | null,
): void => {
  const key = activity ? JSON.stringify(activity) : null;
  useEffect(() => {
    if (!key) return;
    usePresenceStore.getState().set(JSON.parse(key) as DiscordPresenceActivity);
  }, [key]);
};

export const useDiscordPresenceSync = (): void => {
  const activity = usePresenceStore((s) => s.activity);
  useEffect(() => {
    window.moderator.discordRpc.setActivity(activity);
  }, [activity]);
};
