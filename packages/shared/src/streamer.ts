
export type StreamerMaskMode = "blur" | "hide";

export type BanwordReplacement = "asterisks" | "block" | "hidden";

export interface StreamerSettings {
  enabled: boolean;

  maskMode: StreamerMaskMode;
  revealOnClick: boolean;
  blurRadiusPx: number;
  transitionMs: number;

  hideBalance: boolean;
  hidePaymentHistory: boolean;
  hidePaymentStats: boolean;
  hidePendingPayments: boolean;
  hideRecentlyViewed: boolean;
  hidePurchasedAccounts: boolean;

  hideConversationList: boolean;
  blurMessageBodies: boolean;
  hideMessageBadge: boolean;
  hideNotifications: boolean;

  hideAccountCredentials: boolean;
  hideSecretAnswers: boolean;

  banwordsEnabled: boolean;
  banwords: string[];
  banwordReplacement: BanwordReplacement;

  hideModeratorTools: boolean;
  hideForumTeamFeatures: boolean;
  hideServiceElements: boolean;
}

export const DEFAULT_STREAMER_SETTINGS: StreamerSettings = {
  enabled: false,

  maskMode: "blur",
  revealOnClick: true,
  blurRadiusPx: 10,
  transitionMs: 220,

  hideBalance: true,
  hidePaymentHistory: true,
  hidePaymentStats: true,
  hidePendingPayments: true,
  hideRecentlyViewed: true,
  hidePurchasedAccounts: true,

  hideConversationList: true,
  blurMessageBodies: true,
  hideMessageBadge: true,
  hideNotifications: true,

  hideAccountCredentials: true,
  hideSecretAnswers: true,

  banwordsEnabled: false,
  banwords: [],
  banwordReplacement: "asterisks",

  hideModeratorTools: false,
  hideForumTeamFeatures: false,
  hideServiceElements: false,
};

export const BANWORD_REPLACEMENT_TEXT: Record<BanwordReplacement, string> = {
  asterisks: "*****",
  block: "█████",
  hidden: "[скрыто]",
};

export const normalizeBanwords = (raw: string[] | string): string[] => {
  const list = Array.isArray(raw) ? raw : raw.split(/[,\n;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of list) {
    const s = w.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
};

export const clampStreamerSettings = (
  s: StreamerSettings,
): StreamerSettings => ({
  ...s,
  blurRadiusPx: Math.min(24, Math.max(2, Math.floor(s.blurRadiusPx || 10))),
  transitionMs: Math.min(800, Math.max(0, Math.floor(s.transitionMs || 0))),
  banwords: normalizeBanwords(s.banwords),
});
