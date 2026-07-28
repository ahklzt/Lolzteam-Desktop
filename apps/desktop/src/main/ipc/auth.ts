import { IPC } from '@lzt/shared'
import { ipcMain } from 'electron'
import { clearToken, onTokenChange } from '../auth/token-store'
import { broadcastStatus, buildStatus } from '../auth/status'
import { clearAccountsCache } from '../services/accounts-cache-store'

export const registerAuthIpc = () => {
  ipcMain.handle(IPC.AUTH_GET_STATUS, () => buildStatus())
  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    await clearToken()
  })

  onTokenChange(() => {
    void clearAccountsCache()
    void broadcastStatus()
  })
}
