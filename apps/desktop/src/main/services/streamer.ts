
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STREAMER_SETTINGS,
  IPC,
  clampStreamerSettings,
  normalizeBanwords,
  type StreamerSettings,
} from "@lzt/shared";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";

const FILE_NAME = "streamer.json";
const settingsFile = (): string => join(app.getPath("userData"), FILE_NAME);

let current: StreamerSettings | null = null;
let loadingPromise: Promise<StreamerSettings> | null = null;

const mergeSettings = (
  base: StreamerSettings,
  patch: Partial<StreamerSettings>,
): StreamerSettings => {
  const next: StreamerSettings = { ...base, ...patch };
  if (patch.banwords != null) next.banwords = normalizeBanwords(patch.banwords);
  return clampStreamerSettings(next);
};

const readFromDisk = async (): Promise<StreamerSettings> => {
  try {
    const raw = await fs.readFile(settingsFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StreamerSettings>;
    const picked: Partial<StreamerSettings> = {};
    for (const k of Object.keys(DEFAULT_STREAMER_SETTINGS) as Array<
      keyof StreamerSettings
    >) {
      if (k in parsed) {
        // @ts-expect-error — копируем поле с совпадающим ключом без runtime-валидации каждого типа.
        picked[k] = parsed[k];
      }
    }
    return mergeSettings(DEFAULT_STREAMER_SETTINGS, picked);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e && e.code !== "ENOENT") {
      log.warn("[streamer] read failed, using defaults:", e.message);
    }
    return { ...DEFAULT_STREAMER_SETTINGS };
  }
};

const writeToDisk = async (settings: StreamerSettings): Promise<void> => {
  const file = settingsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
    await fs.rename(tmp, file);
  } catch (err) {
    log.warn("[streamer] write failed:", (err as Error).message);
    await fs.unlink(tmp).catch(() => {});
  }
};

const broadcast = (settings: StreamerSettings): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.STREAMER_CHANGED, settings);
    }
  }
};

const ensureLoaded = async (): Promise<StreamerSettings> => {
  if (current) return current;
  if (!loadingPromise) {
    loadingPromise = readFromDisk().then((s) => {
      current = s;
      return s;
    });
  }
  return loadingPromise;
};

export const getStreamerSettings = async (): Promise<StreamerSettings> =>
  ensureLoaded();

export const setStreamerSettings = async (
  patch: Partial<StreamerSettings>,
): Promise<StreamerSettings> => {
  const base = await ensureLoaded();
  const next = mergeSettings(base, patch);
  current = next;
  await writeToDisk(next);
  broadcast(next);
  return next;
};

export const resetStreamerSettings = async (): Promise<StreamerSettings> => {
  const next = { ...DEFAULT_STREAMER_SETTINGS };
  current = next;
  await writeToDisk(next);
  broadcast(next);
  return next;
};

export const exportStreamerSettings = async (): Promise<string> => {
  const s = await ensureLoaded();
  return JSON.stringify(s, null, 2);
};

export const importStreamerSettings = async (
  raw: string,
): Promise<StreamerSettings> => {
  let parsed: Partial<StreamerSettings>;
  try {
    parsed = JSON.parse(raw) as Partial<StreamerSettings>;
  } catch {
    throw new Error("invalid_json");
  }
  return setStreamerSettings(parsed);
};
