import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { atomicWrite, backupCorrupt } from './atomic-store'

const FILE_NAME = 'profile-token.bin'

const tokenFilePath = (): string => join(app.getPath('userData'), FILE_NAME)

let sessionToken: string | null = null
let loaded = false
let loadingPromise: Promise<void> | null = null

const readFromDisk = async (): Promise<void> => {
  try {
    const buf = await fs.readFile(tokenFilePath())
    const value = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8')
    const trimmed = value.trim()
    sessionToken = trimmed.length > 0 ? trimmed : null
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('[profile-token] не удалось прочитать токен, считаем пустым', err)
      await backupCorrupt(tokenFilePath())
    }
    sessionToken = null
  }
  if (!sessionToken) {
    const oauth = (await loadToken())?.trim()
    if (oauth) sessionToken = oauth
  }
  loaded = true
}

export const initProfileToken = (): Promise<void> => {
  if (loaded) return Promise.resolve()
  if (!loadingPromise) loadingPromise = readFromDisk()
  return loadingPromise
}

const writeToDisk = async (token: string): Promise<void> => {
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf8')
  await atomicWrite(tokenFilePath(), payload)
}

export const setProfileToken = async (token: string): Promise<void> => {
  const trimmed = token.trim()
  sessionToken = trimmed.length > 0 ? trimmed : null
  loaded = true
  if (!sessionToken) {
    await clearProfileToken()
    return
  }
  try {
    await writeToDisk(sessionToken)
  } catch (err) {
    log.warn('[profile-token] не удалось сохранить токен на диск', err)
  }
}

export const getProfileToken = (): string | null => sessionToken

export const clearProfileToken = async (): Promise<void> => {
  sessionToken = null
  loaded = true
  try {
    await fs.unlink(tokenFilePath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('[profile-token] не удалось удалить файл токена', err)
    }
  }
}

export const hasProfileToken = (): boolean => sessionToken !== null
