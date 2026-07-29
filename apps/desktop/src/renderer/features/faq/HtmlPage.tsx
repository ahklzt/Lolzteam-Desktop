import { useMemo } from "react";
import type { AppThemePalette } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import {
  isLightThemePalette,
  resolveThemePalette,
} from "~/theme/app-themes";
import fontCss from "./site-css/font.css?raw";
import xenforoCss from "./site-css/xenforo.css?raw";
import formPublicCss from "./site-css/form-public.css?raw";
import helpCss from "./site-css/help.css?raw";
import styles from "./HtmlPage.module.scss";

const WEB_BASE = "https" + "://lolz.team/";

const BASE_CSS = `
html,body{margin:0}
body{background:var(--pageBackground);color:var(--contentText)}
img{max-width:100%;height:auto}
`;

const ADAPT_CSS = `
.navigationSideBar,.help_sidebar,.mainSideBar{display:none!important}
.container{max-width:none!important;width:100%!important;margin:0!important;padding:0!important;display:block!important}
.mainContentBlock{float:none!important;margin:0 auto!important;max-width:805px!important;width:100%!important;box-sizing:border-box!important}
.user_group_header_preview{opacity:1!important}
.bbCode{overflow:hidden}
.bbCode > dl > dd,.baseHtml{overflow-wrap:anywhere;word-break:normal}
a:hover,a:focus,a:active,
a.concealed:hover,.concealed a:hover,
.emCtrl:hover,.emCtrl:focus,.ugc a:hover,.ugc a:focus,
.quoteExpand:hover,.embed-link-wrapper:hover .internal-link,
.contentRow-minor--hideLinks a:hover{text-decoration:none!important}
`;

const getThemeCss = (palette: AppThemePalette): string => `
:root,body{
  --pageBackground:${palette.background};
  --contentBackground:${palette.surface};
  --contentText:${palette.textSoft};
  --faintTextColor:${palette.text};
  --mutedTextColor:${palette.textMuted};
  --primary:${palette.surfaceOverlay};
  --primaryDark:${palette.surfaceOverlay};
  --primaryDarker:${palette.surfaceRaised};
  --primaryLight:color-mix(in srgb,${palette.accent} 35%,${palette.surface});
  --primaryLighter:${palette.accentSoft};
  --primaryLighterStill:${palette.surfaceOverlay};
  --primaryMedium:${palette.accent};
  --tooltipBackground:${palette.surfaceOverlay};
  --bg:${palette.background};
  --bg-elevated:${palette.surface};
  --border:color-mix(in srgb,${palette.text} 10%,transparent);
  --text:${palette.text};
  --text-muted:${palette.textMuted};
  --accent:${palette.accent};
}
:root{color-scheme:${isLightThemePalette(palette) ? "light" : "dark"}}
body{background:var(--pageBackground);color:var(--contentText)}
`;

const wrapDocument = (
  html: string,
  themeCss: string,
  extraCss?: string,
): string =>
  `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
  `<base href="${WEB_BASE}" target="_blank">` +
  `<style>${BASE_CSS}</style>` +
  `<style>${fontCss}</style>` +
  `<style>${xenforoCss}</style>` +
  `<style>${formPublicCss}</style>` +
  `<style>${helpCss}</style>` +
  `<style>${extraCss ?? ""}</style>` +
  `<style>${themeCss}</style>` +
  `</head><body>${html}<style>${ADAPT_CSS}</style></body></html>`;

interface HtmlPageProps {
  html: string;
  className?: string;
  extraCss?: string;
}

export const HtmlPage = ({ html, className, extraCss }: HtmlPageProps) => {
  const settings = useSettingsStore((state) => state.snapshot?.settings);
  const themeCss = useMemo(
    () =>
      getThemeCss(
        resolveThemePalette(
          settings?.appTheme ?? "dark",
          settings?.customTheme ?? null,
        ),
      ),
    [settings?.appTheme, settings?.customTheme],
  );

  const srcDoc = useMemo(
    () => wrapDocument(html, themeCss, extraCss),
    [extraCss, html, themeCss],
  );

  return (
    <iframe
      className={className ?? styles.frame}
      title="content"
      srcDoc={srcDoc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  );
};
