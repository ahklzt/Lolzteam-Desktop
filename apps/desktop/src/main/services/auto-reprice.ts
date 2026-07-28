import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import {
  AUTOREPRICE_LOG_LIMIT,
  AUTOREPRICE_MAX_LOTS_PER_RUN,
  AUTOREPRICE_MIN_INTERVAL_MINUTES,
  DEFAULT_AUTOREPRICE_RULES,
  DEFAULT_AUTOREPRICE_STATE,
  estimatePrice,
  IPC,
  MARKET_CURRENCIES,
  type AutoRepriceGlobalPatch,
  type AutoRepriceLogEntry,
  type AutoRepriceResult,
  type AutoRepriceRules,
  type AutoRepriceRunSummary,
  type AutoRepriceState,
  type MarketCurrency,
  type MarketItem,
  type PricingCandidate,
} from '@lzt/shared'
import { app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { fetchMePersonal } from './profile-api'
import { getMarketCategories, getMarketItems, getUserItems } from './market-api'
import { editItemPrice } from './market-publish'

const FILE_NAME = 'autoreprice.json'
const stateFile = () => join(app.getPath('userData'), FILE_NAME)
const newId = () => `ar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const OWN_PAGES = 3
const POOL_PAGES = 2
const ESTIMATORS = ['lowest', 'lowerQuartile', 'median', 'weightedMedian']

const norm = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const slugFromUrl = (url: string | undefined): string => {
  if (!url) return ''
  const clean = (url.split('?')[0] ?? '').split('#')[0] ?? ''
  const parts = clean.split('/').filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  return last.includes(':') ? '' : last
}

const tokenize = (value: string | undefined): string[] => {
  if (!value) return []
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => (/^\d+$/.test(token) ? '#' : token))
    .filter((token) => token.length > 0)
}

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const token of a) if (b.has(token)) inter += 1
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

const priceOf = (item: MarketItem): number => {
  const rub = typeof item.rub_price === 'number' ? item.rub_price : null
  const base = typeof item.price === 'number' ? item.price : null
  return rub ?? base ?? 0
}

const sellerIdOf = (item: MarketItem): number | null => {
  const seller = item.seller
  return seller && typeof seller.user_id === 'number' ? seller.user_id : null
}

const toMarketCurrency = (value: string | null | undefined): MarketCurrency => {
  const lower = typeof value === 'string' ? value.toLowerCase() : ''
  return (MARKET_CURRENCIES as readonly string[]).includes(lower)
    ? (lower as MarketCurrency)
    : 'rub'
}

const toConfig = (rules: AutoRepriceRules) => ({
  estimator: rules.estimator,
  priceMultiplier: rules.multiplier,
  discountPercent: rules.discountPercent,
  minSimilarity: Math.min(1, Math.max(0, rules.minSimilarityPercent / 100)),
  priceMin: Math.max(1, Math.floor(rules.priceFloor)),
})

const clampNum = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

const sanitizeRules = (
  base: AutoRepriceRules,
  patch: Partial<AutoRepriceRules>,
): AutoRepriceRules => {
  const estimator =
    typeof patch.estimator === 'string' && ESTIMATORS.includes(patch.estimator)
      ? patch.estimator
      : base.estimator
  return {
    estimator,
    multiplier: clampNum(patch.multiplier ?? base.multiplier, 10, 500, base.multiplier),
    discountPercent: clampNum(
      patch.discountPercent ?? base.discountPercent,
      0,
      90,
      base.discountPercent,
    ),
    minSimilarityPercent: clampNum(
      patch.minSimilarityPercent ?? base.minSimilarityPercent,
      0,
      100,
      base.minSimilarityPercent,
    ),
    minConfidence:
      patch.minConfidence === 'review' || patch.minConfidence === 'ready'
        ? patch.minConfidence
        : base.minConfidence,
    maxChangePercent: clampNum(
      patch.maxChangePercent ?? base.maxChangePercent,
      1,
      100,
      base.maxChangePercent,
    ),
    priceFloor: clampNum(patch.priceFloor ?? base.priceFloor, 1, 1_000_000, base.priceFloor),
    onlyLower: typeof patch.onlyLower === 'boolean' ? patch.onlyLower : base.onlyLower,
  }
}

type LotOutcome = {
  result: AutoRepriceResult
  oldPrice: number | null
  newPrice: number | null
  currency: string | null
  confidence: number | null
  message: string | null
}

class AutoRepriceStore extends EventEmitter {
  private state: AutoRepriceState | null = null
  private timer: NodeJS.Timeout | null = null
  private tickMs = 60_000
  private busy = false

  async load(): Promise<AutoRepriceState> {
    if (this.state) return this.state
    try {
      const raw = await fs.readFile(stateFile(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<AutoRepriceState>
      this.state = {
        ...DEFAULT_AUTOREPRICE_STATE,
        ...parsed,
        rules: sanitizeRules(DEFAULT_AUTOREPRICE_RULES, parsed.rules ?? {}),
        running: false,
        categoryScope: Array.isArray(parsed.categoryScope)
          ? parsed.categoryScope.filter((v): v is number => typeof v === 'number')
          : [],
        log: Array.isArray(parsed.log) ? parsed.log : [],
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT')
        log.warn('[autoreprice] load failed, using defaults', err)
      this.state = {
        ...DEFAULT_AUTOREPRICE_STATE,
        rules: { ...DEFAULT_AUTOREPRICE_RULES },
      }
    }
    return this.state
  }

  private async persist(): Promise<void> {
    if (!this.state) return
    try {
      const tmp = `${stateFile()}.tmp`
      await fs.writeFile(tmp, JSON.stringify(this.state), { mode: 0o600 })
      await fs.rename(tmp, stateFile())
    } catch (err) {
      log.warn('[autoreprice] persist failed', err)
    }
  }

  private async commit(): Promise<AutoRepriceState> {
    await this.persist()
    const payload = this.state as AutoRepriceState
    for (const win of BrowserWindow.getAllWindows())
      if (!win.isDestroyed()) win.webContents.send(IPC.AUTOREPRICE_CHANGED, payload)
    return payload
  }

  private addLog(entry: Omit<AutoRepriceLogEntry, 'id' | 'ts'>): void {
    if (!this.state) return
    const rec: AutoRepriceLogEntry = { id: newId(), ts: Date.now(), ...entry }
    this.state.log = [rec, ...this.state.log].slice(0, AUTOREPRICE_LOG_LIMIT)
  }

  async setGlobal(patch: AutoRepriceGlobalPatch): Promise<AutoRepriceState> {
    const s = await this.load()
    if (typeof patch.enabled === 'boolean') s.enabled = patch.enabled
    if (typeof patch.dryRun === 'boolean') s.dryRun = patch.dryRun
    if (typeof patch.intervalMinutes === 'number' && Number.isFinite(patch.intervalMinutes))
      s.intervalMinutes = Math.max(
        AUTOREPRICE_MIN_INTERVAL_MINUTES,
        Math.floor(patch.intervalMinutes),
      )
    if (Array.isArray(patch.categoryScope))
      s.categoryScope = patch.categoryScope.filter((v): v is number => typeof v === 'number')
    if (patch.rules) s.rules = sanitizeRules(s.rules, patch.rules)
    this.reschedule()
    return this.commit()
  }

  async clearLog(): Promise<AutoRepriceState> {
    const s = await this.load()
    s.log = []
    return this.commit()
  }

  async runNow(): Promise<{ ok: boolean; state?: AutoRepriceState; message?: string }> {
    const s = await this.load()
    if (this.busy) return { ok: false, state: s, message: 'busy' }
    const res = await this.runOnce(s)
    return { ok: res.ok, state: await this.commit(), message: res.message }
  }

  private async loadOwnLots(userId: number, s: AutoRepriceState): Promise<MarketItem[]> {
    const out: MarketItem[] = []
    for (let page = 1; page <= OWN_PAGES; page += 1) {
      const res = await getUserItems(userId, page, { order_by: 'pdate_to_down' })
      if (!res.ok) break
      for (const it of res.page.items) {
        const cat = typeof it.category_id === 'number' ? it.category_id : null
        if (s.categoryScope.length > 0 && (cat === null || !s.categoryScope.includes(cat)))
          continue
        out.push(it)
      }
      if (!res.page.hasNextPage) break
    }
    return out
  }

  private async ensurePool(
    categoryId: number,
    slugByCat: Map<number, string>,
    pools: Map<number, MarketItem[]>,
  ): Promise<MarketItem[]> {
    const cached = pools.get(categoryId)
    if (cached) return cached
    const slug = slugByCat.get(categoryId) ?? ''
    const collected: MarketItem[] = []
    if (slug) {
      for (let page = 1; page <= POOL_PAGES; page += 1) {
        const res = await getMarketItems({ slug, page, order_by: 'price_to_up' })
        if (!res.ok) break
        for (const it of res.page.items) collected.push(it)
        if (!res.page.hasNextPage) break
      }
    }
    pools.set(categoryId, collected)
    return collected
  }

  private async repriceLot(
    lot: MarketItem,
    s: AutoRepriceState,
    slugByCat: Map<number, string>,
    pools: Map<number, MarketItem[]>,
  ): Promise<LotOutcome> {
    const itemId = typeof lot.item_id === 'number' ? lot.item_id : 0
    const categoryId = typeof lot.category_id === 'number' ? lot.category_id : 0
    const currency = typeof lot.price_currency === 'string' ? lot.price_currency : null
    const current = priceOf(lot)
    const base: LotOutcome = {
      result: 'skipped',
      oldPrice: current || null,
      newPrice: null,
      currency,
      confidence: null,
      message: null,
    }
    if (!itemId || !categoryId || current <= 0) return base
    const pool = await this.ensurePool(categoryId, slugByCat, pools)
    if (pool.length === 0)
      return { ...base, result: 'held', message: 'Нет аналогов' }
    const minSim = Math.min(1, Math.max(0, s.rules.minSimilarityPercent / 100))
    const ownTokens = new Set(tokenize(typeof lot.title === 'string' ? lot.title : ''))
    const analogs: PricingCandidate[] = []
    for (const other of pool) {
      const otherId = typeof other.item_id === 'number' ? other.item_id : 0
      if (!otherId || otherId === itemId) continue
      const price = priceOf(other)
      if (price <= 0) continue
      const sim = jaccard(
        ownTokens,
        new Set(tokenize(typeof other.title === 'string' ? other.title : '')),
      )
      if (sim < minSim) continue
      analogs.push({
        itemId: otherId,
        price,
        similarity: sim,
        sellerId: sellerIdOf(other),
        title: typeof other.title === 'string' ? other.title : undefined,
      })
    }
    if (analogs.length === 0)
      return { ...base, result: 'held', message: 'Мало аналогов' }
    const estimate = estimatePrice(
      { itemId, sellerId: sellerIdOf(lot), categoryId },
      analogs,
      toConfig(s.rules),
    )
    const confidence = estimate.confidence
    const proposed = estimate.proposedPrice
    if (proposed === null || estimate.status === 'manual')
      return { ...base, result: 'held', confidence, message: 'Ручная проверка' }
    if (s.rules.minConfidence === 'ready' && estimate.status !== 'ready')
      return { ...base, result: 'held', confidence, message: 'Низкая уверенность' }
    const rounded = Math.max(s.rules.priceFloor, Math.round(proposed))
    if (s.rules.onlyLower && rounded >= current)
      return { ...base, newPrice: rounded, confidence }
    if (rounded === current) return { ...base, newPrice: rounded, confidence }
    const changePercent = current > 0 ? (Math.abs(rounded - current) / current) * 100 : 100
    if (changePercent > s.rules.maxChangePercent)
      return {
        ...base,
        result: 'held',
        newPrice: rounded,
        confidence,
        message: `Δ ${changePercent.toFixed(0)}% > лимита`,
      }
    if (s.dryRun)
      return { ...base, result: 'held', newPrice: rounded, confidence, message: 'Пробный прогон' }
    const res = await editItemPrice({
      itemId,
      price: rounded,
      currency: toMarketCurrency(currency),
    })
    if (!res.ok)
      return {
        ...base,
        result: 'error',
        newPrice: rounded,
        confidence,
        message: res.message ?? res.reason,
      }
    return { result: 'updated', oldPrice: current, newPrice: rounded, currency, confidence, message: null }
  }

  private async runOnce(s: AutoRepriceState): Promise<{ ok: boolean; message?: string }> {
    this.busy = true
    s.running = true
    await this.commit()
    const summary: AutoRepriceRunSummary = {
      at: Date.now(),
      scanned: 0,
      updated: 0,
      held: 0,
      skipped: 0,
      errors: 0,
    }
    try {
      const me = await fetchMePersonal()
      if (!me.ok) {
        this.addLog({
          itemId: 0,
          itemTitle: null,
          result: 'error',
          oldPrice: null,
          newPrice: null,
          currency: null,
          confidence: null,
          message: me.reason === 'no_token' ? 'Нет токена' : 'Профиль недоступен',
        })
        return { ok: false, message: me.reason === 'no_token' ? 'no_token' : 'profile' }
      }
      const userId = me.info.userId
      const catRes = await getMarketCategories()
      const slugByCat = new Map<number, string>()
      if (catRes.ok)
        for (const c of catRes.categories)
          slugByCat.set(c.category_id, slugFromUrl(c.category_url))
      const own = await this.loadOwnLots(userId, s)
      const pools = new Map<number, MarketItem[]>()
      const lots = own.slice(0, AUTOREPRICE_MAX_LOTS_PER_RUN)
      for (const lot of lots) {
        summary.scanned += 1
        const outcome = await this.repriceLot(lot, s, slugByCat, pools)
        switch (outcome.result) {
          case 'updated':
            summary.updated += 1
            break
          case 'held':
            summary.held += 1
            break
          case 'error':
            summary.errors += 1
            break
          default:
            summary.skipped += 1
        }
        if (outcome.result !== 'skipped')
          this.addLog({
            itemId: typeof lot.item_id === 'number' ? lot.item_id : 0,
            itemTitle: typeof lot.title === 'string' ? lot.title : null,
            result: outcome.result,
            oldPrice: outcome.oldPrice,
            newPrice: outcome.newPrice,
            currency: outcome.currency,
            confidence: outcome.confidence,
            message: outcome.message,
          })
      }
      s.lastRunAt = summary.at
      s.lastSummary = summary
      log.info(
        `[autoreprice] run scanned=${summary.scanned} updated=${summary.updated} held=${summary.held} errors=${summary.errors} dryRun=${s.dryRun}`,
      )
      return { ok: true }
    } catch (err) {
      log.warn('[autoreprice] run failed', err)
      return { ok: false, message: 'run_failed' }
    } finally {
      this.busy = false
      s.running = false
    }
  }

  private async tick(): Promise<void> {
    if (this.busy) return
    const s = await this.load()
    if (!s.enabled) return
    const intervalMs =
      Math.max(AUTOREPRICE_MIN_INTERVAL_MINUTES, s.intervalMinutes) * 60_000
    if (s.lastRunAt !== null && Date.now() - s.lastRunAt < intervalMs) return
    await this.runOnce(s)
    await this.commit()
  }

  private reschedule(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), this.tickMs)
  }

  async start(): Promise<void> {
    await this.load()
    this.reschedule()
    log.info('[autoreprice] scheduler started')
  }
}

const store = new AutoRepriceStore()

export const getAutoRepriceState = (): Promise<AutoRepriceState> => store.load()
export const setAutoRepriceGlobal = (patch: AutoRepriceGlobalPatch) => store.setGlobal(patch)
export const runAutoRepriceNow = () => store.runNow()
export const clearAutoRepriceLog = () => store.clearLog()
export const startAutoReprice = () => store.start()
