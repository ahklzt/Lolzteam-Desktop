import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { StorageCategory, StorageUsage } from "@lzt/shared";
import { app, session } from "electron";
import log from "electron-log/main";
import { getCachedSettings, getSettings } from "../settings/settings-store";

const dataRoot = (): string => join(app.getPath("userData"), "data");
const IMAGES_DIR = (): string => join(dataRoot(), "cache", "media_cache");
const STICKERS_DIR = (): string => join(dataRoot(), "emoji");
const ANIM_DIR = (): string => join(dataRoot(), "cache", "anim_cache");

interface FileStat {
  path: string;
  size: number;
  mtimeMs: number;
}

async function listFiles(dir: string): Promise<FileStat[]> {
  const out: FileStat[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = join(dir, ent.name);
      const st = await fs.stat(full).catch(() => null);
      if (st) out.push({ path: full, size: st.size, mtimeMs: st.mtimeMs });
    }
  } catch {
  }
  return out;
}

const sumSize = (files: FileStat[]): number =>
  files.reduce((acc, f) => acc + f.size, 0);

const dirBytes = async (dir: string): Promise<number> =>
  sumSize(await listFiles(dir));

async function sessionCacheBytes(): Promise<number> {
  try {
    return await session.defaultSession.getCacheSize();
  } catch {
    return 0;
  }
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const [images, stickers, animations, cache] = await Promise.all([
    dirBytes(IMAGES_DIR()),
    dirBytes(STICKERS_DIR()),
    dirBytes(ANIM_DIR()),
    sessionCacheBytes(),
  ]);
  return {
    images,
    stickers,
    animations,
    cache,
    totalBytes: images + stickers + animations + cache,
  };
}

async function emptyDir(dir: string): Promise<void> {
  for (const f of await listFiles(dir)) {
    await fs.unlink(f.path).catch(() => {});
  }
}

export async function clearStorage(
  category: StorageCategory | "all",
): Promise<StorageUsage> {
  try {
    if (category === "images" || category === "all") await emptyDir(IMAGES_DIR());
    if (category === "stickers" || category === "all")
      await emptyDir(STICKERS_DIR());
    if (category === "animations" || category === "all")
      await emptyDir(ANIM_DIR());
    if (category === "cache" || category === "all")
      await session.defaultSession.clearCache().catch(() => {});
  } catch (err) {
    log.warn("[storage] clear failed", err);
  }
  return getStorageUsage();
}

const MB = 1024 * 1024;

async function enforceLimit(dirs: string[], limitBytes: number): Promise<void> {
  if (limitBytes <= 0) return;
  let files: FileStat[] = [];
  for (const d of dirs) files = files.concat(await listFiles(d));
  let total = sumSize(files);
  if (total <= limitBytes) return;
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const f of files) {
    if (total <= limitBytes) break;
    await fs.unlink(f.path).catch(() => {});
    total -= f.size;
  }
}

async function enforceAge(dirs: string[], maxAgeDays: number): Promise<void> {
  if (maxAgeDays <= 0) return;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  for (const d of dirs) {
    for (const f of await listFiles(d)) {
      if (f.mtimeMs < cutoff) await fs.unlink(f.path).catch(() => {});
    }
  }
}

export async function autoCleanStorage(): Promise<void> {
  const settings = getCachedSettings() ?? (await getSettings());
  if (!settings.autoCleanCache) return;
  const mediaDirs = [IMAGES_DIR(), STICKERS_DIR(), ANIM_DIR()];
  try {
    await enforceAge(mediaDirs, settings.cacheMaxAgeDays);
    await enforceLimit([IMAGES_DIR(), ANIM_DIR()], settings.mediaCacheLimitMb * MB);
    await enforceLimit(mediaDirs, settings.storageLimitMb * MB);
  } catch (err) {
    log.warn("[storage] auto-clean failed", err);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startStorageAutoClean(): void {
  void autoCleanStorage();
  if (timer) clearInterval(timer);
  timer = setInterval(() => void autoCleanStorage(), 6 * 60 * 60 * 1000);
}
