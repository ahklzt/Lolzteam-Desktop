import { randomUUID } from 'node:crypto'
import {
  LZT_CONFIG,
  type ProxyEntry,
  type ProxyTestInput,
  type ProxyTestResult,
} from '@lzt/shared'
import { type Session, app } from 'electron'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { appFetch } from './app-fetch'
import { proxyRequest } from './proxy-net'

type ProxyCreds = { username: string; password: string }

const credsByHostPort = new Map<string, ProxyCreds>()
const hostPortKey = (host: string, port: number): string => `${host}:${port}`

const proxyRulesFor = (entry: Pick<ProxyEntry, 'host' | 'port' | 'protocol'>): string =>
  `${entry.protocol === 'https' ? 'https' : 'http'}://${entry.host}:${entry.port}`

const registerProxyCreds = (
  entry: Pick<ProxyEntry, 'host' | 'port' | 'username' | 'password'>,
): void => {
  if (entry.username) {
    credsByHostPort.set(hostPortKey(entry.host, entry.port), {
      username: entry.username,
      password: entry.password ?? '',
    })
  }
}

export const syncProxyCreds = (proxies: ProxyEntry[]): void => {
  credsByHostPort.clear()
  for (const p of proxies) registerProxyCreds(p)
}

export const applyProxyToSession = async (ses: Session, entry: ProxyEntry): Promise<void> => {
  registerProxyCreds(entry)
  await ses.setProxy({ proxyRules: proxyRulesFor(entry) })
  await ses.closeAllConnections()
}

export const clearProxyFromSession = async (ses: Session): Promise<void> => {
  await ses.setProxy({ mode: 'direct' })
  await ses.closeAllConnections()
}

let authHandlerWired = false
export const registerProxyAuthHandler = (): void => {
  if (authHandlerWired) return
  authHandlerWired = true
  app.on('login', (event, _webContents, _request, authInfo, callback) => {
    if (!authInfo.isProxy) return
    const creds = credsByHostPort.get(hostPortKey(authInfo.host, authInfo.port))
    if (!creds) return
    event.preventDefault()
    callback(creds.username, creds.password)
  })
}

const TEST_TIMEOUT_MS = 15_000
const TEST_URLS = ['https://api.ipify.org?format=json', 'https://api.myip.com']

const extractIp = (body: string): string | null => {
  try {
    const parsed = JSON.parse(body) as { ip?: string; query?: string }
    return parsed.ip ?? parsed.query ?? null
  } catch {
    return null
  }
}

export const testProxy = async (input: ProxyTestInput): Promise<ProxyTestResult> => {
  const started = Date.now()
  let lastReason = ''
  for (const url of TEST_URLS) {
    const res = await proxyRequest(input, url, { timeoutMs: TEST_TIMEOUT_MS })
    if (res.ok && res.status === 200) {
      const ip = extractIp(res.body)
      if (ip) {
        return {
          ok: true,
          checkedAt: Date.now(),
          ms: Date.now() - started,
          ip,
          protocol: input.protocol,
        }
      }
    }
    lastReason = res.error ?? (res.status ? `HTTP ${res.status}` : lastReason)
  }
  log.warn(`[proxy] test failed for ${input.host}:${input.port} (${lastReason || 'unknown'})`)
  return {
    ok: false,
    checkedAt: Date.now(),
    message: lastReason
      ? `Прокси недоступен: ${lastReason}`
      : 'Прокси недоступен или требует другой тип подключения',
  }
}

type RawProxy = {
  proxy_ip?: string
  proxy_port?: number | string
  proxy_user?: string | null
  proxy_pass?: string | null
  ip?: string
  host?: string
  port?: number | string
  username?: string | null
  password?: string | null
}

const toEntry = (raw: RawProxy): ProxyEntry | null => {
  const host = raw.proxy_ip ?? raw.host ?? raw.ip
  const portRaw = raw.proxy_port ?? raw.port
  const port = typeof portRaw === 'string' ? Number.parseInt(portRaw, 10) : portRaw
  if (!host || !port || !Number.isInteger(port) || port <= 0 || port > 65535) return null
  const username = raw.proxy_user ?? raw.username ?? undefined
  const password = raw.proxy_pass ?? raw.password ?? undefined
  return {
    id: randomUUID(),
    protocol: 'http',
    host: String(host),
    port,
    ...(username ? { username: String(username) } : {}),
    ...(password ? { password: String(password) } : {}),
    label: 'с форума',
  }
}

const collectRaw = (data: unknown): RawProxy[] => {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const node = obj.proxies ?? obj.proxy ?? obj.data ?? data
  if (Array.isArray(node)) return node as RawProxy[]
  if (node && typeof node === 'object') return Object.values(node as Record<string, RawProxy>)
  return []
}

export const fetchMarketProxies = async (): Promise<ProxyEntry[]> => {
  const token = await loadToken()
  if (!token) throw new Error('not_authenticated')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}/proxy`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as unknown
    const list = collectRaw(data)
      .map(toEntry)
      .filter((p): p is ProxyEntry => p !== null)
    log.info(`[proxy] fetched ${list.length} proxy(ies) from market`)
    return list
  } finally {
    clearTimeout(timer)
  }
}
