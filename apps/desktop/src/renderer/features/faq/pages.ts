import terms from "./pages/terms.html?raw";
import offer from "./pages/offer.html?raw";
import privacy from "./pages/privacy.html?raw";
import faq from "./pages/faq.html?raw";
import smilies from "./pages/smilies.html?raw";
import bbcodes from "./pages/bbcodes.html?raw";
import trophies from "./pages/trophies.html?raw";
import cookies from "./pages/cookies.html?raw";
import usergroups from "./pages/usergroups.html?raw";
import keywords from "./pages/keywords.html?raw";
import ads from "./pages/ads.html?raw";
import termsCss from "./page-css/terms.css?raw";
import offerCss from "./page-css/offer.css?raw";
import privacyCss from "./page-css/privacy.css?raw";
import faqCss from "./page-css/faq.css?raw";
import smiliesCss from "./page-css/smilies.css?raw";
import bbcodesCss from "./page-css/bbcodes.css?raw";
import trophiesCss from "./page-css/trophies.css?raw";
import cookiesCss from "./page-css/cookies.css?raw";
import usergroupsCss from "./page-css/usergroups.css?raw";
import keywordsCss from "./page-css/keywords.css?raw";

export type FaqTab =
  | "terms"
  | "offer"
  | "privacy"
  | "faq"
  | "smilies"
  | "bbcodes"
  | "trophies"
  | "cookies"
  | "usergroups"
  | "keywords";

export const FAQ_PAGES: Record<FaqTab, string> = {
  terms,
  offer,
  privacy,
  faq,
  smilies,
  bbcodes,
  trophies,
  cookies,
  usergroups,
  keywords,
};

export const FAQ_PAGE_STYLES: Record<FaqTab, string> = {
  terms: termsCss,
  offer: offerCss,
  privacy: privacyCss,
  faq: faqCss,
  smilies: smiliesCss,
  bbcodes: bbcodesCss,
  trophies: trophiesCss,
  cookies: cookiesCss,
  usergroups: usergroupsCss,
  keywords: keywordsCss,
};

export const ADS_PAGE = ads;
