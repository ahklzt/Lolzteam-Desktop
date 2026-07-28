
import log from "electron-log";
import type { GifSearchResult } from "@lzt/shared";

const TENOR_KEY = process.env["TENOR_API_KEY"] ?? "LIVDSRZULELA";
const TENOR_BASE = "https" + "://g.tenor.com/v1";
const TIMEOUT_MS = 12_000;

type TenorFormat = { url?: string; dims?: number[] };
type TenorResult = {
  id?: string;
  url?: string;
  media?: Array<Record<string, TenorFormat>>;
  media_formats?: Record<string, TenorFormat>;
};

export const searchTenorGif = async (
  query: string,
  pos?: string,
): Promise<GifSearchResult> => {
  const q = query.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      key: TENOR_KEY,
      limit: "24",
      media_filter: "minimal",
      contentfilter: "high",
      locale: "ru_RU",
    });
    if (pos) params.set("pos", pos);
    let url: string;
    if (q) {
      params.set("q", q);
      url = `${TENOR_BASE}/search?${params.toString()}`;
    } else {
      url = `${TENOR_BASE}/trending?${params.toString()}`;
    }
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false, message: `tenor_${res.status}` };
    const data = (await res.json()) as {
      results?: TenorResult[];
      next?: string;
    };
    const items = (data.results ?? [])
      .map((r) => {
        const formats = r.media_formats ?? r.media?.[0] ?? {};
        const full = formats["gif"]?.url ?? formats["mediumgif"]?.url;
        const preview =
          formats["tinygif"]?.url ?? formats["nanogif"]?.url ?? full;
        const dims = formats["tinygif"]?.dims ?? formats["gif"]?.dims;
        if (!full || !preview) return null;
        return {
          id: r.id ?? full,
          previewUrl: preview,
          url: full,
          width: dims?.[0] ?? 0,
          height: dims?.[1] ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { ok: true, items, next: data.next ?? null };
  } catch (err) {
    log.warn("[media] tenor search failed", err);
    return { ok: false, message: "offline" };
  } finally {
    clearTimeout(timer);
  }
};
