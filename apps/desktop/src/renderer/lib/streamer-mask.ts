
import { useEffect } from "react";
import {
  BANWORD_REPLACEMENT_TEXT,
  type StreamerSettings,
} from "@lzt/shared";
import { useStreamerStore } from "~/stores/streamer";

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let banRegexKey = "";
let banRegexCached: RegExp | null = null;

const getBanRegex = (words: string[]): RegExp | null => {
  if (words.length === 0) return null;
  const key = words.map((w) => w.toLowerCase()).sort().join("|");
  if (key === banRegexKey && banRegexCached) return banRegexCached;
  const alt = words.map((w) => escapeRegex(w)).join("|");
  const rx = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "giu");
  banRegexKey = key;
  banRegexCached = rx;
  return rx;
};

export const filterBanwords = (
  text: string,
  settings: StreamerSettings,
): string => {
  if (!settings.enabled || !settings.banwordsEnabled) return text;
  if (!text) return text;
  const rx = getBanRegex(settings.banwords);
  if (!rx) return text;
  const rep = BANWORD_REPLACEMENT_TEXT[settings.banwordReplacement];
  rx.lastIndex = 0;
  return text.replace(rx, rep);
};

export const filterBanwordsHtml = (
  html: string,
  settings: StreamerSettings,
): string => {
  if (!settings.enabled || !settings.banwordsEnabled) return html;
  if (!html) return html;
  const rx = getBanRegex(settings.banwords);
  if (!rx) return html;
  const rep = BANWORD_REPLACEMENT_TEXT[settings.banwordReplacement];

  const doc = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    targets.push(n as Text);
    n = walker.nextNode();
  }
  for (const t of targets) {
    const src = t.nodeValue ?? "";
    if (!src) continue;
    rx.lastIndex = 0;
    const next = src.replace(rx, rep);
    if (next !== src) t.nodeValue = next;
  }
  return doc.body.innerHTML;
};

export const maskCredential = (raw: string | null | undefined): string => {
  const s = (raw ?? "").toString();
  const n = Math.min(24, Math.max(4, s.length || 8));
  return "•".repeat(n);
};

const FLAG_CLASSES: Array<[keyof StreamerSettings, string]> = [
  ["hideBalance", "sm-hide-balance"],
  ["hidePaymentHistory", "sm-hide-payment-history"],
  ["hidePaymentStats", "sm-hide-payment-stats"],
  ["hidePendingPayments", "sm-hide-pending-payments"],
  ["hideRecentlyViewed", "sm-hide-recently-viewed"],
  ["hidePurchasedAccounts", "sm-hide-purchased-accounts"],
  ["hideConversationList", "sm-hide-conversation-list"],
  ["blurMessageBodies", "sm-blur-message-bodies"],
  ["hideMessageBadge", "sm-hide-message-badge"],
  ["hideNotifications", "sm-hide-notifications"],
  ["hideAccountCredentials", "sm-hide-account-credentials"],
  ["hideSecretAnswers", "sm-hide-secret-answers"],
  ["hideModeratorTools", "sm-hide-moderator-tools"],
  ["hideForumTeamFeatures", "sm-hide-forum-team"],
  ["hideServiceElements", "sm-hide-service"],
];

export const useStreamerBodyClass = (): void => {
  const settings = useStreamerStore((s) => s.settings);
  useEffect(() => {
    const b = document.body;
    if (!b) return;
    b.classList.toggle("streamer-mode-active", settings.enabled);
    b.classList.toggle(
      "streamer-mode-blur",
      settings.enabled && settings.maskMode === "blur",
    );
    b.classList.toggle(
      "streamer-mode-hide",
      settings.enabled && settings.maskMode === "hide",
    );
    b.classList.toggle(
      "streamer-reveal-on-click",
      settings.enabled && settings.revealOnClick,
    );
    for (const [k, cls] of FLAG_CLASSES) {
      const on = settings.enabled && Boolean(settings[k]);
      b.classList.toggle(cls, on);
    }
    b.style.setProperty(
      "--streamer-blur",
      `${settings.blurRadiusPx}px`,
    );
    b.style.setProperty(
      "--streamer-transition",
      `${settings.transitionMs}ms`,
    );
  }, [settings]);
};

export const useStreamerSync = (): void => {
  const load = useStreamerStore((s) => s.load);
  const subscribe = useStreamerStore((s) => s.subscribe);
  useEffect(() => {
    void load();
    return subscribe();
  }, [load, subscribe]);
  useStreamerBodyClass();
};
