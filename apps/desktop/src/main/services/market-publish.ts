import { LZT_CONFIG } from '@lzt/shared'
import type {
  MarketCurrency,
  MarketEditPriceInput,
  MarketErrorReason,
  MarketFastSellInput,
  MarketFastSellResult,
  MarketItem,
  MarketPriceEditResult,
  MarketProxyEntry,
  MarketProxyListResult,
  MarketPublishInput,
  MarketPublishResult,
  MarketSellUploadInput,
  MarketSellUploadResult,
} from '@lzt/shared'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { addItemTag } from './market-api'
import { appFetch } from './app-fetch'
import { marketLimiter } from './market-rate-limiter'

const DEFAULT_TIMEOUT_MS = 30_000

const reasonFromStatus = (status: number): MarketErrorReason => {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'network'
  return 'bad_response'
}

const extractError = (data: Record<string, unknown>): string | undefined => {
  const errors = data.errors
  if (Array.isArray(errors) && errors.length > 0) return String(errors[0])
  if (typeof data.error === 'string') return data.error
  if (typeof data.message === 'string') return data.message
  return undefined
}

const appendExtra = (
  form: URLSearchParams,
  extra?: Record<string, string | number | boolean>,
): void => {
  if (!extra) return
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null) continue
    form.set(key, String(value))
  }
}

const applyPrice = (
  form: URLSearchParams,
  price: number | undefined,
  currency: MarketCurrency | undefined,
): void => {
  if (typeof price === 'number') form.set('price', String(price))
  if (currency) form.set('currency', currency)
}

type FormResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: MarketErrorReason; message?: string }

const sendForm = async (
  path: string,
  method: 'POST' | 'PUT',
  form: URLSearchParams,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FormResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }

  await marketLimiter.acquire()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    })
    marketLimiter.applyHeaders(res.headers)
    if (res.status === 429) marketLimiter.noteRetryAfter(res.headers)
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      log.warn(`[market] ${method} ${path} -> ${res.status}`)
      return {
        ok: false,
        reason: reasonFromStatus(res.status),
        message: extractError(data),
      }
    }
    return { ok: true, data }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    log.error(`[market] ${method} ${path} failed`, err)
    return { ok: false, reason: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

const readItem = (data: Record<string, unknown>): MarketItem | null =>
  data.item && typeof data.item === 'object' ? (data.item as MarketItem) : null

const readItemId = (
  data: Record<string, unknown>,
  item: MarketItem | null,
): number | null => {
  if (item && typeof item.item_id === 'number') return item.item_id
  if (typeof data.item_id === 'number') return data.item_id
  return null
}

export const publishItem = async (
  input: MarketPublishInput,
): Promise<MarketPublishResult> => {
  const form = new URLSearchParams()
  form.set('category_id', String(input.categoryId))
  applyPrice(form, input.price, input.currency)
  if (input.title) form.set('title', input.title)
  if (input.titleEn) form.set('title_en', input.titleEn)
  if (input.description) form.set('description', input.description)
  if (input.information) form.set('information', input.information)
  if (input.loginData) form.set('login_data', input.loginData)
  if (input.emailLoginData) form.set('email_login_data', input.emailLoginData)
  if (typeof input.guarantee === 'number') {
    form.set('extended_guarantee', String(input.guarantee))
  }
  if (input.originId) form.set('origin', input.originId)
  appendExtra(form, input.extra)

  const res = await sendForm('/item/add', 'POST', form)
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message }
  const item = readItem(res.data)
  return { ok: true, item, itemId: readItemId(res.data, item) }
}

export const fastSellItem = async (
  itemId: number,
  input: MarketFastSellInput,
): Promise<MarketFastSellResult> => {
  const form = new URLSearchParams()
  applyPrice(form, input.price, input.currency)
  if (input.title) form.set('title', input.title)
  if (input.titleEn) form.set('title_en', input.titleEn)
  if (input.description) form.set('description', input.description)
  if (input.information) form.set('information', input.information)
  appendExtra(form, input.extra)

  const res = await sendForm(`/${itemId}/fast-sell`, 'POST', form)
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message }
  const item = readItem(res.data)
  return { ok: true, item, itemId: readItemId(res.data, item) ?? itemId }
}

export const editItemPrice = async (
  input: MarketEditPriceInput,
): Promise<MarketPriceEditResult> => {
  const form = new URLSearchParams()
  applyPrice(form, input.price, input.currency)
  const res = await sendForm(`/${input.itemId}/edit`, 'PUT', form)
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message }
  return { ok: true, item: readItem(res.data) }
}

export const sellUpload = async (
  input: MarketSellUploadInput,
): Promise<MarketSellUploadResult> => {
  const warnings: string[] = []
  const form = new URLSearchParams()
  form.set('category_id', String(input.categoryId))
  applyPrice(form, input.price, input.currency)
  form.set('item_origin', input.itemOrigin)
  if (input.title) form.set('title', input.title)
  if (input.titleEn) form.set('title_en', input.titleEn)
  if (input.description) form.set('description', input.description)
  if (input.information) form.set('information', input.information)
  if (typeof input.guarantee === 'number') {
    form.set('extended_guarantee', String(input.guarantee))
  }
  if (input.hasEmailLoginData) {
    form.set('has_email_login_data', '1')
    if (input.emailLoginData) form.set('email_login_data', input.emailLoginData)
  }
  if (input.loginPassword) {
    form.set('login_password', input.loginPassword)
  } else {
    if (input.login) form.set('login', input.login)
    if (input.password) form.set('password', input.password)
  }
  if (input.randomProxy) {
    form.set('random_proxy', '1')
  } else if (typeof input.proxyId === 'number' && Number.isFinite(input.proxyId)) {
    form.set('proxy_id', String(input.proxyId))
  }
  if (input.mafile) {
    form.set('mafile', input.mafile)
  }
  appendExtra(form, input.extra)

  const res = await sendForm('/item/fast-sell', 'POST', form, 120_000)
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message }

  const item = readItem(res.data)
  const itemId = readItemId(res.data, item)

  if (itemId && input.tagIds && input.tagIds.length > 0) {
    for (const tagId of input.tagIds) {
      const tagRes = await addItemTag(itemId, tagId)
      if (!tagRes.ok) {
        warnings.push(`Не удалось привязать тег ${tagId}`)
      }
    }
  } else if (!itemId && input.tagIds && input.tagIds.length > 0) {
    warnings.push('Теги не привязаны: маркет не вернул id лота')
  }

  return {
    ok: true,
    item,
    itemId,
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}

const toProxyEntry = (
  raw: Record<string, unknown>,
): MarketProxyEntry | null => {
  const idRaw = raw.proxy_id ?? raw.id
  const id = typeof idRaw === 'string' ? Number.parseInt(idRaw, 10) : idRaw
  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  const ipRaw = raw.proxy_ip ?? raw.ip ?? raw.host
  const ip = typeof ipRaw === 'string' ? ipRaw : ''
  if (!ip) return null
  const portRaw = raw.proxy_port ?? raw.port
  const port =
    typeof portRaw === 'string' ? Number.parseInt(portRaw, 10) : portRaw
  if (typeof port !== 'number' || !Number.isFinite(port)) return null
  const userRaw = raw.proxy_user ?? raw.username
  const user = typeof userRaw === 'string' && userRaw ? userRaw : undefined
  const label = user ? `${ip}:${port} (${user})` : `${ip}:${port}`
  return { proxyId: id, ip, port, ...(user ? { user } : {}), label }
}

export const getMarketProxyList = async (): Promise<MarketProxyListResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }

  await marketLimiter.acquire()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}/proxy`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    marketLimiter.applyHeaders(res.headers)
    if (res.status === 429) marketLimiter.noteRetryAfter(res.headers)
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      log.warn(`[market] GET /proxy -> ${res.status}`)
      return {
        ok: false,
        reason: reasonFromStatus(res.status),
        message: extractError(data),
      }
    }
    const node = data.proxies ?? data.proxy ?? data.data ?? data
    const rawList = Array.isArray(node)
      ? node
      : node && typeof node === 'object'
        ? Object.values(node as Record<string, unknown>)
        : []
    const proxies = rawList
      .map((entry) =>
        entry && typeof entry === 'object'
          ? toProxyEntry(entry as Record<string, unknown>)
          : null,
      )
      .filter((entry): entry is MarketProxyEntry => entry !== null)
    return { ok: true, proxies }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    log.error('[market] GET /proxy failed', err)
    return { ok: false, reason: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}
