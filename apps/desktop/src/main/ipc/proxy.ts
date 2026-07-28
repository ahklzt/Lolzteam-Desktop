import {
  IPC,
  type ProxyCheckInput,
  type ProxyFetchResult,
  type ProxyTestInput,
  type SiteCheckInput,
} from '@lzt/shared'
import { ipcMain } from 'electron'
import { fetchMarketProxies, testProxy } from '../services/proxy'
import { checkProxy, checkSiteAccess, lookupIp } from '../services/proxyCheck'

export const registerProxyIpc = (): void => {
  ipcMain.handle(IPC.PROXY_TEST, (_e, input: ProxyTestInput) => testProxy(input))

  ipcMain.handle(IPC.PROXY_FETCH_MARKET, async (): Promise<ProxyFetchResult> => {
    try {
      const proxies = await fetchMarketProxies()
      return { ok: true, proxies }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'fetch_failed' }
    }
  })

  ipcMain.handle(IPC.PROXY_CHECK, (_e, input: ProxyCheckInput) => checkProxy(input))
  ipcMain.handle(IPC.PROXY_CHECK_SITE, (_e, input: SiteCheckInput) => checkSiteAccess(input))
  ipcMain.handle(IPC.IP_LOOKUP, (_e, { ip }: { ip: string }) => lookupIp(ip))
}
