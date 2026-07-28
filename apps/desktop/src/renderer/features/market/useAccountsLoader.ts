import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarketItem, MarketItemsResult, MarketUserItemsResult } from '@lzt/shared'
import { useSettingsStore } from '~/stores/settings'

type PageResult = MarketItemsResult | MarketUserItemsResult
export type FetchAccountsPage = (page: number) => Promise<PageResult>

export type AccountsLoaderStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'error'

export interface AccountsLoaderState {
  items: MarketItem[]
  status: AccountsLoaderStatus
  total: number
  loadedPages: number
  totalPages: number
  refreshing: boolean
  refresh: () => void
}

const clampThreads = (n: number): number => Math.max(1, Math.min(4, Math.floor(n) || 1))
const MAX_PAGES = 500
const DEFAULT_TTL_MS = 15 * 60_000

type DiskCache = { items: MarketItem[]; total: number; fetchedAt?: number }

type CacheEntry = { items: MarketItem[]; total: number; fetchedAt: number }
const accountsCache = new Map<string, CacheEntry>()

const safeKey = (deps: ReadonlyArray<unknown>): string => {
  try {
    return JSON.stringify(deps)
  } catch {
    return Math.random().toString(36)
  }
}

const persistDisk = (key: string, items: MarketItem[], total: number): void => {
  try {
    void window.moderator.market.setCachedAccounts(key, items, total)
  } catch {
  }
}

export function useAccountsLoader(opts: {
  fetchPage: FetchAccountsPage
  deps: ReadonlyArray<unknown>
  enabled?: boolean
}): AccountsLoaderState {
  const { fetchPage, deps, enabled = true } = opts

  const threads = clampThreads(
    useSettingsStore((s) => s.snapshot?.settings.accountLoadConcurrency ?? 2),
  )
  const bgMinutes = useSettingsStore((s) => s.snapshot?.settings.backgroundRefreshMinutes ?? 0)

  const [items, setItems] = useState<MarketItem[]>([])
  const [status, setStatus] = useState<AccountsLoaderStatus>('idle')
  const [total, setTotal] = useState(0)
  const [loadedPages, setLoadedPages] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const seqRef = useRef(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const threadsRef = useRef(threads)
  threadsRef.current = threads
  const ttlRef = useRef(DEFAULT_TTL_MS)
  ttlRef.current = bgMinutes > 0 ? bgMinutes * 60_000 : DEFAULT_TTL_MS
  const busyRef = useRef(false)
  const cacheKeyRef = useRef('')
  cacheKeyRef.current = safeKey(deps)

  const run = useCallback(async (background: boolean): Promise<void> => {
    const seq = ++seqRef.current
    busyRef.current = true
    if (background) {
      setRefreshing(true)
    } else {
      setStatus('loading')
      setItems([])
      setLoadedPages(0)
      setTotalPages(0)
      setTotal(0)
    }

    const key = cacheKeyRef.current
    const writeCache = (arr: MarketItem[], tot: number): void => {
      accountsCache.set(key, { items: arr, total: tot, fetchedAt: Date.now() })
      persistDisk(key, arr, tot)
    }

    const first = await fetchRef.current(1)
    if (seq !== seqRef.current) return
    if (!first.ok) {
      if (!background) setStatus('error')
      setRefreshing(false)
      busyRef.current = false
      return
    }

    const perPage = Math.max(first.page.perPage || first.page.items.length || 1, 1)
    const totalItems = first.page.totalItems || first.page.items.length
    const pages = first.page.hasNextPage
      ? Math.max(1, Math.min(MAX_PAGES, Math.ceil(totalItems / perPage)))
      : 1

    const byId = new Map<number, MarketItem>()
    for (const it of first.page.items) byId.set(it.item_id, it)

    setTotal(totalItems)
    setTotalPages(pages)
    if (!background) {
      setLoadedPages(1)
      setItems([...byId.values()])
      setStatus(pages > 1 ? 'streaming' : 'ready')
    }

    if (pages <= 1) {
      const arr = [...byId.values()]
      if (background) {
        setItems(arr)
        setLoadedPages(1)
      }
      writeCache(arr, totalItems)
      setStatus('ready')
      setRefreshing(false)
      busyRef.current = false
      return
    }

    let nextPage = 2
    const worker = async (): Promise<void> => {
      while (seq === seqRef.current) {
        const p = nextPage++
        if (p > pages) return
        const res = await fetchRef.current(p)
        if (seq !== seqRef.current) return
        if (res.ok) {
          for (const it of res.page.items) if (!byId.has(it.item_id)) byId.set(it.item_id, it)
          if (!background) setItems([...byId.values()])
        }
        if (!background) setLoadedPages((n) => Math.min(pages, n + 1))
      }
    }

    const workerCount = Math.min(threadsRef.current, pages - 1)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    if (seq !== seqRef.current) return

    const arr = [...byId.values()]
    if (background) {
      setItems(arr)
      setLoadedPages(pages)
    }
    writeCache(arr, totalItems)
    setStatus('ready')
    setRefreshing(false)
    busyRef.current = false
  }, [])

  useEffect(() => {
    if (!enabled) {
      seqRef.current++
      busyRef.current = false
      setItems([])
      setStatus('idle')
      return
    }
    const key = cacheKeyRef.current

    const cached = accountsCache.get(key)
    if (cached) {
      seqRef.current++
      busyRef.current = false
      setItems(cached.items)
      setTotal(cached.total)
      setLoadedPages(1)
      setTotalPages(1)
      setStatus('ready')
      const stale = Date.now() - cached.fetchedAt >= ttlRef.current
      if (stale && !busyRef.current) void run(true)
      return () => {
        seqRef.current++
        busyRef.current = false
      }
    }

    const seq = ++seqRef.current
    busyRef.current = false
    let disposed = false
    setStatus('loading')
    const hydrate = async (): Promise<void> => {
      let disk: DiskCache | null = null
      try {
        disk = (await window.moderator.market.getCachedAccounts(key)) as DiskCache | null
      } catch {
        disk = null
      }
      if (disposed || seq !== seqRef.current) return
      if (disk && disk.items.length > 0) {
        const fetchedAt = typeof disk.fetchedAt === 'number' ? disk.fetchedAt : 0
        accountsCache.set(key, { items: disk.items, total: disk.total, fetchedAt })
        setItems(disk.items)
        setTotal(disk.total)
        setLoadedPages(1)
        setTotalPages(1)
        setStatus('ready')
        const stale = Date.now() - fetchedAt >= ttlRef.current
        if (stale && !busyRef.current) void run(true)
      } else {
        void run(false)
      }
    }
    void hydrate()
    return () => {
      disposed = true
      seqRef.current++
      busyRef.current = false
    }
  }, [enabled, run, ...deps])

  useEffect(() => {
    if (!enabled || !bgMinutes || bgMinutes <= 0) return
    const id = window.setInterval(
      () => {
        if (!busyRef.current) void run(true)
      },
      bgMinutes * 60_000,
    )
    return () => window.clearInterval(id)
  }, [enabled, bgMinutes, run, ...deps])

  const refresh = useCallback(() => {
    void run(false)
  }, [run])

  return { items, status, total, loadedPages, totalPages, refreshing, refresh }
}
