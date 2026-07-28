import { promises as fs } from "node:fs"
import { join } from "node:path"
import type { MarketItem } from "@lzt/shared"
import { app, safeStorage } from "electron"
import log from "electron-log/main"

const FILE_NAME = "accounts-cache.json"
const CACHE_VERSION = 1
const MAX_ENTRIES = 24
const MAX_ITEMS_PER_ENTRY = 3000

export interface AccountsCacheEntry {
  fetchedAt: number
  total: number
  items: MarketItem[]
}
interface CachePayload {
  version: number
  entries: Record<string, AccountsCacheEntry>
}

const cacheFile = (): string => join(app.getPath("userData"), FILE_NAME)

const serialize = (json: string): Buffer =>
  safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, "utf8")

const deserialize = (buf: Buffer): string => {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
    }
  }
  return buf.toString("utf8")
}

let mem: CachePayload | null = null

const empty = (): CachePayload => ({ version: CACHE_VERSION, entries: {} })

const load = async (): Promise<CachePayload> => {
  if (mem) return mem
  try {
    const raw = deserialize(await fs.readFile(cacheFile()))
    const parsed = JSON.parse(raw) as Partial<CachePayload>
    mem =
      parsed.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === "object"
        ? { version: CACHE_VERSION, entries: parsed.entries as Record<string, AccountsCacheEntry> }
        : empty()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("[accounts-cache] не удалось прочитать, начинаем с пустого", err)
    }
    mem = empty()
  }
  return mem
}

const persist = async (): Promise<void> => {
  if (!mem) return
  try {
    const file = cacheFile()
    const tmp = `${file}.tmp`
    await fs.writeFile(tmp, serialize(JSON.stringify(mem)), { mode: 0o600 })
    await fs.rename(tmp, file)
  } catch (err) {
    log.warn("[accounts-cache] не удалось записать", err)
  }
}

const prune = (payload: CachePayload): void => {
  const keys = Object.keys(payload.entries)
  if (keys.length <= MAX_ENTRIES) return
  const sorted = keys.sort(
    (a, b) => (payload.entries[a]?.fetchedAt ?? 0) - (payload.entries[b]?.fetchedAt ?? 0),
  )
  for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) delete payload.entries[k]
}

export const getCachedList = async (key: string): Promise<AccountsCacheEntry | null> => {
  const c = await load()
  return c.entries[key] ?? null
}

export const setCachedList = async (
  key: string,
  items: MarketItem[],
  total: number,
): Promise<void> => {
  const c = await load()
  c.entries[key] = {
    fetchedAt: Date.now(),
    total,
    items: items.slice(0, MAX_ITEMS_PER_ENTRY),
  }
  prune(c)
  await persist()
}

export const clearAccountsCache = async (): Promise<void> => {
  mem = empty()
  try {
    await fs.rm(cacheFile(), { force: true })
  } catch (err) {
    log.warn("[accounts-cache] не удалось очистить", err)
  }
}
