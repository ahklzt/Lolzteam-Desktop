import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { LocalUniqConfig, LocalUniqShadow } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";

const ALLOWED_PROPS = new Set([
  "color",
  "text-shadow",
  "border-radius",
  "background",
  "background-color",
  "background-image",
  "-webkit-background-clip",
  "-webkit-text-fill-color",
]);

const toCamel = (prop: string): string => {
  const vendor = prop.startsWith("-");
  const parts = prop.replace(/^-/, "").split("-");
  return parts
    .map((p, i) =>
      i === 0 && !vendor ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join("");
};

const isSafeValue = (value: string): boolean =>
  !/javascript:|expression\s*\(/i.test(value);

export const parseUniqCss = (css: string): CSSProperties => {
  const style: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (!ALLOWED_PROPS.has(prop)) continue;
    if (!isSafeValue(value)) continue;
    style[toCamel(prop)] = value;
  }
  return style as CSSProperties;
};

export const buildShadowCss = (shadows: LocalUniqShadow[]): string =>
  shadows
    .map((s) => {
      const blur = Math.min(3, Math.max(0, Number(s.blur) || 0));
      const x = Number(s.x) || 0;
      const y = Number(s.y) || 0;
      return `${x}px ${y}px ${blur}px ${s.color || "#ffffff"}`;
    })
    .join(", ");

export const buildUsernameStyle = (cfg: LocalUniqConfig): CSSProperties => {
  const style = parseUniqCss(cfg.usernameCss);
  const shadow = buildShadowCss(cfg.shadows);
  if (shadow) style.textShadow = shadow;
  return style;
};

export const buildBannerStyle = (cfg: LocalUniqConfig): CSSProperties =>
  parseUniqCss(cfg.bannerCss);

export interface LocalUniqView {
  bannerText: string;
  usernameStyle: CSSProperties;
  bannerStyle: CSSProperties;
  iconSvg: string | null;
}

export const useLocalUniq = (): LocalUniqView | null => {
  const cfg = useSettingsStore((s) => s.snapshot?.settings.localUniq);
  return useMemo(() => {
    if (!cfg?.enabled) return null;
    return {
      bannerText: cfg.bannerText.trim(),
      usernameStyle: buildUsernameStyle(cfg),
      bannerStyle: buildBannerStyle(cfg),
      iconSvg: cfg.usernameIconSvg,
    };
  }, [cfg]);
};
