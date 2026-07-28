import { useEffect } from "react";
import { useSettingsStore } from "~/stores/settings";

export const useSettingsEffects = (): void => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    if (settings.appFont && settings.appFont !== "system") {
      root.style.setProperty("--app-font", settings.appFont);
    } else {
      root.style.removeProperty("--app-font");
    }

    root.style.setProperty("--avatar-radius", `${settings.avatarRadius}%`);

    root.style.setProperty("--msg-radius", `${settings.messageRadius}px`);
    root.style.setProperty(
      "--msg-scale",
      String(settings.messageFontScale / 100),
    );

    root.classList.toggle("hide-notif-badges", settings.hideNotificationBadges);
  }, [settings]);
};
