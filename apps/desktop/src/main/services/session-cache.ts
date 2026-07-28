import { promises as fs } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import log from "electron-log/main";

interface CacheEntry {
  savedAt: number;
  ttlMs: number;
  data: unknown;
}
type CacheShape = Record<string, CacheEntry>;

const FILE_NAME = "session-cache.json";
const cacheFile = () => join(app.getPath("userData"), FILE_NAME);

let mem: CacheShape | null = null;

const load = async (): Promise<CacheShape> => {
  if (mem) return mem;
  try {
    const raw = await fs.readFile(cacheFile(), "utf8");
    const trimmed = raw.trim();
    if (trimmed === "") {
      mem = {};
      return mem;
    }
    const parsed = JSON.parse(trimmed) as CacheShape;
    mem = parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      log.warn("[cache] failed to load, resetting cache file", err);
      try {
        await fs.rm(cacheFile(), { force: true });
      } catch {
      }
    }
    mem = {};
  }
  return mem;
};

const persist = async (): Promise<void> => {
  if (!mem) return;
  try {
    const file = cacheFile();
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(mem, null, 2), "utf8");
    await fs.rename(tmp, file);
  } catch (err) {
    log.warn("[cache] failed to persist", err);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  const c = await load();
  const entry = c[key];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > entry.ttlMs) {
    delete c[key];
    await persist();
    return null;
  }
  return entry.data as T;
};

export const setCache = async (
  key: string,
  data: unknown,
  ttlMs = 60_000,
): Promise<void> => {
  const c = await load();
  c[key] = { savedAt: Date.now(), ttlMs, data };
  await persist();
};

export const invalidateCache = async (key: string): Promise<void> => {
  const c = await load();
  if (c[key]) {
    delete c[key];
    await persist();
  }
};

export const clearSessionCache = async (): Promise<void> => {
  mem = {};
  try {
    await fs.rm(cacheFile(), { force: true });
  } catch (err) {
    log.warn("[cache] failed to clear", err);
  }
};

export const clearSessionCacheSync = (): void => {
  mem = {};
  try {
    // eslint-disable-next-line no-sync
    require("node:fs").rmSync(cacheFile(), { force: true });
  } catch (err) {
    log.warn("[cache] failed to clear (sync)", err);
  }
};
