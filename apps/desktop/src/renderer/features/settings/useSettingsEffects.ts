import { useEffect } from "react";
import { useSettingsStore } from "~/stores/settings";
import {
  getThemeCssVariables,
  isLightThemePalette,
  resolveThemePalette,
} from "~/theme/app-themes";

const pathToFileUrl = (value: string): string => {
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("file://")) return normalized;
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(normalized);
};

export const useSettingsEffects = (): void => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const palette = resolveThemePalette(settings.appTheme, settings.customTheme);
    const lightTheme = isLightThemePalette(palette);

    root.dataset.appTheme = settings.appTheme;
    root.style.colorScheme = lightTheme ? "light" : "dark";
    for (const [property, value] of Object.entries(
      getThemeCssVariables(palette),
    )) {
      root.style.setProperty(property, value);
    }

    if (settings.appFont && settings.appFont !== "system") {
      root.style.setProperty("--app-font", settings.appFont);
    } else {
      root.style.removeProperty("--app-font");
    }

    if (settings.appBackgroundPath) {
      const fileUrl = pathToFileUrl(settings.appBackgroundPath).replaceAll(
        '"',
        "%22",
      );
      const overlay = lightTheme
        ? "linear-gradient(rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.86)), "
        : "linear-gradient(rgba(10, 12, 16, 0.78), rgba(10, 12, 16, 0.9)), ";
      root.style.setProperty(
        "--app-bg-image",
        `${overlay}url("${fileUrl}")`,
      );
    } else {
      root.style.setProperty("--app-bg-image", "none");
    }

    root.style.setProperty(
      "--app-content-width",
      `${Math.max(1220, settings.contentWidth ?? 1220)}px`,
    );

    root.style.setProperty("--avatar-radius", `${settings.avatarRadius}%`);

    root.style.setProperty("--msg-radius", `${settings.messageRadius}px`);
    root.style.setProperty(
      "--msg-scale",
      String(settings.messageFontScale / 100),
    );

    root.classList.toggle("hide-notif-badges", settings.hideNotificationBadges);
  }, [settings]);
};
