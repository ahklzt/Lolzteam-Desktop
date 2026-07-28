import { LZT_CONFIG, type UserProfile } from '@lzt/shared'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { appFetch } from './app-fetch'

const DEFAULT_TIMEOUT_MS = 15_000

export class LztApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'LztApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  timeoutMs?: number
}

const authFetch = async (url: string, opts: RequestOptions = {}): Promise<Response> => {
  const token = await loadToken()
  if (!token) throw new LztApiError('Нет токена авторизации', 401)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    return await appFetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

type MeUser = {
  user_id?: number
  username?: string
  username_html?: string
  links?: { avatar?: string; avatar_big?: string }
  balance?: number | string
  convertedBalance?: number | string
  currency?: string
}
type MeResponse = { user?: MeUser }

const extractUsernameColor = (html: string | undefined): string | null => {
  if (!html) return null
  const m = /color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/.exec(html)
  return m?.[1] ?? null
}

const parseBalance = (value: number | string | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export type ProfileResult =
  | { kind: 'ok'; profile: UserProfile }
  | { kind: 'unauthorized' }
  | { kind: 'offline' }

export const fetchProfileResult = async (): Promise<ProfileResult> => {
  try {
    const res = await authFetch(`${LZT_CONFIG.forumApiUrl}/users/me`)
    if (res.status === 401 || res.status === 403) return { kind: 'unauthorized' }
    if (!res.ok) {
      log.warn('[api] /users/me returned', res.status)
      return { kind: 'offline' }
    }
    const data = (await res.json()) as MeResponse
    const user = data.user
    if (!user?.user_id || !user.username) return { kind: 'unauthorized' }

    const profile: UserProfile = {
      userId: user.user_id,
      username: user.username,
      avatarUrl: user.links?.avatar_big ?? user.links?.avatar ?? null,
      usernameColor: extractUsernameColor(user.username_html),
      balance: null,
      currency: null,
    }

    try {
      const marketRes = await authFetch(`${LZT_CONFIG.marketApiUrl}/me`)
      if (marketRes.ok) {
        const marketData = (await marketRes.json()) as MeResponse
        const mu = marketData.user
        if (mu) {
          profile.balance = parseBalance(mu.convertedBalance ?? mu.balance)
          profile.currency = typeof mu.currency === 'string' ? mu.currency.toUpperCase() : null
        }
      }
    } catch (err) {
      log.warn('[api] market /me enrich failed', err)
    }

    return { kind: 'ok', profile }
  } catch (err) {
    if (err instanceof LztApiError && err.status === 401) return { kind: 'unauthorized' }
    log.warn('[api] /users/me network error', err)
    return { kind: 'offline' }
  }
}

export const setCurrency = async (
  currency: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  try {
    const res = await authFetch(`${LZT_CONFIG.marketApiUrl}/me`, {
      method: 'PUT',
      body: { user: { currency } },
    })
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'not_authenticated' }
    if (!res.ok) return { ok: false, message: `http_${res.status}` }
    return { ok: true }
  } catch (err) {
    log.warn(`[api] setCurrency(${currency}) failed`, err)
    return { ok: false, message: err instanceof Error ? err.message : 'currency_failed' }
  }
}

export const pingApi = async (timeoutMs = 8000): Promise<{ online: boolean; ms: number }> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    await appFetch(`${LZT_CONFIG.marketApiUrl}/me`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    return { online: true, ms: Date.now() - started }
  } catch {
    return { online: false, ms: 0 }
  } finally {
    clearTimeout(timer)
  }
}
