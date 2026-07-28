import { MARKET_CURRENCIES } from "@lzt/shared";
import type { MarketCurrency } from "@lzt/shared";

export const formatSum = (value: number, currency: string): string => {
  const code = currency || "RUB";
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${code}`;
  }
};

export const formatDate = (unixSeconds: number): string => {
  if (!unixSeconds) return "\u2014";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return String(unixSeconds);
  }
};

export const toMarketCurrency = (
  value: string | null | undefined,
): MarketCurrency | undefined => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  return (MARKET_CURRENCIES as readonly string[]).includes(lower)
    ? (lower as MarketCurrency)
    : undefined;
};
