import { randomBytes } from 'node:crypto'
import type {
  CheckerReason,
  CheckerSteamInput,
  CheckerSteamResult,
  ProxyEntry,
  SteamCheckData,
  SteamCs2Stats,
  SteamDota2Stats,
  SteamGameEntry,
  SteamInventoryCategory,
  SteamInventoryItem,
  SteamRustStats,
  SteamTransaction,
} from '@lzt/shared'
import { LZT_CONFIG } from '@lzt/shared'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { extractSharedSecret } from '../adapters/steam/mafile'
import { acquireWebSession } from '../adapters/steam/session'
import { getSettings } from '../settings/settings-store'
import { appFetch } from './app-fetch'
import { marketLimiter } from './market-rate-limiter'
import { type ProxyNetTarget, proxyRequest } from './proxy-net'

const REQ_TIMEOUT_MS = 20_000
const STORE_ORIGIN = 'https://store.steampowered.com'
const COMMUNITY_ORIGIN = 'https://steamcommunity.com'
const API_ORIGIN = 'https://api.steampowered.com'
const OPENDOTA_ORIGIN = 'https://api.opendota.com'
const FACEIT_ORIGIN = 'https://api.faceit.com'

const HISTORY_URL = `${STORE_ORIGIN}/account/history/?l=english`
const HISTORY_MORE_URL = `${STORE_ORIGIN}/account/AjaxLoadMoreHistory/?l=english`
const LICENSES_URL = `${STORE_ORIGIN}/account/licenses/?l=english`
const MAX_HISTORY_PAGES = 10

const STEAM_ID_BASE = 76561197960265728n
const STEAM_VALUE_TIMEOUT_MS = 30_000
const STEAM_VALUE_SPACING_MS = 3200

const MARKET_CURRENCIES = new Set([
  'rub',
  'uah',
  'kzt',
  'byn',
  'usd',
  'eur',
  'gbp',
  'cny',
  'try',
  'jpy',
  'brl',
])

const marketCurrency = (currency: string | undefined): string => {
  const code = (currency ?? 'usd').toLowerCase()
  return MARKET_CURRENCIES.has(code) ? code : 'usd'
}

const INV_TARGETS: Array<{ key: string; label: string; appId: number; ctx: number }> = [
  { key: 'cs2', label: 'CS2', appId: 730, ctx: 2 },
  { key: 'dota2', label: 'Dota 2', appId: 570, ctx: 2 },
  { key: 'tf2', label: 'TF2', appId: 440, ctx: 2 },
  { key: 'rust', label: 'Rust', appId: 252490, ctx: 2 },
  { key: 'community', label: 'Steam Community', appId: 753, ctx: 6 },
]

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const resolveProxy = (
  proxies: ProxyEntry[],
  appProxyId: string | null,
  requestedId?: string | null,
): ProxyEntry | null => {
  if (requestedId) {
    const requested = proxies.find((p) => p.id === requestedId)
    if (requested) return requested
  }
  const healthy = proxies.filter((p) => !p.test || p.test.ok)
  const pool = healthy.length > 0 ? healthy : proxies
  if (appProxyId) {
    const preferred = pool.find((p) => p.id === appProxyId)
    if (preferred) return preferred
  }
  if (pool.length === 0) return null
  const index = Math.floor(Math.random() * pool.length)
  return pool[index] ?? pool[0] ?? null
}

const isSocks = (p: ProxyEntry): boolean => p.protocol === 'socks4' || p.protocol === 'socks5'

const proxyUrlFor = (p: ProxyEntry): string => {
  const auth = p.username
    ? `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password ?? '')}@`
    : ''
  return `${p.protocol}://${auth}${p.host}:${p.port}`
}

interface HttpResult {
  ok: boolean
  status: number
  body: string
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const requestThrough = async (
  proxy: ProxyNetTarget,
  url: string,
  cookie: string,
): Promise<HttpResult> => {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
  }
  if (cookie) headers.Cookie = cookie
  const res = await proxyRequest(proxy, url, { headers, timeoutMs: REQ_TIMEOUT_MS })
  return { ok: res.ok, status: res.status, body: res.body }
}

const matchOne = (source: string, re: RegExp): string | null => {
  const m = re.exec(source)
  return m?.[1] ?? null
}

const cdata = (source: string, tag: string): string | null => {
  const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i').exec(
    source,
  )
  return m?.[1]?.trim() ?? null
}

const toNumber = (raw: string | null): number | undefined => {
  if (!raw) return undefined
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/\s/g, '').replace(',', '.')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : undefined
}

const toTimestamp = (raw: string | null): number | undefined => {
  if (!raw) return undefined
  const cleaned = raw.replace(/^\s*since\s+/i, '').replace(/\.$/, '').trim()
  const parsed = Date.parse(cleaned)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined
}

const currencyFromSymbol = (text: string): string | undefined => {
  if (text.includes('₽') || /руб/i.test(text)) return 'RUB'
  if (text.includes('₸') || /тг|kzt/i.test(text)) return 'KZT'
  if (text.includes('₴') || /грн|uah/i.test(text)) return 'UAH'
  if (text.includes('€')) return 'EUR'
  if (text.includes('£')) return 'GBP'
  if (text.includes('$')) return 'USD'
  return undefined
}

const parseProfileXml = (xml: string, data: SteamCheckData): void => {
  const persona = cdata(xml, 'steamID')
  if (persona) data.personaName = persona
  const avatar = cdata(xml, 'avatarFull')
  if (avatar) data.avatarUrl = avatar
  const location = cdata(xml, 'location')
  if (location) data.country = location
  const memberSince = cdata(xml, 'memberSince')
  if (memberSince) {
    data.registeredText = memberSince
    data.registeredAt = toTimestamp(memberSince) ?? null
  }
  const stateMessage = cdata(xml, 'stateMessage')
  if (stateMessage) data.lastOnlineText = stateMessage.replace(/<[^>]+>/g, ' ').trim()

  const vac = matchOne(xml, /<vacBanned>(\d)<\/vacBanned>/i)
  if (vac !== null) data.vacBanned = vac === '1'
  const privacy = cdata(xml, 'privacyState')
  if (privacy) data.privacyPublic = /public/i.test(privacy)
}

const parseWallet = (html: string, data: SteamCheckData): void => {
  const balanceRaw =
    matchOne(html, /id="header_wallet_balance"[^>]*>([^<]+)</i) ??
    matchOne(html, /class="accountData[^"]*price[^"]*"[^>]*>([^<]+)</i) ??
    matchOne(html, /class="accountBalance[^"]*"[^>]*>\s*<[^>]*>([^<]+)</i)
  if (balanceRaw) {
    const text = balanceRaw.trim()
    data.balanceText = text
    data.balance = toNumber(text)
    const cur = currencyFromSymbol(text)
    if (cur) data.currency = cur
  }
  const holdRaw =
    matchOne(html, /(?:on hold|funds on hold|удержани[ияе])[^0-9<]{0,60}?([\d.,]+\s*(?:[^\d\s<]{1,3}))/i) ??
    matchOne(html, /class="[^"]*wallet[^"]*hold[^"]*"[^>]*>\s*([^<]+)</i)
  if (holdRaw) {
    const hold = toNumber(holdRaw)
    if (hold !== undefined) data.balanceOnHold = hold
  }
}

const parsePoints = (body: string): number | undefined => {
  const fromJson = matchOne(body, /"points_available"\s*:\s*"?(\d+)"?/i)
  if (fromJson) return Number.parseInt(fromJson, 10)
  const fromShop = matchOne(body, /"pointsAvailable"\s*:\s*(\d+)/i)
  if (fromShop) return Number.parseInt(fromShop, 10)
  return undefined
}

const parseCs2 = (matchmaking: string): SteamCs2Stats | undefined => {
  const stats: SteamCs2Stats = {}
  const premier = matchOne(matchmaking, /CS Rating[\s\S]*?([\d,]{3,})/i)
  if (premier) stats.premierElo = Number.parseInt(premier.replace(/,/g, ''), 10)
  const wins = matchOne(matchmaking, /Wins[\s\S]*?<td[^>]*>\s*(\d+)/i)
  if (wins) stats.wins = Number.parseInt(wins, 10)
  return Object.keys(stats).length > 0 ? stats : undefined
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

const numOf = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

const strOf = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

const numLoose = (v: unknown): number | undefined => {
  const n = numOf(v)
  if (n !== undefined) return n
  if (typeof v === 'string') {
    const parsed = Number.parseInt(v.replace(/[^\d-]/g, ''), 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const COUNTRY_BY_CODE: Record<string, string> = {
  UA: 'Ukraine',
  RU: 'Russia',
  BY: 'Belarus',
  KZ: 'Kazakhstan',
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  PL: 'Poland',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  SE: 'Sweden',
  FI: 'Finland',
  NO: 'Norway',
  TR: 'Turkey',
  CN: 'China',
  JP: 'Japan',
  KR: 'South Korea',
  BR: 'Brazil',
  CA: 'Canada',
  AU: 'Australia',
  IN: 'India',
  MD: 'Moldova',
  GE: 'Georgia',
  AM: 'Armenia',
  AZ: 'Azerbaijan',
  LT: 'Lithuania',
  LV: 'Latvia',
  EE: 'Estonia',
  CZ: 'Czechia',
  RO: 'Romania',
}

const countryName = (code: string): string =>
  COUNTRY_BY_CODE[code.toUpperCase()] ?? code.toUpperCase()

const boolOf = (v: unknown): boolean => v === true

const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatDate = (unixSeconds: number): string => {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const formatDateTime = (unixSeconds: number): string => {
  const d = new Date(unixSeconds * 1000)
  return `${formatDate(unixSeconds)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const gameIconUrl = (appId: number, hash: string): string | undefined =>
  hash
    ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg`
    : undefined

const toSteamId32 = (steamId64: string): string | null => {
  try {
    const value = BigInt(steamId64) - STEAM_ID_BASE
    return value > 0n ? value.toString() : null
  } catch {
    return null
  }
}

const extractSessionId = (cookies: string[]): string | null => {
  for (const c of cookies) {
    const m = /(?:^|;\s*)sessionid=([^;]+)/i.exec(c)
    if (m?.[1]) return m[1]
  }
  return null
}

const buildAuthCookie = (
  cookies: string[],
  steamId: string,
  accessToken: string,
  sessionId: string,
): string => {
  const parts = cookies.filter((c) => !/^\s*sessionid=/i.test(c))
  const joined = parts.join('; ')
  if (!/steamLoginSecure=/i.test(joined)) {
    parts.push(`steamLoginSecure=${steamId}%7C%7C${encodeURIComponent(accessToken)}`)
  }
  parts.push(`sessionid=${sessionId}`)
  return parts.join('; ')
}

const apiGet = async (
  proxy: ProxyNetTarget,
  endpoint: string,
  params: Record<string, string | number>,
  accessToken: string,
): Promise<Record<string, unknown> | null> => {
  const query = new URLSearchParams({ access_token: accessToken })
  for (const [key, value] of Object.entries(params)) query.set(key, String(value))
  const res = await requestThrough(proxy, `${API_ORIGIN}/${endpoint}?${query.toString()}`, '')
  if (!res.ok || res.body === '') return null
  try {
    return asRecord(JSON.parse(res.body) as unknown)
  } catch {
    return null
  }
}

const fetchGameStats = async (
  proxy: ProxyNetTarget,
  appId: number,
  steamId: string,
  accessToken: string,
): Promise<Map<string, number>> => {
  const map = new Map<string, number>()
  const json = await apiGet(
    proxy,
    'ISteamUserStats/GetUserStatsForGame/v2/',
    { appid: appId, steamid: steamId },
    accessToken,
  )
  const stats = asArray(asRecord(json?.playerstats)?.stats)
  for (const raw of stats) {
    const r = asRecord(raw)
    const name = strOf(r?.name)
    const value = numOf(r?.value)
    if (name && value !== undefined) map.set(name, value)
  }
  return map
}

const fetchFaceitLevel = async (
  proxy: ProxyNetTarget,
  steamId: string,
): Promise<number | undefined> => {
  const url = `${FACEIT_ORIGIN}/users/v1/users?platform=steam&platform_id=${steamId}`
  const res = await requestThrough(proxy, url, '')
  if (!res.ok || res.body === '') return undefined
  const json = asRecord(parseJson(res.body))
  const games = asRecord(asRecord(json?.payload)?.games)
  return numOf(asRecord(games?.cs2)?.skill_level) ?? numOf(asRecord(games?.csgo)?.skill_level)
}

const fetchDotaStats = async (
  proxy: ProxyNetTarget,
  steamId32: string,
): Promise<SteamDota2Stats | undefined> => {
  const base = `${OPENDOTA_ORIGIN}/api/players/${steamId32}`
  const [profileRes, wlRes, recentRes] = await Promise.all([
    requestThrough(proxy, base, ''),
    requestThrough(proxy, `${base}/wl`, ''),
    requestThrough(proxy, `${base}/recentMatches`, ''),
  ])
  const stats: SteamDota2Stats = {}
  if (wlRes.ok && wlRes.body) {
    const wl = asRecord(parseJson(wlRes.body))
    const win = numOf(wl?.win)
    const lose = numOf(wl?.lose)
    if (win !== undefined) stats.wins = win
    if (win !== undefined && lose !== undefined) stats.matches = win + lose
  }
  if (profileRes.ok && profileRes.body) {
    const p = asRecord(parseJson(profileRes.body))
    const mmr = numOf(asRecord(p?.mmr_estimate)?.estimate)
    if (mmr !== undefined) stats.mmr = mmr
    if (p) {
      const rankTier = p.rank_tier
      stats.rankingActivated = rankTier !== null && rankTier !== undefined
    }
  }
  if (recentRes.ok && recentRes.body) {
    const arr = asArray(parseJson(recentRes.body))
    const last = numOf(asRecord(arr[0])?.start_time)
    if (last !== undefined) stats.lastMatchAt = last
  }
  return Object.keys(stats).length > 0 ? stats : undefined
}

const fetchHasActivatedKeys = async (
  proxy: ProxyNetTarget,
  cookie: string,
): Promise<boolean | undefined> => {
  const res = await requestThrough(proxy, LICENSES_URL, cookie)
  if (!res.ok || res.body === '') return undefined
  return /Activated as[\s\S]{0,80}?(retail|cd key|product key)|Product Key|Ключ продукта|розничн/i.test(
    res.body,
  )
}

const fetchSteamValue = async (
  steamId: string,
  appId: number,
  currency: string,
): Promise<number | null> => {
  const token = await loadToken()
  if (!token) return null
  await marketLimiter.acquire()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STEAM_VALUE_TIMEOUT_MS)
  try {
    const url = `${LZT_CONFIG.marketApiUrl}/steam-value?link=${encodeURIComponent(steamId)}&app_id=${appId}&currency=${currency}`
    const res = await appFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    marketLimiter.applyHeaders(res.headers)
    if (res.status === 429) marketLimiter.noteRetryAfter(res.headers)
    if (!res.ok) return null
    const json = asRecord(parseJson(await res.text()))
    const total = numOf(asRecord(json?.data)?.totalValue)
    return total ?? null
  } catch (err) {
    log.warn(`[checker] steam-value app ${appId} failed`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const priceInventory = async (
  steamId: string,
  categories: SteamInventoryCategory[],
  currency: string | undefined,
): Promise<{ total: number; valued: boolean; tokenMissing: boolean }> => {
  const token = await loadToken()
  if (!token) return { total: 0, valued: false, tokenMissing: true }
  const cur = marketCurrency(currency)
  let total = 0
  let valued = false
  let first = true
  for (const cat of categories) {
    if (cat.appId === undefined) continue
    if (!first) await delay(STEAM_VALUE_SPACING_MS)
    first = false
    const value = await fetchSteamValue(steamId, cat.appId, cur)
    if (value !== null) {
      cat.value = round2(value)
      total += value
      valued = true
    }
  }
  return { total: round2(total), valued, tokenMissing: false }
}

const gameFromApi = (raw: unknown): SteamGameEntry | null => {
  const g = asRecord(raw)
  if (!g) return null
  const name = strOf(g.name)
  if (!name) return null
  const appId = numOf(g.appid) ?? 0
  const playtime = numOf(g.playtime_forever) ?? numOf(g.playtime_2weeks)
  const icon = strOf(g.img_icon_url)
  const url = icon ? gameIconUrl(appId, icon) : undefined
  const entry: SteamGameEntry = { appId, name }
  if (playtime !== undefined) entry.playtimeMinutes = playtime
  if (url) entry.iconUrl = url
  return entry
}

const parseProfileHtml = (html: string, data: SteamCheckData): void => {
  if (data.friendsCount === undefined) {
    const f =
      matchOne(html, /id="manage_friends_link"[^>]*>[^\d]*?(\d[\d,]*)/i) ??
      matchOne(html, /friends_header_text[^>]*>[^<]*?(\d[\d,]*)\s/i)
    if (f) data.friendsCount = Number.parseInt(f.replace(/,/g, ''), 10)
  }
  if (data.gamesCount === undefined) {
    const g =
      matchOne(html, /(\d[\d,]*)\s*Games?\s*Owned/i) ?? matchOne(html, /Игр:\s*(\d[\d,]*)/i)
    if (g) data.gamesCount = Number.parseInt(g.replace(/,/g, ''), 10)
  }
  if (data.profileLevel === undefined) {
    const l = matchOne(html, /class="friendPlayerLevelNum"[^>]*>\s*(\d+)/i)
    if (l) data.profileLevel = Number.parseInt(l, 10)
  }
  if (!data.country) {
    const flagText =
      matchOne(
        html,
        /class="header_real_name[^"]*"[^>]*>[\s\S]*?<img[^>]*class="profile_flag[^"]*"[^>]*>\s*([^<\n]+?)\s*(?:<br|<\/div|<\/span)/i,
      ) ?? matchOne(html, /class="profile_flag[^"]*"[^>]*>\s*([^<\n]+?)\s*(?:<br|<\/div|<\/span)/i)
    const flagCode = matchOne(html, /countryflags\/([a-z]{2})\.(?:gif|png|jpg)/i)
    if (flagText) {
      const clean = flagText.replace(/\s+/g, ' ').trim()
      if (clean) data.country = clean
    } else if (flagCode) {
      data.country = countryName(flagCode)
    }
  }
  if (!data.lastOnlineText || data.lastOnlineText === 'Offline') {
    const lastOnline =
      matchOne(
        html,
        /class="profile_in_game_header"[^>]*>\s*Last Online[^<]*<\/div>\s*<div[^>]*class="profile_in_game_name"[^>]*>\s*([^<]+?)\s*<\/div>/i,
      ) ??
      matchOne(html, /class="profile_in_game_name"[^>]*>\s*(Last Online[^<]+?)\s*<\/div>/i) ??
      matchOne(html, /class="profile_in_game_name"[^>]*>\s*(Currently[^<]+?)\s*<\/div>/i)
    if (lastOnline) {
      const clean = lastOnline.replace(/\s+/g, ' ').trim()
      if (clean) data.lastOnlineText = clean
    }
  }
}

const deriveRestrictions = (data: SteamCheckData): void => {
  const economyBad =
    data.economyBan !== undefined && data.economyBan !== '' && data.economyBan !== 'none'
  const limited = data.limitedAccount === true
  data.tradeRestricted = economyBad || limited
  data.marketRestricted = economyBad || limited
}

const round2 = (n: number): number => Math.round(n * 100) / 100

interface HistoryTotals {
  count: number
  totalSpent: number
  gamesValue: number
  inGame: number
  giftsRefunds: number
  giftsCount: number
  sum: number
  currency?: string
  rows: SteamTransaction[]
}

interface HistoryCursor {
  wallet_txnid: string
  timestamp: number
  count: number
}

const parseHistoryRows = (html: string, totals: HistoryTotals): void => {
  const rowRe = /<tr class="wht_row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null = rowRe.exec(html)
  while (m !== null) {
    const row = m[1] ?? ''
    const typeCell = matchOne(row, /class="wht_type"[^>]*>([\s\S]*?)<\/td>/i) ?? ''
    const type = typeCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const totalCell = matchOne(row, /class="wht_total[^"]*"[^>]*>([\s\S]*?)<\/td>/i) ?? ''
    const totalText = totalCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const dateCell = matchOne(row, /class="wht_date"[^>]*>([\s\S]*?)<\/td>/i) ?? ''
    const date = dateCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const itemsCell = matchOne(row, /class="wht_items"[^>]*>([\s\S]*?)<\/td>/i) ?? ''
    const items = itemsCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    m = rowRe.exec(html)
    if (type === '' && totalText === '') continue
    const amount = Math.abs(toNumber(totalText) ?? 0)
    if (!totals.currency) {
      const c = currencyFromSymbol(totalText)
      if (c) totals.currency = c
    }
    totals.count += 1
    const isRefund =
      /refund|возврат|chargeback|charge back|отмен/i.test(type) || /wht_refunded/i.test(row)
    const isInGame = /in-?game|в игре|microtxn|internal/i.test(type)
    const isGift = /gift|подар/i.test(type)
    const isMarket = /market|торгов/i.test(type)
    if (isGift) totals.giftsCount += 1
    if (totals.rows.length < 100) {
      const entry: SteamTransaction = {}
      if (date) entry.date = date
      if (type) entry.type = type
      if (items) entry.items = items
      if (amount > 0) entry.total = round2(amount)
      if (totals.currency) entry.currency = totals.currency
      if (isRefund) entry.refunded = true
      totals.rows.push(entry)
    }
    totals.sum += amount
    if (amount === 0) continue
    if (isRefund) {
      totals.giftsRefunds += amount
    } else if (isGift) {
      totals.giftsRefunds += amount
      totals.totalSpent += amount
    } else if (isInGame) {
      totals.inGame += amount
      totals.totalSpent += amount
    } else if (!isMarket) {
      totals.gamesValue += amount
      totals.totalSpent += amount
    }
  }
}

const parseCursorObj = (raw: unknown): HistoryCursor | null => {
  const r = asRecord(raw)
  if (!r) return null
  const txn = r.wallet_txnid
  if (txn === undefined || txn === null) return null
  const ts = numOf(r.timestamp) ?? Number.parseInt(String(r.timestamp ?? ''), 10)
  const cnt = numOf(r.count) ?? Number.parseInt(String(r.count ?? ''), 10)
  return {
    wallet_txnid: String(txn),
    timestamp: Number.isFinite(ts) ? ts : 0,
    count: Number.isFinite(cnt) ? cnt : 0,
  }
}

const parseInitialCursor = (html: string): HistoryCursor | null => {
  const m = /g_historyCursor\s*=\s*(\{[\s\S]*?\})\s*;/.exec(html)
  if (!m?.[1]) return null
  try {
    return parseCursorObj(JSON.parse(m[1]) as unknown)
  } catch {
    return null
  }
}

const fetchTransactions = async (
  proxy: ProxyNetTarget,
  cookie: string,
  sessionId: string,
): Promise<HistoryTotals> => {
  const totals: HistoryTotals = {
    count: 0,
    totalSpent: 0,
    gamesValue: 0,
    inGame: 0,
    giftsRefunds: 0,
    giftsCount: 0,
    sum: 0,
    rows: [],
  }
  const first = await requestThrough(proxy, HISTORY_URL, cookie)
  if (!first.ok || first.body === '') return totals
  parseHistoryRows(first.body, totals)

  let cursor = parseInitialCursor(first.body)
  let pages = 0
  while (cursor && pages < MAX_HISTORY_PAGES) {
    pages += 1
    const body = new URLSearchParams({
      sessionid: sessionId,
      'cursor[wallet_txnid]': cursor.wallet_txnid,
      'cursor[timestamp]': String(cursor.timestamp),
      'cursor[count]': String(cursor.count),
    }).toString()
    const res = await proxyRequest(proxy, HISTORY_MORE_URL, {
      method: 'POST',
      body,
      timeoutMs: REQ_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: STORE_ORIGIN,
        Referer: `${STORE_ORIGIN}/account/history/`,
        Cookie: cookie,
      },
    })
    if (!res.ok || res.body === '') break
    let parsed: unknown
    try {
      parsed = JSON.parse(res.body)
    } catch {
      break
    }
    const rec = asRecord(parsed)
    const html = strOf(rec?.html)
    if (html) parseHistoryRows(html, totals)
    cursor = rec?.cursor !== undefined ? parseCursorObj(rec.cursor) : null
    if (!html) break
  }
  return totals
}

const buildInventoryItems = (
  rec: Record<string, unknown>,
): { items: SteamInventoryItem[]; total: number } => {
  const descMap = new Map<string, Record<string, unknown>>()
  for (const d of asArray(rec.descriptions)) {
    const dr = asRecord(d)
    if (!dr) continue
    descMap.set(`${strOf(dr.classid) ?? ''}_${strOf(dr.instanceid) ?? ''}`, dr)
  }
  const counts = new Map<string, number>()
  for (const a of asArray(rec.assets)) {
    const ar = asRecord(a)
    if (!ar) continue
    const key = `${strOf(ar.classid) ?? ''}_${strOf(ar.instanceid) ?? ''}`
    const amt = numOf(ar.amount) ?? Number.parseInt(strOf(ar.amount) ?? '1', 10)
    counts.set(key, (counts.get(key) ?? 0) + (Number.isFinite(amt) ? amt : 1))
  }
  const items: SteamInventoryItem[] = []
  let total = 0
  for (const [key, amount] of counts) {
    total += amount
    const dr = descMap.get(key)
    if (!dr) continue
    const item: SteamInventoryItem = {
      name: strOf(dr.name) ?? strOf(dr.market_hash_name) ?? 'Unknown',
      amount,
      marketable: numOf(dr.marketable) === 1 || dr.marketable === true,
      tradable: numOf(dr.tradable) === 1 || dr.tradable === true,
    }
    const icon = strOf(dr.icon_url)
    if (icon) {
      item.iconUrl = `https://community.cloudflare.steamstatic.com/economy/image/${icon}/96fx96f`
    }
    const mhn = strOf(dr.market_hash_name)
    if (mhn) item.marketHashName = mhn
    items.push(item)
    if (items.length >= 200) break
  }
  return { items, total }
}

const fetchInventory = async (
  proxy: ProxyNetTarget,
  steamId: string,
  cookie: string,
): Promise<{ categories: SteamInventoryCategory[]; totalItems: number }> => {
  const categories: SteamInventoryCategory[] = []
  let totalItems = 0
  for (const tgt of INV_TARGETS) {
    const url = `${COMMUNITY_ORIGIN}/inventory/${steamId}/${tgt.appId}/${tgt.ctx}?l=english&count=2000`
    const res = await requestThrough(proxy, url, cookie)
    if (!res.ok || res.body === '') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(res.body)
    } catch {
      continue
    }
    const rec = asRecord(parsed)
    if (!rec) continue
    const built = buildInventoryItems(rec)
    const total = numOf(rec.total_inventory_count) ?? built.total
    if (total > 0) {
      const category: SteamInventoryCategory = {
        key: tgt.key,
        label: tgt.label,
        value: 0,
        itemCount: total,
        appId: tgt.appId,
      }
      if (built.items.length > 0) category.items = built.items
      categories.push(category)
      totalItems += total
    }
  }
  return { categories, totalItems }
}

const mapLoginError = (kind: string): { reason: CheckerReason; message: string } => {
  switch (kind) {
    case 'bad-credentials':
      return { reason: 'unauthorized', message: 'Неверный логин или пароль.' }
    case 'needs-totp':
    case 'needs-device-confirm':
      return {
        reason: 'unauthorized',
        message:
          'Аккаунту требуется Steam Guard. Приложите .maFile или снимите галочку «без 2FA».',
      }
    case 'needs-email-code':
    case 'needs-email-confirm':
      return {
        reason: 'unauthorized',
        message: 'Аккаунту требуется подтверждение по почте — такой вход пока не поддерживается.',
      }
    default:
      return { reason: 'network', message: 'Не удалось войти в аккаунт. Попробуйте другой прокси.' }
  }
}

export const checkSteamAccount = async (
  input: CheckerSteamInput,
): Promise<CheckerSteamResult> => {
  const raw = String(input?.raw ?? '').trim()
  if (raw === '') {
    return { ok: false, reason: 'invalid_input', message: 'Введите данные аккаунта (login:password).' }
  }

  const sep = raw.indexOf(':')
  if (sep <= 0 || sep >= raw.length - 1) {
    return {
      ok: false,
      reason: 'invalid_input',
      message: 'Формат данных: login:password (логин и пароль через двоеточие).',
    }
  }
  const login = raw.slice(0, sep).trim()
  const password = raw.slice(sep + 1).trim()

  const noTwoFactor = Boolean(input.noTwoFactor)
  const sharedSecret = noTwoFactor ? null : extractSharedSecret(input.maFile ?? null)
  if (!noTwoFactor && !sharedSecret) {
    return {
      ok: false,
      reason: 'invalid_input',
      message:
        'Нужен файл .maFile с shared_secret, либо включите «Аккаунту не требуется 2FA для входа».',
    }
  }

  const settings = await getSettings()
  const proxy = resolveProxy(settings.proxies, settings.appProxyId, input.proxyId)
  if (!proxy) {
    return {
      ok: false,
      reason: 'no_proxy',
      message: 'Не найдено ни одного прокси. Загрузите их в «Настройки → Дополнительно → Прокси».',
    }
  }

  log.info(`[checker] steam check for ${login} via proxy ${proxy.host}:${proxy.port}`)

  const proxyUrl = proxyUrlFor(proxy)
  const loginResult = await acquireWebSession({
    login,
    password,
    sharedSecret,
    ...(isSocks(proxy) ? { socksProxy: proxyUrl } : { httpProxy: proxyUrl }),
  })

  if (!loginResult.ok) {
    const mapped = mapLoginError(loginResult.error.kind)
    log.warn(`[checker] login failed (${loginResult.error.kind}) for ${login}`)
    return { ok: false, reason: mapped.reason, message: mapped.message }
  }

  const { steamId, cookies, accessToken } = loginResult.data
  const sessionId = extractSessionId(cookies) ?? randomBytes(12).toString('hex')
  const authCookie = buildAuthCookie(cookies, steamId, accessToken, sessionId)
  const steamId32 = toSteamId32(steamId)
  const warnings: string[] = []

  log.info(
    `[checker] login ok for ${login}: steamId=${steamId} cookies=${cookies.length} token=${accessToken ? 'y' : 'n'} sessionId=${sessionId ? 'y' : 'n'}`,
  )

  const data: SteamCheckData = {
    steamId,
    profileUrl: `${COMMUNITY_ORIGIN}/profiles/${steamId}`,
    steamGuardEnabled: Boolean(sharedSecret),
  }

  const proxyTarget: ProxyNetTarget = {
    host: proxy.host,
    port: proxy.port,
    protocol: proxy.protocol,
    ...(proxy.username ? { username: proxy.username, password: proxy.password ?? '' } : {}),
  }
  try {
    const [summary, level, owned, recent, bans, friends, loyalty] = await Promise.all([
      apiGet(proxyTarget, 'ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId }, accessToken),
      apiGet(proxyTarget, 'IPlayerService/GetSteamLevel/v1/', { steamid: steamId }, accessToken),
      apiGet(
        proxyTarget,
        'IPlayerService/GetOwnedGames/v1/',
        { steamid: steamId, include_appinfo: 1, include_played_free_games: 1 },
        accessToken,
      ),
      apiGet(
        proxyTarget,
        'IPlayerService/GetRecentlyPlayedGames/v1/',
        { steamid: steamId, count: 12 },
        accessToken,
      ),
      apiGet(proxyTarget, 'ISteamUser/GetPlayerBans/v1/', { steamids: steamId }, accessToken),
      apiGet(
        proxyTarget,
        'ISteamUser/GetFriendList/v1/',
        { steamid: steamId, relationship: 'friend' },
        accessToken,
      ),
      apiGet(proxyTarget, 'ILoyaltyRewardsService/GetSummary/v1/', { steamid: steamId }, accessToken),
    ])

    const [xmlRes, walletRes, pointsRes, cs2Res] = await Promise.all([
      requestThrough(proxyTarget, `${COMMUNITY_ORIGIN}/profiles/${steamId}?xml=1&l=english`, authCookie),
      requestThrough(proxyTarget, `${STORE_ORIGIN}/account/`, authCookie),
      requestThrough(proxyTarget, `${STORE_ORIGIN}/pointssummary/ajaxgetasyncconfig`, authCookie),
      requestThrough(
        proxyTarget,
        `${COMMUNITY_ORIGIN}/profiles/${steamId}/gcpd/730/?tab=matchmaking&l=english`,
        authCookie,
      ),
    ])

    const [rustStats, cs2Stats, faceitLevel, dotaStats, hasKeys] = await Promise.all([
      fetchGameStats(proxyTarget, 252490, steamId, accessToken),
      fetchGameStats(proxyTarget, 730, steamId, accessToken),
      fetchFaceitLevel(proxyTarget, steamId),
      steamId32 ? fetchDotaStats(proxyTarget, steamId32) : Promise.resolve(undefined),
      fetchHasActivatedKeys(proxyTarget, authCookie),
    ])

    const player = asRecord(asArray(asRecord(summary?.response)?.players)[0])
    if (player) {
      const persona = strOf(player.personaname)
      if (persona) data.personaName = persona
      const avatar = strOf(player.avatarfull) ?? strOf(player.avatar)
      if (avatar) data.avatarUrl = avatar
      const country = strOf(player.loccountrycode)
      if (country) data.country = countryName(country)
      const profileUrl = strOf(player.profileurl)
      if (profileUrl) data.profileUrl = profileUrl
      const created = numOf(player.timecreated)
      if (created) {
        data.registeredAt = created
        data.registeredText = formatDate(created)
      }
      const inGame = strOf(player.gameextrainfo)
      const personaState = numOf(player.personastate) ?? 0
      const lastLogoff = numOf(player.lastlogoff)
      if (inGame) data.lastOnlineText = `В игре: ${inGame}`
      else if (personaState > 0) data.lastOnlineText = 'В сети'
      else if (lastLogoff) {
        data.lastLogoffAt = lastLogoff
        data.lastOnlineText = formatDateTime(lastLogoff)
      }
      const visibility = numOf(player.communityvisibilitystate)
      if (visibility !== undefined) data.privacyPublic = visibility === 3
    }

    const playerLevel = numOf(asRecord(level?.response)?.player_level)
    if (playerLevel !== undefined) data.profileLevel = playerLevel

    const ownedResp = asRecord(owned?.response)
    if (ownedResp) {
      const gameCount = numOf(ownedResp.game_count)
      const list: SteamGameEntry[] = []
      for (const rawGame of asArray(ownedResp.games)) {
        const entry = gameFromApi(rawGame)
        if (entry) list.push(entry)
      }
      list.sort((a, b) => (b.playtimeMinutes ?? 0) - (a.playtimeMinutes ?? 0))
      if (list.length > 0) data.games = list
      if (gameCount !== undefined) data.gamesCount = gameCount
      else if (list.length > 0) data.gamesCount = list.length
    }

    const recentResp = asRecord(recent?.response)
    if (recentResp) {
      let minutes = 0
      const recentGames: SteamGameEntry[] = []
      for (const rawGame of asArray(recentResp.games)) {
        const entry = gameFromApi(rawGame)
        if (!entry) continue
        const g = asRecord(rawGame)
        minutes += numOf(g?.playtime_2weeks) ?? 0
        recentGames.push(entry)
      }
      if (recentGames.length > 0) data.recentGames = recentGames.slice(0, 12)
      data.playtimeTwoWeeksMinutes = minutes
    }
    if (!data.recentGames && data.games) {
      data.recentGames = data.games.filter((g) => g.playtimeMinutes).slice(0, 8)
    }

    const ban = asRecord(asArray(bans?.players)[0])
    if (ban) {
      const vac = boolOf(ban.VACBanned)
      const community = boolOf(ban.CommunityBanned)
      const economy = strOf(ban.EconomyBan)
      data.vacBanned = vac
      data.communityBanned = community
      const vacCount = numOf(ban.NumberOfVACBans)
      if (vacCount !== undefined) data.numberOfVacBans = vacCount
      const gameBans = numOf(ban.NumberOfGameBans)
      if (gameBans !== undefined) data.numberOfGameBans = gameBans
      if (economy) data.economyBan = economy
      data.isBanned = vac || community || (economy !== undefined && economy !== 'none')
    }

    const friendsList = asRecord(friends?.friendslist)
    if (friendsList) {
      data.friendsCount = asArray(friendsList.friends).length
    }

    if (xmlRes.ok && xmlRes.body) {
      const limited = matchOne(xmlRes.body, /<isLimitedAccount>(\d)<\/isLimitedAccount>/i)
      if (limited !== null) data.limitedAccount = limited === '1'
      if (!data.personaName) parseProfileXml(xmlRes.body, data)
    }

    if (walletRes.ok && walletRes.body) {
      parseWallet(walletRes.body, data)
      if (!data.currency) data.currency = currencyFromSymbol(walletRes.body)
      if (data.balance === undefined) data.balance = 0
      if (data.balanceOnHold === undefined) data.balanceOnHold = 0
    }
    if (pointsRes.ok && pointsRes.body) {
      const points = parsePoints(pointsRes.body)
      if (points !== undefined) data.points = points
    }
    const loyaltyPoints = numLoose(asRecord(asRecord(loyalty?.response)?.summary)?.points)
    if (loyaltyPoints !== undefined) data.points = loyaltyPoints
    if (cs2Res.ok && cs2Res.body) {
      const cs2 = parseCs2(cs2Res.body)
      if (cs2) data.cs2 = cs2
    }

    const cs2StatWins = cs2Stats.get('total_wins')
    if (cs2StatWins !== undefined) {
      data.cs2 = { ...(data.cs2 ?? {}), wins: data.cs2?.wins ?? cs2StatWins }
    }

    const rustKills = rustStats.get('kill_player') ?? rustStats.get('kills')
    const rustDeaths = rustStats.get('deaths')
    if (rustKills !== undefined || rustDeaths !== undefined) {
      const rust: SteamRustStats = {}
      if (rustKills !== undefined) rust.kills = rustKills
      if (rustDeaths !== undefined) rust.deaths = rustDeaths
      data.rust = rust
    }

    if (faceitLevel !== undefined) data.faceitLevel = faceitLevel
    if (dotaStats) data.dota2 = dotaStats
    if (hasKeys !== undefined) data.hasActivatedKeys = hasKeys

    if (!data.country && xmlRes.ok && xmlRes.body) {
      const loc = cdata(xmlRes.body, 'location')
      if (loc) data.country = loc
    }

    const [profileHtml, txnTotals, inventory] = await Promise.all([
      requestThrough(proxyTarget, `${COMMUNITY_ORIGIN}/profiles/${steamId}?l=english`, authCookie),
      fetchTransactions(proxyTarget, authCookie, sessionId),
      fetchInventory(proxyTarget, steamId, authCookie),
    ])

    if (profileHtml.ok && profileHtml.body) parseProfileHtml(profileHtml.body, data)
    if (data.friendsCount === undefined && profileHtml.ok) data.friendsCount = 0

    if (data.points === undefined) {
      const shop = await requestThrough(proxyTarget, `${STORE_ORIGIN}/points/shop/?l=english`, authCookie)
      if (shop.ok && shop.body) {
        const shopPoints = parsePoints(shop.body)
        if (shopPoints !== undefined) data.points = shopPoints
      }
    }

    data.transactionsCount = txnTotals.count
    data.transactionsSum = round2(txnTotals.sum)
    data.gamesValue = round2(txnTotals.gamesValue)
    data.inGamePurchases = round2(txnTotals.inGame)
    data.giftsRefunds = round2(txnTotals.giftsRefunds)
    data.gifts = txnTotals.giftsCount
    data.totalSpent = round2(txnTotals.totalSpent)
    data.purchasesSum = round2(txnTotals.totalSpent)
    data.transactions = txnTotals.rows
    if (!data.currency && txnTotals.currency) data.currency = txnTotals.currency

    if (inventory.categories.length > 0) {
      data.inventoryCategories = inventory.categories
      data.inventoryItemsTotal = inventory.totalItems
      try {
        const priced = await priceInventory(steamId, inventory.categories, data.currency)
        if (priced.valued) data.inventoryValueTotal = priced.total
        else if (priced.tokenMissing) {
          warnings.push(
            'Стоимость инвентаря недоступна: войдите в маркет (Lolzteam) — цена берётся через lzt.market.',
          )
        } else {
          warnings.push(
            'Стоимость инвентаря недоступна: инвентарь скрыт или маркет не вернул цену.',
          )
        }
      } catch (priceErr) {
        log.warn('[checker] inventory pricing failed', priceErr)
      }
    }

    deriveRestrictions(data)

    if (data.isBanned === undefined) data.isBanned = false

    log.info(
      `[checker] steam ${steamId} fields: apiSummary=${player ? 'y' : 'n'} level=${data.profileLevel ?? '-'} games=${data.gamesCount ?? '-'} friends=${data.friendsCount ?? '-'} points=${data.points ?? '-'}(pts:${pointsRes.status}/${pointsRes.body.length}) balance=${data.balanceText ?? '-'}(wallet:${walletRes.status}/${walletRes.body.length}) country=${data.country ?? '-'}(xml:${xmlRes.status}) profileHtml=${profileHtml.status}/${profileHtml.body.length} history=${txnTotals.count} inv=${data.inventoryItemsTotal ?? 0} invValue=${data.inventoryValueTotal ?? '-'} faceit=${data.faceitLevel ?? '-'} rust=${data.rust ? 'y' : 'n'} dota=${data.dota2 ? 'y' : 'n'} keys=${data.hasActivatedKeys ?? '-'}`,
    )

    if (!player && !(xmlRes.ok && xmlRes.body)) {
      warnings.push(
        'Вход выполнен, но Steam API не вернул данные профиля. Попробуйте другой прокси.',
      )
    }

    return { ok: true, data, ...(warnings.length > 0 ? { warnings } : {}) }
  } catch (err) {
    log.error('[checker] steam scrape failed', err)
    return {
      ok: false,
      reason: 'bad_response',
      message: 'Вход выполнен, но не удалось собрать данные профиля. Попробуйте другой прокси.',
    }
  }
}
