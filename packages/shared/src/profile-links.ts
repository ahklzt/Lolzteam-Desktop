
import { LZT_CONFIG } from "./config";

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, "");
let siteBase = trimTrailingSlash(LZT_CONFIG.webUrl);

export const setForumWebBase = (url: string): void => {
  const trimmed = trimTrailingSlash((url ?? "").trim());
  if (/^https?:\/\//i.test(trimmed)) siteBase = trimmed;
};

export const getForumWebBase = (): string => siteBase;

const enc = (value: string): string =>
  encodeURIComponent(value).replace(/%20/g, "+");

export const profileSiteLinks = {
  conversation: (username: string): string =>
    `${siteBase}/conversations/add?to=${enc(username)}`,

  giftUpgrade: (userId: number): string =>
    `${siteBase}/account/upgrades?gift_user_id=${userId}`,

  moneyDispute: (userId: number): string =>
    `${siteBase}/forums/239/create-thread?user_id=${userId}`,

  complaint: (userId: number, username: string): string => {
    const title = `Жалоба на пользователя ${username}`;
    const message = [
      `1. Профиль нарушителя: ${siteBase}/members/${userId}/`,
      "2. Краткое описание жалобы:",
      "3. Доказательства:",
    ].join("\n");
    return `${siteBase}/forums/801/create-thread?title=${enc(title)}&message=${enc(message)}`;
  },

  sharedIps: (userId: number): string => `${siteBase}/${userId}/shared-ips`,

  thread: (threadId: number): string => `${siteBase}/threads/${threadId}/`,

  findGuarantor: (): string => `${siteBase}/guarantor/`,

  member: (userId: number): string => `${siteBase}/members/${userId}/`,

  marketItems: (userId: number): string =>
    `${LZT_CONFIG.marketWebUrl}/user/${userId}/items`,

  balanceTransfer: (userId: number): string =>
    `${siteBase}/payment/balance-transfer?user_id=${userId}&hold=1`,

  depositReplenish: (username: string): string =>
    `${siteBase}/${enc(username)}/deposit-replenish`,

  depositWithdraw: (username: string): string =>
    `${siteBase}/${enc(username)}/deposit-withdraw`,
} as const;
