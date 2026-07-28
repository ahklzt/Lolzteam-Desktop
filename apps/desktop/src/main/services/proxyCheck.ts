import type {
  IpLookupResult,
  ProxyCheckInput,
  ProxyCheckResult,
  ProxyGeo,
  ProxyIpType,
  ProxyMeta,
  SiteCheckInput,
  SiteCheckRedirect,
  SiteCheckResult,
} from '@lzt/shared'
import log from 'electron-log/main'
import { type ProxyNetTarget, proxyRequest } from './proxy-net'

const SCHEME_HTTP = `http${'://'}`
const SCHEME_HTTPS = `https${'://'}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const IPAPI_FIELDS =
  'status,message,query,country,countryCode,city,isp,as,mobile,hosting,timezone,lat,lon'
const IPAPI_BASE = `${SCHEME_HTTP}ip-api.com/json/`
const ipApiUrl = (ip?: string): string =>
  `${IPAPI_BASE}${ip ? encodeURIComponent(ip) : ''}?fields=${IPAPI_FIELDS}`

const IP_ECHO_URL = `${SCHEME_HTTPS}api.ipify.org?format=json`

const REQ_TIMEOUT_MS = 15_000

interface IpApi {
  status: string
  message?: string
  query?: string
  country?: string
  countryCode?: string
  city?: string
  isp?: string
  as?: string
  mobile?: boolean
  hosting?: boolean
  timezone?: string
  lat?: number
  lon?: number
}

type WireProtocol = 'http' | 'https' | 'socks5'

const ipVersionOf = (ip: string): 'IPv4' | 'IPv6' => (ip.includes(':') ? 'IPv6' : 'IPv4')

const ipTypeOf = (d: IpApi): ProxyIpType =>
  d.mobile ? 'Mobile' : d.hosting ? 'Datacenter' : 'Residential'

const emptyGeo: ProxyGeo = {
  country: '',
  countryCode: '',
  city: '',
  isp: '',
  asn: '',
  timezone: '',
}

const geoOf = (d: IpApi): ProxyGeo => ({
  country: d.country ?? '',
  countryCode: d.countryCode ?? '',
  city: d.city ?? '',
  isp: d.isp ?? '',
  asn: d.as ?? '',
  timezone: d.timezone ?? '',
})

interface RawResponse {
  status: number
  headers: Record<string, string | string[]>
  body: string
  redirects: SiteCheckRedirect[]
  finalUrl: string
  sizeBytes: number
}

const toTarget = (
  input: Pick<ProxyCheckInput, 'host' | 'port' | 'username' | 'password'>,
  proto: WireProtocol,
): ProxyNetTarget => ({
  host: input.host,
  port: input.port,
  protocol: proto,
  ...(input.username ? { username: input.username, password: input.password ?? '' } : {}),
})

const exitIpThrough = async (proxy: ProxyNetTarget): Promise<{ ip: string; ms: number }> => {
  const started = Date.now()
  const res = await proxyRequest(proxy, IP_ECHO_URL, { timeoutMs: REQ_TIMEOUT_MS })
  const ms = Date.now() - started
  if (!res.ok || res.status !== 200) {
    throw new Error(
      res.error ?? (res.status ? `Прокси вернул HTTP ${res.status}` : 'Таймаут запроса'),
    )
  }
  let ip = ''
  try {
    ip = (JSON.parse(res.body) as { ip?: string }).ip ?? ''
  } catch {
    ip = ''
  }
  if (!ip) throw new Error('Некорректный ответ прокси')
  return { ip, ms }
}

const geoLookup = async (ip: string): Promise<IpApi | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS)
  try {
    const res = await fetch(ipApiUrl(ip), { signal: controller.signal })
    if (!res.ok) return null
    const d = (await res.json()) as IpApi
    return d.status === 'success' ? d : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const metaFrom = (
  proto: WireProtocol,
  ip: string,
  ms: number,
  geo: IpApi | null,
): ProxyMeta => ({
  protocol: proto,
  realIp: ip,
  ipVersion: ipVersionOf(ip),
  ms,
  geo: geo ? geoOf(geo) : emptyGeo,
  ipType: geo ? ipTypeOf(geo) : 'Unknown',
  rotating: false,
})

const requestThrough = async (proxy: ProxyNetTarget, url: string): Promise<RawResponse> => {
  const res = await proxyRequest(proxy, url, {
    timeoutMs: REQ_TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
    followRedirects: false,
  })
  if (res.status === 0) throw new Error(res.error ?? 'Таймаут запроса')
  return {
    status: res.status,
    headers: res.headers,
    body: res.body,
    redirects: res.redirects,
    finalUrl: res.finalUrl,
    sizeBytes: res.sizeBytes || Buffer.byteLength(res.body, 'utf8'),
  }
}

export const checkProxy = async (input: ProxyCheckInput): Promise<ProxyCheckResult> => {
  const proto: WireProtocol = input.protocol === 'auto' ? 'http' : input.protocol
  const proxy = toTarget(input, proto)

  try {
    const first = await exitIpThrough(proxy)
    let rotating = false
    try {
      const second = await exitIpThrough(proxy)
      if (second.ip && second.ip !== first.ip) rotating = true
    } catch {
    }
    const geo = await geoLookup(first.ip)
    return { ok: true, ...metaFrom(proto, first.ip, first.ms, geo), rotating }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

const normalizeUrl = (raw: string): string | null => {
  const s = raw.trim()
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `${SCHEME_HTTPS}${s}`
  try {
    return new URL(withScheme).toString()
  } catch {
    return null
  }
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')

const extractTitle = (html: string): string => {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const raw = m?.[1]
  return raw ? decodeEntities(raw.trim()).slice(0, 300) : ''
}

const extractMeta = (html: string): string => {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    const raw = m?.[1]
    if (raw) return decodeEntities(raw.trim()).slice(0, 400)
  }
  return ''
}

const headerValue = (headers: Record<string, string | string[]>, name: string): string => {
  const v = headers[name.toLowerCase()]
  if (Array.isArray(v)) return v.join(', ')
  return v ?? ''
}

export const checkSiteAccess = async (input: SiteCheckInput): Promise<SiteCheckResult> => {
  const url = normalizeUrl(input.targetUrl)
  if (!url) return { ok: false, message: 'Некорректный URL сайта' }

  const proto: WireProtocol = input.proxy.protocol === 'auto' ? 'http' : input.proxy.protocol
  const proxy = toTarget(input.proxy, proto)

  try {
    let proxyInfo: ProxyMeta | null = null
    try {
      const exit = await exitIpThrough(proxy)
      const geo = await geoLookup(exit.ip)
      proxyInfo = metaFrom(proto, exit.ip, exit.ms, geo)
    } catch {
      proxyInfo = null
    }

    const started = Date.now()
    const r = await requestThrough(proxy, url)
    const responseTimeMs = Date.now() - started

    const server = headerValue(r.headers, 'server')
    const cfRay = headerValue(r.headers, 'cf-ray')
    const cfMitigated = headerValue(r.headers, 'cf-mitigated')
    const cloudflare = /cloudflare/i.test(server) || cfRay !== '' || cfMitigated !== ''
    const captcha =
      /(g-recaptcha|recaptcha\/api|hcaptcha\.com|cf-turnstile|challenges\.cloudflare|__cf_chl|challenge-platform)/i.test(
        r.body,
      )

    return {
      ok: true,
      opened: r.status >= 200 && r.status < 400,
      proxyInfo,
      httpStatus: r.status,
      responseTimeMs,
      httpVersion: 'HTTP/1.1',
      targetUrl: url,
      finalUrl: r.finalUrl,
      redirects: r.redirects,
      page: {
        title: extractTitle(r.body),
        description: extractMeta(r.body),
        contentType: headerValue(r.headers, 'content-type'),
        encoding: headerValue(r.headers, 'content-encoding') || 'identity',
        sizeBytes: r.sizeBytes,
      },
      server: {
        server,
        poweredBy: headerValue(r.headers, 'x-powered-by'),
        date: headerValue(r.headers, 'date'),
      },
      cloudflare,
      captcha,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export const lookupIp = async (ip: string): Promise<IpLookupResult> => {
  const clean = ip.trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(ipApiUrl(clean || undefined), { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const d = (await res.json()) as IpApi
    if (d.status !== 'success' || !d.query) {
      return { ok: false, message: d.message ?? 'Не удалось определить IP' }
    }
    return {
      ok: true,
      ip: d.query,
      country: d.country ?? '',
      countryCode: d.countryCode ?? '',
      city: d.city ?? '',
      isp: d.isp ?? '',
      asn: d.as ?? '',
      ipType: ipTypeOf(d),
      lat: d.lat ?? 0,
      lon: d.lon ?? 0,
      timezone: d.timezone ?? '',
    }
  } catch (err) {
    log.warn('[proxy] ip lookup failed', err)
    return { ok: false, message: err instanceof Error ? err.message : 'lookup_failed' }
  } finally {
    clearTimeout(timer)
  }
}
