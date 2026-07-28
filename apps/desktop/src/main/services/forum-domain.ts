import { LZT_CONFIG } from "@lzt/shared";

let detected: string | null = null;

export const rememberForumUrl = (absoluteUrl?: string | null): void => {
  if (!absoluteUrl) return;
  try {
    const u = new URL(absoluteUrl);
    if (u.protocol === "https:" || u.protocol === "http:") {
      detected = `${u.protocol}//${u.host}`;
    }
  } catch {
  }
};

export const getForumWebUrl = (): string => detected ?? LZT_CONFIG.webUrl;
