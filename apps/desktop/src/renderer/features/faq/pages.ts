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

export const ADS_PAGE = ads;
