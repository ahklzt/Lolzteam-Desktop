import type { MarketCurrency, MarketPublishInput } from "@lzt/shared";

export interface ParsedAccount {
  login: string;
  password: string;
  email: string;
  emailPassword: string;
}

export interface ParsedRow {
  sourceLine: number;
  account: ParsedAccount | null;
  error: string | null;
}

export interface BulkConfig {
  categoryId: number;
  currency: MarketCurrency;
  initialPrice: number;
  origin: string;
  guarantee: number;
  title: string;
  description: string;
  information: string;
  extra: Record<string, string | number | boolean>;
}

export const ORIGIN_OPTIONS = [
  "brute",
  "phishing",
  "stealer",
  "autoreg",
  "personal",
  "resale",
  "dummy",
  "self_registration",
  "retrieve_via_support",
] as const;

export const GUARANTEE_OPTIONS = [-1, 0, 1] as const;

export const MAX_PARALLEL = 3;
export const MIN_PROTECTIVE_PRICE = 1;
export const MAX_ACCOUNTS = 1000;

export const parseAccountsText = (text: string): ParsedRow[] => {
  const rows: ParsedRow[] = [];
  const lines = String(text ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const sourceLine = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(":");
    const p0 = parts[0]?.trim() ?? "";
    const p1 = parts[1]?.trim() ?? "";
    let account: ParsedAccount | null = null;
    if (parts.length === 2 && p0 && p1) {
      account = { login: p0, password: p1, email: "", emailPassword: "" };
    } else if (parts.length >= 4) {
      const p2 = parts[2]?.trim() ?? "";
      const rest = parts.slice(3).join(":").trim();
      if (p0 && p1 && p2 && rest) {
        account = { login: p0, password: p1, email: p2, emailPassword: rest };
      }
    }
    rows.push({ sourceLine, account, error: account ? null : "format" });
  }
  return rows;
};

const SAFE_EXTRA_KEY = /^[a-z][a-z0-9_]{0,63}$/i;
const BLOCKED_EXTRA_KEY = /(?:token|password|secret|cookie|authorization|login)/i;

export const safeExtra = (
  source: unknown,
): Record<string, string | number | boolean> => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(
    source as Record<string, unknown>,
  ).slice(0, 100)) {
    if (!SAFE_EXTRA_KEY.test(key) || BLOCKED_EXTRA_KEY.test(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
};

export const buildPublishInput = (
  account: ParsedAccount,
  config: BulkConfig,
): MarketPublishInput => {
  const input: MarketPublishInput = {
    categoryId: config.categoryId,
    price: config.initialPrice,
    currency: config.currency,
    loginData: `${account.login}:${account.password}`,
    guarantee: config.guarantee,
    originId: config.origin,
  };
  if (account.email && account.emailPassword) {
    input.emailLoginData = `${account.email}:${account.emailPassword}`;
  }
  if (config.title) input.title = config.title;
  if (config.description) input.description = config.description;
  if (config.information) input.information = config.information;
  if (Object.keys(config.extra).length > 0) input.extra = config.extra;
  return input;
};

export const redactAccount = (
  message: string,
  account: ParsedAccount,
): string => {
  let text = String(message ?? "");
  for (const value of [
    account.login,
    account.password,
    account.email,
    account.emailPassword,
  ]) {
    if (value) text = text.split(value).join("[\u0441\u043a\u0440\u044b\u0442\u043e]");
  }
  return text.slice(0, 300);
};
