import {
  LZT_CONFIG,
  type MarketCartMutationResult,
  type MarketCartResult,
  type MarketErrorReason,
  type MarketFastBuyResult,
  type MarketItem,
  type MarketItemsPage,
  type MarketPurchaseError,
  type MarketPurchasePreview,
  type MarketPurchasePreviewResult,
  type MarketPurchaseSuccess,
} from "@lzt/shared";
import log from "electron-log/main";
import { loadToken } from "../auth/token-store";
import { appFetch } from "./app-fetch";

const TIMEOUT_MS = 30_000;
const FAST_BUY_TIMEOUT_MS = 180_000;
const VERIFY_DELAY_MS = 3_000;
const MAX_ATTEMPTS = 100;
const RETRY_DELAY_MS = 1_500;

type RequestOk = { ok: true; status: number; data: Record<string, unknown> };
type RequestErr = { ok: false; reason: MarketErrorReason };
type RequestResult = RequestOk | RequestErr;

const reasonFromStatus = (status: number): MarketErrorReason => {
  if (status === 401) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "network";
  return "bad_response";
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const request = async (
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, unknown>,
  timeoutMs = TIMEOUT_MS,
): Promise<RequestResult> => {
  const token = await loadToken();
  if (!token) return { ok: false, reason: "no_token" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: true, status: res.status, data };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    log.error(`[market-buy] ${method} ${path} failed`, err);
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
};

const errorsOf = (data: Record<string, unknown>): string[] =>
  Array.isArray(data.errors)
    ? data.errors.filter((entry): entry is string => typeof entry === "string")
    : [];

const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseDepositAmount = (value: string): number | undefined => {
  const match = /amount=(\d+(?:[.,]\d+)?)/.exec(value);
  const found = match ? match[1] : undefined;
  if (!found) return undefined;
  const amount = Number(found.replace(",", "."));
  return Number.isFinite(amount) ? amount : undefined;
};

export const isRetryRequest = (errors: string[]): boolean =>
  errors.some((entry) => entry.trim().toLowerCase() === "retry_request");

export const classifyPurchaseError = (
  errors: string[],
): MarketPurchaseError | null => {
  if (errors.length === 0) return null;
  const raw = errors.join(" ");
  const text = stripHtml(raw);
  if (/enough money|недостаточно/i.test(text)) {
    const amount = parseDepositAmount(raw);
    return amount === undefined
      ? { kind: "not_enough_balance", message: text }
      : { kind: "not_enough_balance", message: text, depositAmount: amount };
  }
  if (/is sold|продан/i.test(text)) return { kind: "item_sold", message: text };
  if (/removed by the site administration|удал/i.test(text)) {
    return { kind: "item_deleted", message: text };
  }
  if (/own product|свой товар/i.test(text)) {
    return { kind: "own_item", message: text };
  }
  if (/blacklist|чёрный список|черный список/i.test(text)) {
    return { kind: "blacklisted", message: text };
  }
  if (/daily limit of checks|лимит проверок/i.test(text)) {
    return { kind: "check_limit", message: text };
  }
  if (/video/i.test(text)) return { kind: "video_required", message: text };
  return { kind: "unknown", message: text };
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toPage = (data: Record<string, unknown>, page: number): MarketItemsPage => {
  const items = Array.isArray(data.items) ? (data.items as MarketItem[]) : [];
  return {
    items,
    totalItems: asNumber(data.totalItems) ?? items.length,
    hasNextPage: Boolean(data.hasNextPage),
    perPage: asNumber(data.perPage) ?? items.length,
    page: asNumber(data.page) ?? page,
  };
};

const toPreview = (
  itemId: number,
  data: Record<string, unknown>,
): MarketPurchasePreview => {
  const item = asRecord(data.item);
  const seller = asRecord(item.seller);
  const guarantee = asRecord(item.guarantee);
  const links = Array.isArray(item.accountLinks)
    ? item.accountLinks
        .map((entry) => {
          const row = asRecord(entry);
          const link = asString(row.link);
          if (!link) return null;
          return { link, text: asString(row.text) ?? link };
        })
        .filter((entry): entry is { link: string; text: string } => entry !== null)
    : [];
  const extraPrices = Array.isArray(item.extraPrices)
    ? item.extraPrices
        .map((entry) => {
          const row = asRecord(entry);
          const currency = asString(row.currency);
          const price = row.price === undefined ? null : String(row.price);
          if (!currency || !price) return null;
          return { currency, price };
        })
        .filter((entry): entry is { currency: string; price: string } => entry !== null)
    : [];

  return {
    itemId: asNumber(item.item_id) ?? itemId,
    title: asString(item.title) ?? asString(item.title_en) ?? `#${itemId}`,
    price: asNumber(item.price) ?? 0,
    currency: (asString(item.price_currency) ?? "").toUpperCase(),
    rubPrice: asNumber(item.rub_price),
    categoryId: asNumber(item.category_id) ?? 0,
    categoryTitle: asString(item.category_title),
    itemOrigin: asString(item.item_origin),
    itemOriginPhrase: asString(item.itemOriginPhrase),
    itemState: asString(item.item_state),
    publishedDate: asNumber(item.published_date),
    accountLastActivity: asNumber(item.account_last_activity),
    hasGuarantee: Boolean(item.guarantee) || item.has_guarantee === 1,
    guaranteePhrase: asString(guarantee.durationPhrase),
    emailType: asString(item.email_type),
    loginType: asString(item.login_type),
    descriptionPlain:
      asString(item.descriptionPlain) ?? asString(item.description) ?? "",
    sellerId: asNumber(seller.user_id),
    sellerUsername: asString(seller.username),
    canValidateAccount: Boolean(item.canValidateAccount),
    requireVideoRecording:
      item.require_video_recording === 1 || Boolean(data.requireVideoRecording),
    buyWithoutValidation: item.buy_without_validation === 1,
    accountLinks: links,
    extraPrices,
  };
};

const toPurchase = (
  itemId: number,
  data: Record<string, unknown>,
): MarketPurchaseSuccess => {
  const item = asRecord(data.item);
  const loginData = asRecord(item.loginData);
  const emailLoginData = asRecord(item.emailLoginData);
  return {
    itemId: asNumber(item.item_id) ?? itemId,
    title: asString(item.title) ?? asString(item.title_en) ?? `#${itemId}`,
    price: asNumber(item.price),
    currency: asString(item.price_currency),
    login: asString(loginData.login) ?? asString(item.login),
    password: asString(loginData.password),
    raw: asString(loginData.raw),
    emailLogin: asString(emailLoginData.login),
    emailPassword: asString(emailLoginData.password),
    adviceToChangePassword: Boolean(loginData.adviceToChangePassword),
  };
};

export const getPurchasePreview = async (
  itemId: number,
): Promise<MarketPurchasePreviewResult> => {
  const res = await request(`/${itemId}`, "GET");
  if (!res.ok) return { ok: false, reason: res.reason };
  const errors = errorsOf(res.data);
  const error = classifyPurchaseError(errors);
  if (error) {
    return {
      ok: false,
      reason: reasonFromStatus(res.status),
      message: error.message,
      error,
    };
  }
  if (res.status >= 400) {
    return { ok: false, reason: reasonFromStatus(res.status) };
  }
  return { ok: true, preview: toPreview(itemId, res.data) };
};

const verifyPurchase = async (
  itemId: number,
): Promise<MarketPurchaseSuccess | null> => {
  await sleep(VERIFY_DELAY_MS);
  const res = await request(`/${itemId}`, "GET");
  if (!res.ok || res.status >= 400) return null;
  const item = asRecord(res.data.item);
  const loginData = asRecord(item.loginData);
  const owned = Boolean(asString(loginData.login) ?? asString(loginData.raw));
  if (!owned) return null;
  log.info(`[market-buy] item ${itemId} already purchased, timeout ignored`);
  return toPurchase(itemId, res.data);
};

export const fastBuyAccount = async (
  itemId: number,
  price: number,
  balanceId?: number,
): Promise<MarketFastBuyResult> => {
  const body: Record<string, unknown> = { price };
  if (typeof balanceId === "number") body.balance_id = balanceId;

  let attempts = 0;
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const res = await request(
      `/${itemId}/fast-buy`,
      "POST",
      body,
      FAST_BUY_TIMEOUT_MS,
    );
    if (!res.ok) {
      if (res.reason === "timeout" || res.reason === "network") {
        const verified = await verifyPurchase(itemId);
        if (verified) return { ok: true, attempts, purchase: verified };
      }
      return { ok: false, attempts, reason: res.reason };
    }

    const errors = errorsOf(res.data);
    if (isRetryRequest(errors)) {
      if (attempts >= MAX_ATTEMPTS) break;
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const status = asString(res.data.status);
    if (res.status < 400 && errors.length === 0 && (status === "ok" || res.data.item)) {
      log.info(`[market-buy] bought item ${itemId} in ${attempts} attempt(s)`);
      return { ok: true, attempts, purchase: toPurchase(itemId, res.data) };
    }

    if (res.status >= 400 && errors.length > 0) {
      const verified = await verifyPurchase(itemId);
      if (verified) return { ok: true, attempts, purchase: verified };
    }

    const error = classifyPurchaseError(errors);
    if (error) {
      log.warn(`[market-buy] fast-buy ${itemId} -> ${error.kind}`);
      return {
        ok: false,
        attempts,
        reason: reasonFromStatus(res.status),
        message: error.message,
        error,
      };
    }
    return { ok: false, attempts, reason: reasonFromStatus(res.status) };
  }

  log.warn(`[market-buy] fast-buy ${itemId} retry limit reached`);
  return {
    ok: false,
    attempts,
    reason: "rate_limited",
    message: "retry_request",
    error: { kind: "retry_limit", message: "retry_request" },
  };
};

export const getCartItems = async (page = 1): Promise<MarketCartResult> => {
  const res = await request(`/cart?page=${page}`, "GET");
  if (!res.ok) return { ok: false, reason: res.reason };
  const error = classifyPurchaseError(errorsOf(res.data));
  if (error) {
    return { ok: false, reason: reasonFromStatus(res.status), message: error.message };
  }
  if (res.status >= 400) return { ok: false, reason: reasonFromStatus(res.status) };
  return { ok: true, page: toPage(res.data, page) };
};

const cartMutate = async (
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
): Promise<MarketCartMutationResult> => {
  const res = await request("/cart", method, body, 45_000);
  if (!res.ok) return { ok: false, reason: res.reason };
  const error = classifyPurchaseError(errorsOf(res.data));
  if (error) {
    return {
      ok: false,
      reason: reasonFromStatus(res.status),
      message: error.message,
      error,
    };
  }
  if (res.status >= 400) return { ok: false, reason: reasonFromStatus(res.status) };
  return { ok: true };
};

export const addCartItem = (itemId: number): Promise<MarketCartMutationResult> =>
  cartMutate("POST", { item_id: itemId });

export const removeCartItem = (itemId: number): Promise<MarketCartMutationResult> =>
  cartMutate("DELETE", { item_id: itemId });

export const clearCart = (): Promise<MarketCartMutationResult> =>
  cartMutate("DELETE");
