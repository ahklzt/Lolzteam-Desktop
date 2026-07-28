import type {
  AccountLoginMethod,
  AccountLoginResult,
  LoginProgress,
  LoginProgressEvent,
} from '@lzt/shared'
import { IPC } from '@lzt/shared'
import { BrowserWindow, app, ipcMain } from 'electron'
import { getAdapter } from '../adapters'
import type { AdapterContext, AdapterLogger } from '../adapters/contract'
import { extractSharedSecret } from '../adapters/steam/mafile'
import { getAccountLoginDetails } from '../services/login-details'
import { getItemMafile, getTempEmailPassword } from '../services/market-api'
import { getSettings } from '../settings/settings-store'

const adapterLogger: AdapterLogger = {
  debug: (m, meta) => (meta === undefined ? console.debug(m) : console.debug(m, meta)),
  info: (m, meta) => (meta === undefined ? console.info(m) : console.info(m, meta)),
  warn: (m, meta) => (meta === undefined ? console.warn(m) : console.warn(m, meta)),
  error: (m, meta) => (meta === undefined ? console.error(m) : console.error(m, meta)),
}

const broadcast = (itemId: number, event: LoginProgress): void => {
  const payload: LoginProgressEvent = { ...event, itemId }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.ACCOUNT_LOGIN_PROGRESS, payload)
  }
}

const buildCtx = async (
  itemId: number,
  abortSignal: AbortSignal,
): Promise<AdapterContext> => {
  const settings = await getSettings().catch(() => undefined)
  const proxy =
    settings?.proxyEnabled && settings.appProxyId
      ? settings.proxies.find((p) => p.id === settings.appProxyId)
      : undefined
  return {
    log: adapterLogger,
    paths: {
      userData: app.getPath('userData'),
      logs: app.getPath('logs'),
      temp: app.getPath('temp'),
    },
    abortSignal,
    onProgress: (event) => broadcast(itemId, event),
    settings,
    proxy,
    fetchEmailCode: async (id) => {
      const res = await getTempEmailPassword(id)
      return res.ok ? res.password || null : null
    },
    fetchSteamMafile: async (id) => {
      const res = await getItemMafile(id)
      return res.ok ? extractSharedSecret(res.maFile) : null
    },
  }
}

const activeLogins = new Map<number, AbortController>()

export const registerLoginIpc = (): void => {
  ipcMain.handle(
    IPC.ACCOUNT_LOGIN,
    async (
      _e,
      payload: { itemId: number; method?: AccountLoginMethod },
    ): Promise<AccountLoginResult> => {
      const itemId = Number(payload?.itemId)
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return { ok: false, message: 'Некорректный аккаунт' }
      }
      const method: AccountLoginMethod = payload?.method === 'web' ? 'web' : 'native'

      activeLogins.get(itemId)?.abort()
      const ctl = new AbortController()
      activeLogins.set(itemId, ctl)
      broadcast(itemId, { step: 'fetching-credentials' })

      try {
        const details = await getAccountLoginDetails(itemId)
        if (!details) return { ok: false, message: 'Не удалось получить данные аккаунта' }

        const adapter = getAdapter(details.service)
        if (!adapter) {
          const name = details.categoryTitle || 'этого сервиса'
          return {
            ok: false,
            message: `Нативный вход для «${name}» появится в следующем обновлении`,
          }
        }

        const ctx = await buildCtx(itemId, ctl.signal)
        const result = await adapter.login(method, details, ctx)
        if (result.ok) {
          broadcast(itemId, { step: 'done' })
          return { ok: true, method: result.method, message: result.message }
        }
        return { ok: false, message: result.message ?? 'Не удалось выполнить вход' }
      } catch (err) {
        if (ctl.signal.aborted) return { ok: false, message: 'Вход отменён' }
        console.error('[login] adapter threw', err)
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Неизвестная ошибка',
        }
      } finally {
        if (activeLogins.get(itemId) === ctl) activeLogins.delete(itemId)
      }
    },
  )

  ipcMain.handle(IPC.ACCOUNT_LOGIN_CANCEL, (_e, payload: { itemId: number }) => {
    activeLogins.get(Number(payload?.itemId))?.abort()
  })
}
