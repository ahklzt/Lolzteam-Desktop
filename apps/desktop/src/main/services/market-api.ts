import { LZT_CONFIG } from '@lzt/shared'
import type {
  MarketCategoriesResult,
  MarketCategoryGamesResult,
  MarketCategoryParamsResult,
  MarketErrorReason,
  MarketItem,
  MarketItemsResult,
  MarketUserItemsResult,
  MarketUserItemsQuery,
  MarketUserItemStatesResult,
  MarketAccountResult,
  MarketQuery,
  MarketSearchParam,
  MarketTransferInput,
  MarketTransferResult,
  MarketTransferFeeResult,
  MarketCurrencyRatesResult,
  MarketItemsPage,
  MarketUserInfo,
  MarketTag,
  MarketTagInput,
  MarketTagsResult,
  MarketTagMutationResult,
  MarketPayment,
  MarketPaymentData,
  MarketPaymentsPage,
  MarketPaymentsQuery,
  MarketPaymentsResult,
  MarketSimpleResult,
  MarketTempEmailPasswordResult,
  MarketMafileResult,
  MarketCheckResult,
  MarketDownloadQuery,
  MarketDownloadResult,
} from '@lzt/shared'
import log from 'electron-log/main'
import { loadToken } from '../auth/token-store'
import { appFetch } from './app-fetch'
import type { MarketProxyEntry, MarketProxyListResult } from '@lzt/shared'

const DEFAULT_TIMEOUT_MS = 20_000

type FetchOk = { ok: true; data: Record<string, unknown> }
type FetchErr = { ok: false; reason: MarketErrorReason }
type FetchResult = FetchOk | FetchErr

const reasonFromStatus = (status: number): MarketErrorReason => {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'network'
  return 'bad_response'
}

const buildQuery = (params: Record<string, unknown>): string => {
  const usp = new URLSearchParams()
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === '') continue
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (value === undefined || value === null || value === '') continue
        usp.append(`${key}[]`, String(value))
      }
    } else {
      usp.append(key, String(raw))
    }
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

const marketFetch = async (
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FetchResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      log.warn(`[market] GET ${path} -> ${res.status}`)
      return { ok: false, reason: reasonFromStatus(res.status) }
    }
    const data = (await res.json()) as Record<string, unknown>
    return { ok: true, data }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    log.error(`[market] GET ${path} failed`, err)
    return { ok: false, reason: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

const toSearchParam = (raw: unknown): MarketSearchParam | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string') return null
  return {
    name: o.name,
    input: typeof o.input === 'string' ? o.input : 'text',
    description: typeof o.description === 'string' ? o.description : undefined,
    values: Array.isArray(o.values) ? o.values.map((v) => String(v)) : undefined,
  }
}

export const getMarketItems = async (
  query: MarketQuery,
): Promise<MarketItemsResult> => {
  const slug = typeof query.slug === 'string' ? query.slug.trim() : ''
  const params: Record<string, unknown> = {
    page: query.page,
    title: query.title,
    pmin: query.pmin,
    pmax: query.pmax,
    order_by: query.order_by,
  }
  if (query.filters) {
    for (const [key, value] of Object.entries(query.filters)) params[key] = value
  }

  const basePath = slug ? `/${slug}` : '/'
  const res = await marketFetch(`${basePath}${buildQuery(params)}`)
  if (!res.ok) return { ok: false, reason: res.reason }

  const d = res.data
  const items = Array.isArray(d.items) ? (d.items as MarketItem[]) : []
  return {
    ok: true,
    page: {
      items,
      totalItems: typeof d.totalItems === 'number' ? d.totalItems : items.length,
      hasNextPage: Boolean(d.hasNextPage),
      perPage: typeof d.perPage === 'number' ? d.perPage : items.length,
      page: typeof d.page === 'number' ? d.page : (query.page ?? 1),
    },
  }
}

export const getUserItems = async (
  userId: number,
  page = 1,
  query?: MarketUserItemsQuery,
): Promise<MarketUserItemsResult> => {
  const params: Record<string, unknown> = { user_id: userId, page }
  if (query) {
    if (typeof query.category_id === 'number') params.category_id = query.category_id
    if (query.title) params.title = query.title
    if (typeof query.pmin === 'number') params.pmin = query.pmin
    if (typeof query.pmax === 'number') params.pmax = query.pmax
    if (query.order_by) params.order_by = query.order_by
    if (query.show) params.show = query.show
    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) params[k] = v
    }
  }
  const res = await marketFetch(`/user/items${buildQuery(params)}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const items = Array.isArray(d.items) ? (d.items as MarketItem[]) : []
  const user =
    d.user && typeof d.user === 'object' ? (d.user as MarketUserInfo) : null
  return {
    ok: true,
    user,
    page: {
      items,
      totalItems: typeof d.totalItems === 'number' ? d.totalItems : items.length,
      hasNextPage: Boolean(d.hasNextPage),
      perPage: typeof d.perPage === 'number' ? d.perPage : items.length,
      page: typeof d.page === 'number' ? d.page : page,
    },
  }
}

export const getUserItemStates = async (
  userId: number,
): Promise<MarketUserItemStatesResult> => {
  const res = await marketFetch(`/user/item-states${buildQuery({ user_id: userId })}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, states: res.data }
}

export const getAccount = async (
  itemId: number,
): Promise<MarketAccountResult> => {
  const res = await marketFetch(`/${itemId}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const item =
    d.item && typeof d.item === 'object' ? (d.item as MarketItem) : null
  if (!item) return { ok: false, reason: 'bad_response' }
  return {
    ok: true,
    item,
    canBuyItem: Boolean(d.canBuyItem),
    canReportItem: Boolean(d.canReportItem),
    canEditItem: Boolean(d.canEditItem),
    faveCount: typeof d.faveCount === 'number' ? d.faveCount : null,
    itemLink: typeof d.itemLink === 'string' ? d.itemLink : null,
    sameItems: Array.isArray(d.sameItemsIds)
      ? (d.sameItemsIds as unknown[]).filter((n): n is number => typeof n === 'number')
      : [],
  }
}

export const checkAccount = async (
  itemId: number,
): Promise<MarketCheckResult> => {
  const res = await marketMutate(`/${itemId}/check-account`, 'POST')
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const status = typeof d.status === 'string' ? d.status : ''
  const item =
    d.item && typeof d.item === 'object'
      ? (d.item as Record<string, unknown>)
      : null
  const tagIds: number[] = []
  const rawTags = item ? (item as { tags?: unknown }).tags : undefined
  const entries = Array.isArray(rawTags)
    ? rawTags
    : rawTags && typeof rawTags === 'object'
      ? Object.values(rawTags as Record<string, unknown>)
      : []
  for (const e of entries) {
    if (
      e &&
      typeof e === 'object' &&
      typeof (e as { tag_id?: unknown }).tag_id === 'number'
    ) {
      tagIds.push((e as { tag_id: number }).tag_id)
    }
  }
  const valid = tagIds.includes(2)
    ? false
    : tagIds.includes(1)
      ? true
      : status === 'ok' || status === 'valid'
  const message =
    typeof d.message === 'string' ? d.message : status || undefined
  return { ok: true, valid, message, tagIds }
}

export const getMarketCategories =
  async (): Promise<MarketCategoriesResult> => {
    const res = await marketFetch('/category')
    if (!res.ok) return { ok: false, reason: res.reason }
    const d = res.data
    const rawList = Array.isArray(d.categories)
      ? d.categories
      : Array.isArray(d.category)
        ? d.category
        : d.category && typeof d.category === 'object'
          ? [d.category]
          : []
    const categories = (rawList as unknown[])
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null
        const o = raw as Record<string, unknown>
        if (typeof o.category_id !== 'number') return null
        return {
          category_id: o.category_id,
          category_name:
            typeof o.category_name === 'string' ? o.category_name : undefined,
          category_title:
            typeof o.category_title === 'string' ? o.category_title : undefined,
          category_url:
            typeof o.category_url === 'string' ? o.category_url : undefined,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
    return { ok: true, categories }
  }

export const getCategoryParams = async (
  slug: string,
): Promise<MarketCategoryParamsResult> => {
  const res = await marketFetch(`/${slug}/params`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const rawParams = Array.isArray(d.params) ? (d.params as unknown[]) : []
  const params = rawParams
    .map(toSearchParam)
    .filter((p): p is MarketSearchParam => p !== null)
  const baseObj =
    d.base_params && typeof d.base_params === 'object'
      ? (d.base_params as Record<string, unknown>)
      : {}
  const baseParams = Object.values(baseObj)
    .map(toSearchParam)
    .filter((p): p is MarketSearchParam => p !== null)
  return { ok: true, params, baseParams }
}

export const getCategoryGames = async (
  slug: string,
): Promise<MarketCategoryGamesResult> => {
  const res = await marketFetch(`/${slug}/games`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const rawGames = Array.isArray(d.games) ? (d.games as unknown[]) : []
  const games = rawGames
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const o = raw as Record<string, unknown>
      if (o.app_id === undefined || o.app_id === null) return null
      const appId = String(o.app_id)
      return {
        app_id: appId,
        title: typeof o.title === 'string' ? o.title : appId,
        abbr: typeof o.abbr === 'string' ? o.abbr : undefined,
        category_id: typeof o.category_id === 'number' ? o.category_id : undefined,
        img: typeof o.img === 'string' ? o.img : undefined,
        url: typeof o.url === 'string' ? o.url : undefined,
        ru: typeof o.ru === 'string' ? o.ru : undefined,
      }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
  return { ok: true, games }
}

const extractError = (data: Record<string, unknown>): string | undefined => {
  const errors = data.errors
  if (Array.isArray(errors) && errors.length > 0) return String(errors[0])
  if (typeof data.error === 'string') return data.error
  if (typeof data.message === 'string') return data.message
  return undefined
}

export const transferMoney = async (
  input: MarketTransferInput,
): Promise<MarketTransferResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }
  const body = new URLSearchParams()
  body.set('amount', String(input.amount))
  body.set('currency', input.currency)
  if (input.userId !== undefined) body.set('user_id', String(input.userId))
  if (input.username) body.set('username', input.username)
  if (input.comment) body.set('comment', input.comment)
  if (input.telegramDeal) body.set('telegram_deal', 'true')
  if (input.telegramUsername) body.set('telegram_username', input.telegramUsername)
  if (input.transferHold) body.set('transfer_hold', 'true')
  if (input.holdLengthValue !== undefined) body.set('hold_length_value', String(input.holdLengthValue))
  if (input.holdLengthOption) body.set('hold_length_option', input.holdLengthOption)
  if (input.secretAnswer) body.set('secret_answer', input.secretAnswer)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}/balance/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok) return { ok: true }
    log.warn(`[market] POST /balance/transfer -> ${res.status}`)
    const message = extractError(data)
    if (res.status === 401) return { ok: false, reason: 'unauthorized', message }
    if (res.status === 403) return { ok: false, reason: 'invalid_secret', message }
    if (res.status === 404) return { ok: false, reason: 'user_not_found', message }
    if (res.status === 429) return { ok: false, reason: 'rate_limited', message }
    return { ok: false, reason: 'bad_request', message }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    log.error('[market] POST /balance/transfer failed', err)
    return { ok: false, reason: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export const checkTransferFee = async (
  amount: number,
): Promise<MarketTransferFeeResult> => {
  const res = await marketFetch(`/balance/transfer/fee${buildQuery({ amount })}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const calc = d.calculator && typeof d.calculator === 'object' ? (d.calculator as Record<string, unknown>) : {}
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
  return {
    ok: true,
    fee: {
      commissionPercentage: num(d.commission_percentage),
      commissionAmount: num(calc.commissionAmount),
      totalOutputAmount: num(calc.totalOutputAmount),
      inputAmount: num(calc.inputAmount ?? amount),
      spentCurrentMonth: num(d.spentCurrentMonth),
    },
  }
}

export const getCurrencyRates = async (): Promise<MarketCurrencyRatesResult> => {
  const res = await marketFetch('/currency')
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data
  const list = d.currencyList && typeof d.currencyList === 'object' ? (d.currencyList as Record<string, unknown>) : {}
  const rates = Object.entries(list)
    .map(([code, raw]) => {
      if (!raw || typeof raw !== 'object') return null
      const o = raw as Record<string, unknown>
      return {
        code: code.toUpperCase(),
        title: typeof o.title === 'string' ? o.title : code.toUpperCase(),
        symbol: typeof o.symbol === 'string' ? o.symbol : '',
        rate: typeof o.rate === 'number' ? o.rate : Number(o.rate) || 0,
        formattedRate: typeof o.formattedRate === 'string' ? o.formattedRate : '',
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  return {
    ok: true,
    rates,
    lastUpdate: typeof d.lastUpdate === 'number' ? d.lastUpdate : null,
    visitorCurrency: typeof d.visitorCurrency === 'string' ? d.visitorCurrency : null,
  }
}


const marketMutate = async (
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FetchResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      log.warn(`[market] ${method} ${path} -> ${res.status}`)
      return { ok: false, reason: reasonFromStatus(res.status) }
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

const normalizeItemsPage = (
  d: Record<string, unknown>,
  page: number,
): MarketItemsPage => {
  const items = Array.isArray(d.items) ? (d.items as MarketItem[]) : []
  return {
    items,
    totalItems: typeof d.totalItems === 'number' ? d.totalItems : items.length,
    hasNextPage: Boolean(d.hasNextPage),
    perPage: typeof d.perPage === 'number' ? d.perPage : items.length,
    page: typeof d.page === 'number' ? d.page : page,
  }
}

const listParamsFromQuery = (
  query?: MarketUserItemsQuery,
): Record<string, unknown> => {
  const params: Record<string, unknown> = {}
  if (!query) return params
  if (typeof query.category_id === 'number') params.category_id = query.category_id
  if (query.title) params.title = query.title
  if (typeof query.pmin === 'number') params.pmin = query.pmin
  if (typeof query.pmax === 'number') params.pmax = query.pmax
  if (query.order_by) params.order_by = query.order_by
  if (query.show) params.show = query.show
  if (query.filters) {
    for (const [k, v] of Object.entries(query.filters)) params[k] = v
  }
  return params
}


export const getUserOrders = async (
  page = 1,
  query?: MarketUserItemsQuery,
): Promise<MarketItemsResult> => {
  const params = { page, ...listParamsFromQuery(query) }
  const res = await marketFetch(`/user/orders${buildQuery(params)}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, page: normalizeItemsPage(res.data, page) }
}

export const getFavourites = async (
  page = 1,
  query?: MarketUserItemsQuery,
): Promise<MarketItemsResult> => {
  const params = { page, ...listParamsFromQuery(query) }
  const res = await marketFetch(`/fave${buildQuery(params)}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, page: normalizeItemsPage(res.data, page) }
}


export const getPayments = async (
  query?: MarketPaymentsQuery,
): Promise<MarketPaymentsResult> => {
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
  const params: Record<string, unknown> = {
    page: query?.page,
    type: query?.type,
    pmin: query?.pmin,
    pmax: query?.pmax,
    currency: query?.currency,
    operation_id_lt: query?.operationIdLt,
    startDate: query?.startDate,
    endDate: query?.endDate,
    receiver: query?.receiver,
    sender: query?.sender,
    comment: query?.comment,
    wallet: query?.wallet,
    show_payment_stats: (query?.showPaymentStats ?? true) ? 1 : undefined,
  }
  if (query?.isHold !== undefined) params.is_hold = query.isHold ? 1 : 0
  if (query?.isApi !== undefined) params.is_api = query.isApi ? 1 : 0

  const res = await marketFetch(`/user/payments${buildQuery(params)}`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const d = res.data

  const rawPayments =
    d.payments && typeof d.payments === 'object'
      ? (d.payments as Record<string, unknown>)
      : {}
  const payments: MarketPayment[] = Object.values(rawPayments)
    .map((raw): MarketPayment | null => {
      if (!raw || typeof raw !== 'object') return null
      const o = raw as Record<string, unknown>
      const data =
        o.data && typeof o.data === 'object'
          ? (o.data as MarketPaymentData)
          : {}
      return {
        ...o,
        operation_id: num(o.operation_id),
        operation_date: num(o.operation_date),
        operation_type:
          typeof o.operation_type === 'string' ? o.operation_type : '',
        incoming_sum: num(o.incoming_sum),
        outgoing_sum: num(o.outgoing_sum),
        item_id: typeof o.item_id === 'number' ? o.item_id : null,
        wallet: typeof o.wallet === 'string' ? o.wallet : null,
        is_finished: Boolean(o.is_finished),
        is_hold: Boolean(o.is_hold),
        payment_system:
          typeof o.payment_system === 'string' ? o.payment_system : null,
        hold_end_date:
          typeof o.hold_end_date === 'number' ? o.hold_end_date : null,
        operation_end_date:
          typeof o.operation_end_date === 'number' ? o.operation_end_date : null,
        data,
      }
    })
    .filter((p): p is MarketPayment => p !== null)
    .sort((a, b) => b.operation_date - a.operation_date)

  const stats =
    d.paymentStats && typeof d.paymentStats === 'object'
      ? (d.paymentStats as Record<string, unknown>)
      : null
  const statNum = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const parsed = Number.parseFloat(v.replace(/\s/g, '').replace(',', '.'))
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }
  const incomesSum = stats ? statNum(stats.incomes ?? stats.income) : null
  const outgoingsSum = stats ? statNum(stats.outgoings ?? stats.outgoing) : null
  const totalRaw =
    stats &&
    (stats.total ?? stats.totalSum ?? stats.summary ?? stats.all_time_sum)
  const totalPaymentsSum =
    typeof totalRaw === 'number' ? totalRaw : incomesSum

  const page: MarketPaymentsPage = {
    payments,
    perPage: typeof d.perPage === 'number' ? d.perPage : payments.length,
    page: typeof d.page === 'number' ? d.page : query?.page ?? 1,
    hasNextPage: Boolean(d.hasNextPage),
    lastOperationId:
      typeof d.lastOperationId === 'number' ? d.lastOperationId : null,
    paymentStats: stats,
    periodLabel: typeof d.periodLabel === 'string' ? d.periodLabel : null,
    periodLabelPhrase:
      typeof d.periodLabelPhrase === 'string' ? d.periodLabelPhrase : null,
    incomesSum,
    outgoingsSum,
    totalPaymentsSum,
  }
  return { ok: true, page }
}


const toTag = (raw: unknown): MarketTag | null => {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.tag_id === 'number' ? o.tag_id : Number(o.tag_id)
  if (!Number.isFinite(id)) return null
  return {
    ...o,
    tag_id: id,
    title: typeof o.title === 'string' ? o.title : String(o.title ?? ''),
    background_color:
      typeof o.background_color === 'string'
        ? o.background_color
        : typeof o.bc === 'string'
          ? (o.bc as string)
          : null,
    is_public: Boolean(o.is_public),
  }
}

export const getUserTags = async (): Promise<MarketTagsResult> => {
  const res = await marketFetch('/user/tags')
  if (!res.ok) return { ok: false, reason: res.reason }
  const raw = res.data.tags
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : []
  const tags = list.map(toTag).filter((t): t is MarketTag => t !== null)
  return { ok: true, tags }
}

export const createUserTag = async (
  input: MarketTagInput,
): Promise<MarketTagMutationResult> => {
  const res = await marketMutate('/user/tags', 'POST', {
    title: input.title,
    bc: input.backgroundColor,
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, tag: toTag(res.data.tag) ?? undefined }
}

export const updateUserTag = async (
  tagId: number,
  input: MarketTagInput,
): Promise<MarketTagMutationResult> => {
  const res = await marketMutate('/user/tags', 'PUT', {
    tag_id: tagId,
    title: input.title,
    bc: input.backgroundColor,
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true, tag: toTag(res.data.tag) ?? undefined }
}

export const deleteUserTag = async (
  tagId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate('/user/tags', 'DELETE', { tag_id: tagId })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const reorderUserTags = async (
  tagOrder: number[],
): Promise<MarketSimpleResult> => {
  const res = await marketMutate('/user/tags/order', 'POST', {
    tag_order: tagOrder,
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const addItemTag = async (
  itemId: number,
  tagId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/tag`, 'POST', { tag_id: tagId })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const removeItemTag = async (
  itemId: number,
  tagId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/tag`, 'DELETE', { tag_id: tagId })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const addPublicTag = async (
  itemId: number,
  tagId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/public-tag`, 'POST', {
    tag_id: tagId,
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const removePublicTag = async (
  itemId: number,
  tagId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/public-tag`, 'DELETE', {
    tag_id: tagId,
  })
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}


export const starItem = async (
  itemId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/star`, 'POST')
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export const unstarItem = async (
  itemId: number,
): Promise<MarketSimpleResult> => {
  const res = await marketMutate(`/${itemId}/star`, 'DELETE')
  if (!res.ok) return { ok: false, reason: res.reason }
  return { ok: true }
}

export interface MarketBumpResult {
  ok: boolean
  reason?: MarketErrorReason
  status: string
  errors: string[]
}

export const bumpItem = async (itemId: number): Promise<MarketBumpResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token', status: '', errors: [] }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const res = await appFetch(`${LZT_CONFIG.marketApiUrl}/${itemId}/bump`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const status = typeof data.status === 'string' ? data.status : ''
    const errors = Array.isArray(data.errors)
      ? data.errors.filter((entry): entry is string => typeof entry === 'string')
      : []
    if (status === 'ok') return { ok: true, status, errors }
    if (!res.ok && errors.length === 0) {
      log.warn(`[market] POST /${itemId}/bump -> ${res.status}`)
      return { ok: false, reason: reasonFromStatus(res.status), status, errors }
    }
    return { ok: false, status, errors }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    log.error(`[market] POST /${itemId}/bump failed`, err)
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'network',
      status: '',
      errors: [],
    }
  } finally {
    clearTimeout(timer)
  }
}


export const getTempEmailPassword = async (
  itemId: number,
): Promise<MarketTempEmailPasswordResult> => {
  const res = await marketFetch(`/${itemId}/temp-email-password`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const item =
    res.data.item && typeof res.data.item === 'object'
      ? (res.data.item as Record<string, unknown>)
      : {}
  const password =
    typeof item.password === 'string'
      ? item.password
      : typeof res.data.password === 'string'
        ? (res.data.password as string)
        : ''
  const email =
    typeof item.email === 'string'
      ? item.email
      : typeof item.login === 'string'
        ? (item.login as string)
        : null
  return { ok: true, password, email }
}

export const getItemMafile = async (
  itemId: number,
): Promise<MarketMafileResult> => {
  const res = await marketFetch(`/${itemId}/mafile`)
  if (!res.ok) return { ok: false, reason: res.reason }
  const maFile =
    res.data.maFile && typeof res.data.maFile === 'object'
      ? (res.data.maFile as Record<string, unknown>)
      : {}
  return { ok: true, maFile }
}

export const fetchProxies = async (): Promise<MarketProxyListResult> => {
  const res = await marketFetch('/proxy')
  if (!res.ok) return { ok: false, reason: res.reason }
  const raw = res.data.proxies
  const list = Array.isArray(raw) ? raw : []
  const proxies: MarketProxyEntry[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const holder = entry as Record<string, unknown>
    const source =
      holder.proxy && typeof holder.proxy === 'object'
        ? (holder.proxy as Record<string, unknown>)
        : holder
    const proxyId =
      typeof source.proxy_id === 'number'
        ? source.proxy_id
        : Number(source.proxy_id)
    if (!Number.isFinite(proxyId)) continue
    const portRaw =
      typeof source.proxy_port === 'number'
        ? source.proxy_port
        : Number(source.proxy_port)
    const port = Number.isFinite(portRaw) ? portRaw : 0
    const ip = typeof source.proxy_ip === 'string' ? source.proxy_ip : ''
    const user =
      typeof source.proxy_user === 'string' && source.proxy_user
        ? source.proxy_user
        : undefined
    const label =
      typeof source.proxyString === 'string' && source.proxyString
        ? source.proxyString
        : `${ip}:${port}`
    proxies.push({ proxyId, ip, port, user, label })
  }
  return { ok: true, proxies }
}


export const buildDownloadUrl = async (
  query: MarketDownloadQuery,
): Promise<MarketDownloadResult> => {
  const token = await loadToken()
  if (!token) return { ok: false, reason: 'no_token' }
  const params: Record<string, unknown> = {
    format: query.format ?? 'short',
    custom_format: query.format === 'custom' ? query.customFormat : undefined,
    category_id: query.category_id,
    show: query.show,
    title: query.title,
    oauth_token: token,
  }
  const url = `${LZT_CONFIG.marketApiUrl}/user/${query.type}/download${buildQuery(params)}`
  return { ok: true, url }
}
