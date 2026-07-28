import { promises as fs } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import log from "electron-log/main";
import { atomicWrite } from "./atomic-store";

interface LocalNoteEntry {
  text: string;
  updatedAt: number;
}

interface LocalDataShape {
  userNotes: Record<string, LocalNoteEntry>;
  itemNotes: Record<string, LocalNoteEntry>;
}

const FILE_NAME = "local-data.json";
const dataFile = () => join(app.getPath("userData"), FILE_NAME);

const EMPTY: LocalDataShape = { userNotes: {}, itemNotes: {} };

let cached: LocalDataShape | null = null;

const load = async (): Promise<LocalDataShape> => {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDataShape>;
    cached = {
      userNotes:
        parsed.userNotes && typeof parsed.userNotes === "object"
          ? parsed.userNotes
          : {},
      itemNotes:
        parsed.itemNotes && typeof parsed.itemNotes === "object"
          ? parsed.itemNotes
          : {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("[local-data] failed to load, using empty", err);
    }
    cached = { userNotes: {}, itemNotes: {} };
  }
  return cached;
};

const persist = async (data: LocalDataShape): Promise<void> => {
  cached = data;
  await atomicWrite(dataFile(), JSON.stringify(data, null, 2));
};

export const getUserNote = async (userId: number): Promise<string> => {
  const data = await load();
  return data.userNotes[String(userId)]?.text ?? "";
};

export const setUserNote = async (
  userId: number,
  text: string,
): Promise<void> => {
  const data = await load();
  const key = String(userId);
  const trimmed = text.trim();
  const next: LocalDataShape = { ...data, userNotes: { ...data.userNotes } };
  if (trimmed) {
    next.userNotes[key] = { text: trimmed, updatedAt: Date.now() };
  } else {
    delete next.userNotes[key];
  }
  await persist(next);
};

export const listUserNotes = async (): Promise<
  Array<{ userId: number; text: string; updatedAt: number }>
> => {
  const data = await load();
  return Object.entries(data.userNotes)
    .map(([id, e]) => ({
      userId: Number(id),
      text: e.text,
      updatedAt: e.updatedAt,
    }))
    .filter((n) => Number.isFinite(n.userId) && n.userId > 0 && n.text)
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteUserNote = async (userId: number): Promise<void> => {
  await setUserNote(userId, "");
};


export const getItemNote = async (itemId: number): Promise<string> => {
  const data = await load();
  return data.itemNotes[String(itemId)]?.text ?? "";
};

export const setItemNote = async (
  itemId: number,
  text: string,
): Promise<void> => {
  const data = await load();
  const key = String(itemId);
  const trimmed = text.trim();
  const next: LocalDataShape = { ...data, itemNotes: { ...data.itemNotes } };
  if (trimmed) {
    next.itemNotes[key] = { text: trimmed, updatedAt: Date.now() };
  } else {
    delete next.itemNotes[key];
  }
  await persist(next);
};

export const listItemNotes = async (): Promise<
  Array<{ itemId: number; text: string; updatedAt: number }>
> => {
  const data = await load();
  return Object.entries(data.itemNotes)
    .map(([id, e]) => ({ itemId: Number(id), text: e.text, updatedAt: e.updatedAt }))
    .filter((n) => Number.isFinite(n.itemId) && n.itemId > 0 && n.text)
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteItemNote = async (itemId: number): Promise<void> => {
  await setItemNote(itemId, "");
};
