import { IPC, LZT_CONFIG } from '@lzt/shared'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log/main'
import { MAIN_COLORS } from '../theme'
import { acceptAuthCallback, clearAuthSession, issueState } from './auth-broker'

type GetWindow = () => BrowserWindow | null

const AUTH_PARTITION = 'persist:lzt-auth'

let authWindow: BrowserWindow | null = null

const buildAuthUrl = (state: string) => {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: LZT_CONFIG.clientId,
    redirect_uri: LZT_CONFIG.authRedirectUri,
    scope: LZT_CONFIG.oauthScopes,
    state,
  })
  return `${LZT_CONFIG.webUrl}/account/authorize?${params.toString()}`
}

const closeAuthWindow = () => {
  if (authWindow && !authWindow.isDestroyed()) authWindow.close()
  authWindow = null
}

const openAuthWindow = async (getMainWindow: GetWindow) => {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus()
    return
  }

  await clearAuthSession(AUTH_PARTITION)

  const state = issueState()
  const authUrl = buildAuthUrl(state)
  const parent = getMainWindow() ?? undefined

  authWindow = new BrowserWindow({
    width: 520,
    height: 720,
    parent,
    modal: false,
    backgroundColor: MAIN_COLORS.bg,
    title: 'Вход через LZT',
    autoHideMenuBar: true,
    webPreferences: {
      partition: AUTH_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  authWindow.setMenu(null)

  const isRedirect = (url: string) => url.startsWith(LZT_CONFIG.authRedirectUri)

  const intercept = async (url: string, evt?: Electron.Event) => {
    if (!isRedirect(url)) return
    evt?.preventDefault()
    const outcome = await acceptAuthCallback(url, getMainWindow)
    if (outcome.ok || outcome.reason === 'duplicate') {
      closeAuthWindow()
    } else if (outcome.reason === 'oauth-error') {
      log.warn('[auth] вход отклонён:', outcome.message)
      closeAuthWindow()
    }
  }

  authWindow.webContents.on('will-redirect', (e, url) => void intercept(url, e))
  authWindow.webContents.on('will-navigate', (e, url) => void intercept(url, e))
  authWindow.webContents.on('did-fail-load', (_e, _c, _d, url) => void intercept(url))

  authWindow.on('closed', () => {
    authWindow = null
    void clearAuthSession(AUTH_PARTITION)
  })

  await authWindow.loadURL(authUrl)
}

export const registerInAppAuth = (getMainWindow: GetWindow) => {
  ipcMain.handle(IPC.AUTH_OPEN_IN_APP, async () => {
    await openAuthWindow(getMainWindow)
  })
}
