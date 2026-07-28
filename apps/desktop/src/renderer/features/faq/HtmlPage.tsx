import { useMemo } from "react";
import fontCss from "./site-css/font.css?raw";
import xenforoCss from "./site-css/xenforo.css?raw";
import formPublicCss from "./site-css/form-public.css?raw";
import helpCss from "./site-css/help.css?raw";
import styles from "./HtmlPage.module.scss";

const BASE_CSS = `
:root{color-scheme:dark}
html,body{margin:0}
body{background:rgb(20,20,20)}
img{max-width:100%;height:auto}
`;

const ADAPT_CSS = `
.navigationSideBar,.help_sidebar,.mainSideBar{display:none!important}
.container{max-width:none!important;width:100%!important;margin:0!important;padding:0!important;display:block!important}
.mainContentBlock{float:none!important;margin:0 auto!important;max-width:900px!important;width:100%!important;box-sizing:border-box!important}
.user_group_header_preview{opacity:1!important}
.bbCode{overflow:hidden}
.bbCode > dl > dd,.baseHtml{overflow-wrap:anywhere;word-break:normal}
/* Убираем подчёркивание ссылок при наведении/фокусе — как и в самом приложении.
   Внутри iframe действует родной CSS форума, поэтому перечисляем и его
   специфичные/!important-правила (.concealed a:hover и т.п.), чтобы перебить каскад. */
a:hover,a:focus,a:active,
a.concealed:hover,.concealed a:hover,
.emCtrl:hover,.emCtrl:focus,.ugc a:hover,.ugc a:focus,
.quoteExpand:hover,.embed-link-wrapper:hover .internal-link,
.contentRow-minor--hideLinks a:hover{text-decoration:none!important}
`;

const wrapDocument = (html: string): string =>
  `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
  `<base href="https://lolz.team/" target="_blank">` +
  `<style>${BASE_CSS}</style>` +
  `<style>${fontCss}</style>` +
  `<style>${xenforoCss}</style>` +
  `<style>${formPublicCss}</style>` +
  `<style>${helpCss}</style>` +
  `</head><body>${html}<style>${ADAPT_CSS}</style></body></html>`;

interface HtmlPageProps {
  html: string;
  className?: string;
}

export const HtmlPage = ({ html, className }: HtmlPageProps) => {
  const srcDoc = useMemo(() => wrapDocument(html), [html]);
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
