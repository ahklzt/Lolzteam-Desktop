import type { HistoryEntry } from "@lzt/shared";


const toWebpBase64 = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/webp", 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

export const cacheMediaUrl = async (url: string): Promise<void> => {
  if (!url || url.startsWith("data:")) return;
  const webp = await toWebpBase64(url);
  if (!webp) return;
  await window.moderator.history.cacheMedia(url, webp).catch(() => {});
};

export const cacheMediaUrls = (urls: string[]): void => {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  void (async () => {
    for (const u of unique) await cacheMediaUrl(u);
  })();
};

export const loadCachedMedia = (id: string): Promise<{ dataUrl: string } | null> =>
  window.moderator.history.getMedia(id);

export const extractImageUrls = (html: string): string[] => {
  if (!html) return [];
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (m[1]) urls.push(m[1]);
  return urls;
};

export const allMediaIds = (entry: HistoryEntry): string[] => {
  const ids = [...entry.mediaIds];
  for (const r of entry.revisions) ids.push(...r.mediaIds);
  return Array.from(new Set(ids));
};
