import type { AccountLoginDetails } from '../contract'

export interface InjectableCookie {
  url: string
  name: string
  value: string
  domain?: string
  path: string
  secure: boolean
  httpOnly: boolean
  expirationDate?: number
  sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict'
}

export interface BrowserLoginData {
  cookies: InjectableCookie[]
  landingUrl: string
}

export interface RawCookie {
  name?: unknown
  value?: unknown
  domain?: unknown
  path?: unknown
  secure?: unknown
  httpOnly?: unknown
  session?: unknown
  expirationDate?: unknown
  sameSite?: unknown
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

const SAME_SITE_VALUES = ['unspecified', 'no_restriction', 'lax', 'strict'] as const
const normalizeSameSite = (v: unknown): InjectableCookie['sameSite'] => {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  return (SAME_SITE_VALUES as readonly string[]).includes(s)
    ? (s as InjectableCookie['sameSite'])
    : 'unspecified'
}

const cookieUrl = (domain: string, path: string, secure: boolean): string => {
  const host = domain.startsWith('.') ? domain.slice(1) : domain
  const scheme = secure ? 'https' : 'http'
  return `${scheme}://${host}${path.startsWith('/') ? path : `/${path}`}`
}

export const toInjectable = (raw: RawCookie): InjectableCookie | null => {
  const name = asString(raw.name)
  const domain = asString(raw.domain)
  if (!name || domain === null) return null
  const value = typeof raw.value === 'string' ? raw.value : ''

  const path = asString(raw.path) ?? '/'
  const secure = raw.secure === true
  const httpOnly = raw.httpOnly === true

  const cookie: InjectableCookie = {
    url: cookieUrl(domain, path, secure),
    name,
    value,
    domain,
    path,
    secure,
    httpOnly,
    sameSite: normalizeSameSite(raw.sameSite),
  }

  if (raw.session !== true && typeof raw.expirationDate === 'number') {
    if (raw.expirationDate * 1000 <= Date.now()) return null
    cookie.expirationDate = raw.expirationDate
  }

  return cookie
}

export const asCookieArray = (raw: unknown): unknown[] | null => {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

const resolveCookies = (
  secrets: Record<string, unknown>,
  categoryRaw: string,
): unknown[] | null => {
  const candidates: string[] = []
  const explicit = asString(secrets.cookieKey)
  if (explicit) candidates.push(explicit)
  candidates.push(`${categoryRaw.toLowerCase().replace(/[^a-z]/g, '')}_cookies`, 'cookies')

  for (const key of candidates) {
    if (key in secrets) {
      const arr = asCookieArray(secrets[key])
      if (arr) return arr
    }
  }

  for (const [key, val] of Object.entries(secrets)) {
    if (key === 'cookies' || key.endsWith('_cookies')) {
      const arr = asCookieArray(val)
      if (arr) return arr
    }
  }
  return null
}

const resolveLandingUrl = (
  secrets: Record<string, unknown>,
  cookies: InjectableCookie[],
): string => {
  const link = asString(secrets.accountLink)
  if (link) return link
  const domain = cookies[0]?.domain ?? ''
  const host = domain.startsWith('.') ? domain.slice(1) : domain
  return host ? `https://${host}/` : 'about:blank'
}

export const extractBrowserLogin = (details: AccountLoginDetails): BrowserLoginData | null => {
  const secrets = details.item as Record<string, unknown>
  const rawList = resolveCookies(secrets, details.categoryTitle)
  if (!rawList) return null

  const cookies = rawList
    .map((c) => toInjectable(c as RawCookie))
    .filter((c): c is InjectableCookie => c !== null)

  if (cookies.length === 0) return null

  return { cookies, landingUrl: resolveLandingUrl(secrets, cookies) }
}

export const accountLabel = (details: AccountLoginDetails): string => {
  const item = details.item as Record<string, unknown>
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : ''
  return title || `аккаунт #${details.itemId}`
}
