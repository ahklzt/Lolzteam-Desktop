import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type ModeratorSettings } from '@lzt/shared'
import { app, safeStorage } from 'electron'
import log from 'electron-log/main'
import { atomicWrite, backupCorrupt } from '../services/atomic-store'

const FILE_NAME = 'settings.json'
const APP_THEMES = new Set<ModeratorSettings['appTheme']>([
  'dark',
  'light',
  'green',
  'purple',
  'custom'
])
const settingsFile = () => join(app.getPath('userData'), FILE_NAME)

const serialize = (json: string): Buffer =>
  safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8')

const deserialize = (buf: Buffer): string => {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
    }
  }
  return buf.toString('utf8')
}

class SettingsStore extends EventEmitter {
  private cached: ModeratorSettings | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  private enqueueWrite<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(write, write)
    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async load(): Promise<ModeratorSettings> {
    if (this.cached) return this.cached
    try {
      const raw = deserialize(await fs.readFile(settingsFile()))
      const parsed = JSON.parse(raw) as Partial<ModeratorSettings>
      const merged: ModeratorSettings = { ...DEFAULT_SETTINGS, ...parsed }
      if (merged.locale !== 'ru' && merged.locale !== 'en') merged.locale = DEFAULT_SETTINGS.locale
      if (!APP_THEMES.has(merged.appTheme)) merged.appTheme = DEFAULT_SETTINGS.appTheme
      if (!Array.isArray(merged.mailHistory)) merged.mailHistory = []
      if (!Array.isArray(merged.proxies)) merged.proxies = []
      if (!Array.isArray(merged.accountLabels)) merged.accountLabels = []
      this.cached = merged
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('[settings] failed to load, using defaults', err)
        await backupCorrupt(settingsFile())
      }
      this.cached = { ...DEFAULT_SETTINGS }
    }
    return this.cached
  }

  async update(patch: Partial<ModeratorSettings>): Promise<ModeratorSettings> {
    return this.enqueueWrite(async () => {
      const current = await this.load()
      const next: ModeratorSettings = { ...current, ...patch }
      await atomicWrite(settingsFile(), serialize(JSON.stringify(next)))
      this.cached = next
      this.emit('change', next)
      return next
    })
  }

  async reset(): Promise<ModeratorSettings> {
    return this.enqueueWrite(async () => {
      const next: ModeratorSettings = { ...DEFAULT_SETTINGS }
      await atomicWrite(settingsFile(), serialize(JSON.stringify(next)))
      this.cached = next
      this.emit('change', next)
      return next
    })
  }

  getCached(): ModeratorSettings | null {
    return this.cached
  }
}

const store = new SettingsStore()

export const getSettings = (): Promise<ModeratorSettings> => store.load()
export const setSettings = (patch: Partial<ModeratorSettings>): Promise<ModeratorSettings> =>
  store.update(patch)
export const resetSettings = (): Promise<ModeratorSettings> => store.reset()
export const onSettingsChange = (handler: (s: ModeratorSettings) => void): (() => void) => {
  store.on('change', handler)
  return () => store.off('change', handler)
}
export const getCachedSettings = (): ModeratorSettings | null => store.getCached()
