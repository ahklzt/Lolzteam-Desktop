import type { AppThemeId, AppThemePalette } from "@lzt/shared";

export interface AppThemeDefinition extends AppThemePalette {
  id: Exclude<AppThemeId, "custom">;
}

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: "dark",
    name: "Тёмная",
    background: "#141414",
    surface: "#1c1c1c",
    surfaceRaised: "#242424",
    surfaceOverlay: "#303030",
    text: "#eaeaea",
    textSoft: "#d6d6d6",
    textMuted: "#949494",
    accent: "#00ba78",
    accentSoft: "#228e5d",
    accentDark: "#009660",
  },
  {
    id: "light",
    name: "Белая",
    background: "#eef1f4",
    surface: "#ffffff",
    surfaceRaised: "#f5f7f9",
    surfaceOverlay: "#e4e9ee",
    text: "#1f252b",
    textSoft: "#3b4650",
    textMuted: "#6f7b86",
    accent: "#087e5b",
    accentSoft: "#2e9b79",
    accentDark: "#066848",
  },
  {
    id: "green",
    name: "Зелёная",
    background: "#0c0f0e",
    surface: "#111615",
    surfaceRaised: "#181e1c",
    surfaceOverlay: "#1e2725",
    text: "#eaeaea",
    textSoft: "#d6d6d6",
    textMuted: "#8ca29a",
    accent: "#00ba78",
    accentSoft: "#228e5d",
    accentDark: "#009660",
  },
  {
    id: "purple",
    name: "Фиолетовая",
    background: "#14121a",
    surface: "#1e1a27",
    surfaceRaised: "#292234",
    surfaceOverlay: "#382e47",
    text: "#f2edf8",
    textSoft: "#d9cee8",
    textMuted: "#9e91ad",
    accent: "#a66cff",
    accentSoft: "#8d5bd7",
    accentDark: "#7744bd",
  },
];

export const DEFAULT_CUSTOM_THEME: AppThemePalette = {
  name: "Моя тема",
  background: "#101820",
  surface: "#17232d",
  surfaceRaised: "#20313e",
  surfaceOverlay: "#2b4050",
  text: "#eef6fa",
  textSoft: "#cedde5",
  textMuted: "#8fa7b3",
  accent: "#38bdf8",
  accentSoft: "#249acb",
  accentDark: "#147ca8",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const normalizeColor = (value: unknown, fallback: string): string =>
  typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;

export const normalizeCustomTheme = (
  value: AppThemePalette | null | undefined,
): AppThemePalette => ({
  name:
    typeof value?.name === "string" && value.name.trim()
      ? value.name.trim().slice(0, 40)
      : DEFAULT_CUSTOM_THEME.name,
  background: normalizeColor(value?.background, DEFAULT_CUSTOM_THEME.background),
  surface: normalizeColor(value?.surface, DEFAULT_CUSTOM_THEME.surface),
  surfaceRaised: normalizeColor(
    value?.surfaceRaised,
    DEFAULT_CUSTOM_THEME.surfaceRaised,
  ),
  surfaceOverlay: normalizeColor(
    value?.surfaceOverlay,
    DEFAULT_CUSTOM_THEME.surfaceOverlay,
  ),
  text: normalizeColor(value?.text, DEFAULT_CUSTOM_THEME.text),
  textSoft: normalizeColor(value?.textSoft, DEFAULT_CUSTOM_THEME.textSoft),
  textMuted: normalizeColor(value?.textMuted, DEFAULT_CUSTOM_THEME.textMuted),
  accent: normalizeColor(value?.accent, DEFAULT_CUSTOM_THEME.accent),
  accentSoft: normalizeColor(value?.accentSoft, DEFAULT_CUSTOM_THEME.accentSoft),
  accentDark: normalizeColor(value?.accentDark, DEFAULT_CUSTOM_THEME.accentDark),
});

export const resolveThemePalette = (
  id: AppThemeId,
  customTheme: AppThemePalette | null,
): AppThemePalette => {
  if (id === "custom") return normalizeCustomTheme(customTheme);
  return APP_THEMES.find((theme) => theme.id === id) ?? APP_THEMES[0]!;
};

export const getThemeCssVariables = (
  palette: AppThemePalette,
): Record<string, string> => ({
  "--theme-bg": palette.background,
  "--theme-surface": palette.surface,
  "--theme-surface-raised": palette.surfaceRaised,
  "--theme-surface-overlay": palette.surfaceOverlay,
  "--theme-text": palette.text,
  "--theme-text-soft": palette.textSoft,
  "--theme-text-muted": palette.textMuted,
  "--theme-accent": palette.accent,
  "--theme-accent-soft": palette.accentSoft,
  "--theme-accent-dark": palette.accentDark,
  "--theme-border": `color-mix(in srgb, ${palette.text} 8%, transparent)`,
  "--theme-border-strong": `color-mix(in srgb, ${palette.text} 15%, transparent)`,
  "--theme-shadow": `color-mix(in srgb, ${palette.background} 72%, transparent)`,
});

export const isLightThemePalette = (palette: AppThemePalette): boolean => {
  const hex = palette.background.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 255_000 > 0.56;
};
