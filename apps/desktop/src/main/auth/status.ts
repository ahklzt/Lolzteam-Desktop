import { type AuthStatus } from '@lzt/shared'
import { BrowserWindow } from 'electron'
import { IPC } from '@lzt/shared'
import { loadToken } from './token-store'
import { fetchProfileResult } from '../services/lzt-api'

export const buildStatus = async (): Promise<AuthStatus> => {
  const token = await loadToken()
  if (!token) return { authenticated: false }

  const result = await fetchProfileResult()
  if (result.kind === 'offline') return { authenticated: true, offline: true, profile: null }
  if (result.kind === 'unauthorized') return { authenticated: false }
  return { authenticated: true, offline: false, profile: result.profile }
}

export const broadcastStatus = async (): Promise<void> => {
  const status = await buildStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.AUTH_STATUS_CHANGED, status)
  }
}
