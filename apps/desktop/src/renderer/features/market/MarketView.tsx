import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, LayoutGrid, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import type {
  MarketErrorReason,
  MarketGame,
  MarketItem,
  MarketSearchParam,
} from '@lzt/shared'
import { MARKET_CATEGORIES } from './categories'
import { AccountCard } from './AccountCard'
import { FilterPanel, type FilterValues } from './FilterPanel'
import { MarketSidebar } from './MarketSidebar'
import { useMarketRoute } from '~/stores/marketRoute'
import { useHiddenSellers } from '~/stores/hiddenSellers'
import { useReportPresence } from '~/stores/presence'
import { RulesPage } from './pages/RulesPage'
import { CurrencyRatesPage } from './pages/CurrencyRatesPage'
import { SellerItemsPage } from './pages/SellerItemsPage'
import { AccountsListPage } from './pages/AccountsListPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { CartPage } from './pages/CartPage'
import styles from './MarketView.module.scss'

type Status = 'loading' | 'loadingMore' | 'error' | 'ready'

const SORT_CHIPS = [
  '',
  'price_to_up',
  'price_to_down',
  'pdate_to_down',
  'pdate_to_up',
] as const

export const MarketView = () => {
  const { t } = useTranslation()

  const marketPage = useMarketRoute((s) => s.page)
  const marketSeller = useMarketRoute((s) => s.seller)
  const marketItem = useMarketRoute((s) => s.item)
  const marketBack = useMarketRoute((s) => s.back)
  const hiddenIds = useHiddenSellers((s) => s.ids)

  const [activeSlug, setActiveSlug] = useState('')
  const categoryLabel =
    MARKET_CATEGORIES.find((c) => c.slug === activeSlug)?.label ?? 'Маркет'
  useReportPresence(
    marketItem
      ? null
      : marketSeller
        ? { kind: 'market_seller', name: marketSeller.username }
        : { kind: 'market_category', name: categoryLabel },
  )
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({})
  const [items, setItems] = useState<MarketItem[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [errorReason, setErrorReason] = useState<MarketErrorReason | null>(null)

  const [search, setSearch] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedMin, setAppliedMin] = useState('')
  const [appliedMax, setAppliedMax] = useState('')
  const [order, setOrder] = useState('')

  const [showFilters, setShowFilters] = useState(false)
  const [params, setParams] = useState<MarketSearchParam[]>([])
  const [games, setGames] = useState<MarketGame[]>([])
  const [filterDraft, setFilterDraft] = useState<FilterValues>({})
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({})

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestRef = useRef(0)

  const loadPage = useCallback(
    async (targetPage: number, mode: 'reset' | 'more') => {
      const reqId = ++requestRef.current
      setStatus(mode === 'reset' ? 'loading' : 'loadingMore')
      setErrorReason(null)

      const filters: Record<string, string> = {}
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value) filters[key] = value
      }

      const pmin = Number.parseInt(appliedMin, 10)
      const pmax = Number.parseInt(appliedMax, 10)

      const res = await window.moderator.market.getItems({
        slug: activeSlug,
        page: targetPage,
        title: appliedSearch || undefined,
        pmin: Number.isFinite(pmin) ? pmin : undefined,
        pmax: Number.isFinite(pmax) ? pmax : undefined,
        order_by: order || undefined,
        filters,
      })
      if (reqId !== requestRef.current) return

      if (!res.ok) {
        setStatus('error')
        setErrorReason(res.reason)
        return
      }

      setTotal(res.page.totalItems)
      setHasNext(res.page.hasNextPage)
      setPage(res.page.page || targetPage)
      setItems((prev) => {
        if (mode === 'reset') return res.page.items
        const seen = new Set(prev.map((it) => it.item_id))
        return [...prev, ...res.page.items.filter((it) => !seen.has(it.item_id))]
      })
      setStatus('ready')
    },
    [activeSlug, appliedSearch, appliedMin, appliedMax, order, appliedFilters],
  )

  useEffect(() => {
    void loadPage(1, 'reset')
  }, [loadPage])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.moderator.market.getCategories()
      if (cancelled || !res.ok) return
      const map: Record<number, string> = {}
      for (const c of res.categories) {
        if (c.category_name) map[c.category_id] = c.category_name
      }
      setCategoryMap(map)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeSlug) {
      setParams([])
      setGames([])
      return
    }
    let cancelled = false
    void (async () => {
      const [paramsRes, gamesRes] = await Promise.all([
        window.moderator.market.getCategoryParams(activeSlug),
        window.moderator.market.getCategoryGames(activeSlug),
      ])
      if (cancelled) return
      setParams(paramsRes.ok ? paramsRes.params : [])
      setGames(gamesRes.ok ? gamesRes.games : [])
    })()
    return () => {
      cancelled = true
    }
  }, [activeSlug])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasNext && status === 'ready') {
          void loadPage(page + 1, 'more')
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNext, status, page, loadPage])

  const selectCategory = (slug: string) => {
    if (slug === activeSlug) return
    setActiveSlug(slug)
    setItems([])
    setFilterDraft({})
    setAppliedFilters({})
    setShowFilters(false)
  }

  const applyControls = () => {
    setAppliedSearch(search.trim())
    setAppliedMin(priceMin.trim())
    setAppliedMax(priceMax.trim())
  }
  const onControlsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyControls()
  }

  const applyFilters = () => setAppliedFilters(filterDraft)
  const resetFilters = () => {
    setFilterDraft({})
    setAppliedFilters({})
  }
  const changeFilter = (name: string, value: string) =>
    setFilterDraft((prev) => ({ ...prev, [name]: value }))

  const errorText = useMemo(() => {
    switch (errorReason) {
      case 'no_token':
      case 'unauthorized':
        return t('market.error.noToken')
      case 'rate_limited':
        return t('market.error.rateLimited')
      case 'timeout':
        return t('market.error.timeout')
      default:
        return t('market.error.generic')
    }
  }, [errorReason, t])

  const visibleItems = useMemo(
    () =>
      items.filter((it) => {
        const uid = it.seller?.user_id
        return typeof uid !== 'number' || !hiddenIds.includes(uid)
      }),
    [items, hiddenIds],
  )

  const hasFilterUi = activeSlug !== '' && (params.length > 0 || games.length > 0)

  if (marketPage || marketSeller || marketItem) {
    return (
      <div className={styles.layout}>
        <MarketSidebar />
        <div className={styles.content}>
          <button type="button" className={styles.marketBack} onClick={marketBack}>
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          {marketItem ? (
            <ItemDetailPage />
          ) : marketSeller ? (
            <SellerItemsPage />
          ) : marketPage === 'rules' ? (
            <RulesPage />
          ) : marketPage === 'myAccounts' ? (
            <AccountsListPage mode="accounts" />
          ) : marketPage === 'myPurchases' ? (
            <AccountsListPage mode="orders" />
          ) : marketPage === 'favorites' ? (
            <AccountsListPage mode="favourites" />
          ) : marketPage === 'myOperations' ? (
            <PaymentsPage />
          ) : marketPage === 'cart' ? (
            <CartPage />
          ) : (
            <CurrencyRatesPage />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <MarketSidebar />

      <div className={styles.content}>
        <div className={styles.catGrid}>
          {MARKET_CATEGORIES.map((cat) => {
            const active = cat.slug === activeSlug
            const label = cat.slug === '' ? t('market.all') : cat.label
            return (
              <button
                key={cat.slug || 'all'}
                type="button"
                className={active ? `${styles.catBtn} ${styles.catBtnActive}` : styles.catBtn}
                onClick={() => selectCategory(cat.slug)}
                title={label}
              >
                {cat.iconUrl ? (
                  <img className={styles.catIcon} src={cat.iconUrl} alt="" aria-hidden="true" />
                ) : (
                  <LayoutGrid size={20} />
                )}
              </button>
            )
          })}
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.priceInput}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={onControlsKeyDown}
            inputMode="numeric"
            placeholder={t('market.priceFrom')}
          />
          <input
            className={styles.priceInput}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={onControlsKeyDown}
            inputMode="numeric"
            placeholder={t('market.priceTo')}
          />
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onControlsKeyDown}
              placeholder={t('market.searchPlaceholder')}
              spellCheck={false}
            />
          </div>
        </div>

        <div className={styles.sortRow}>
          {SORT_CHIPS.map((value) => (
            <button
              key={value || 'default'}
              type="button"
              className={
                order === value ? `${styles.sortChip} ${styles.sortChipActive}` : styles.sortChip
              }
              onClick={() => setOrder(value)}
            >
              {value === '' ? t('market.sort.default') : t(`market.sort.${value}`)}
            </button>
          ))}

          {hasFilterUi ? (
            <button
              type="button"
              className={styles.filterToggle}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              {t('market.filters')}
            </button>
          ) : null}

          {total > 0 ? (
            <span className={styles.count}>
              {t('market.results', { count: total })}
            </span>
          ) : null}
        </div>

        {hasFilterUi && showFilters ? (
          <FilterPanel
            params={params}
            games={games}
            values={filterDraft}
            onChange={changeFilter}
            onApply={applyFilters}
            onReset={resetFilters}
            loading={status === 'loading'}
          />
        ) : null}

        {status === 'error' ? (
          <div className={styles.state}>
            <p className={styles.errorText}>{errorText}</p>
            <button
              type="button"
              className={styles.retry}
              onClick={() => void loadPage(1, 'reset')}
            >
              {t('market.retry')}
            </button>
          </div>
        ) : status === 'loading' ? (
          <div className={styles.state}>
            <Loader2 className={styles.spin} size={26} />
            <p>{t('market.loading')}</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className={styles.state}>
            <p>{t('market.empty')}</p>
          </div>
        ) : (
          <>
            <div className={styles.list}>
              {visibleItems.map((item) => (
                <AccountCard
                  key={item.item_id}
                  item={item}
                  categorySlug={categoryMap[item.category_id]}
                  context="catalog"
                  categoryName={categoryMap[item.category_id]}
                />
              ))}
            </div>
            <div ref={sentinelRef} className={styles.sentinel}>
              {status === 'loadingMore' ? (
                <span className={styles.moreLoader}>
                  <Loader2 className={styles.spin} size={18} />
                  {t('market.loadingMore')}
                </span>
              ) : !hasNext ? (
                <span className={styles.end}>{t('market.end')}</span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
