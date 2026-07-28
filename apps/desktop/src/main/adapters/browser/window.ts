import type { AdapterContext } from '../contract'
import { BrowserWindow, type WebContents, session } from 'electron'
import { applyProxyToSession, clearProxyFromSession } from '../../services/proxy'
import { MAIN_COLORS } from '../../theme'
import type { InjectableCookie } from './extract'

export const injectCookies = async (
  partition: string,
  cookies: InjectableCookie[],
  ctx: AdapterContext,
): Promise<void> => {
  const ses = session.fromPartition(partition)
  await ses.clearStorageData()

  if (ctx.proxy) {
    await applyProxyToSession(ses, ctx.proxy)
    ctx.log.info(`[browser] routing #${partition} via proxy ${ctx.proxy.host}:${ctx.proxy.port}`)
  } else {
    await clearProxyFromSession(ses)
  }

  for (const cookie of cookies) {
    try {
      await ses.cookies.set(cookie)
    } catch (err) {
      ctx.log.warn(`[browser] failed to set cookie ${cookie.name}`, err)
    }
  }
}

export const openBrowserWindow = (
  partition: string,
  landingUrl: string,
  title: string,
  ctx: AdapterContext,
  opts?: { onEachLoad?: (site: WebContents) => void },
): { windowId: number; webContents: WebContents } => {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    backgroundColor: MAIN_COLORS.bg,
    title,
    autoHideMenuBar: true,
    webPreferences: {
      partition,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  win.setMenu(null)

  const site = win.webContents
  if (opts?.onEachLoad) {
    site.on('did-finish-load', () => opts.onEachLoad?.(site))
  }
  site.loadURL(landingUrl).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    ctx.log.warn(`[browser] loadURL failed: ${msg}`)
  })

  return { windowId: win.id, webContents: site }
}
