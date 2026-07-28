import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, SlidersHorizontal } from 'lucide-react'
import type {
  MarketGame,
  MarketItemsResult,
  MarketSearchParam,
  MarketUserItemsResult,
} from '@lzt/shared'
import { useSession } from '~/stores/session'
import { AccountCard } from '../AccountCard'
import { FilterPanel, type FilterValues } from '../FilterPanel'
import { TagsModal } from '../TagsModal'
import { MARKET_CATEGORIES } from '../categories'
import { useAccountsLoader } from '../useAccountsLoader'
import { getMarketIcon } from '../market-icons'
import styles from '../MarketView.module.scss'
import tabStyles from './AccountsListPage.module.scss'

export type AccountsListMode = 'accounts' | 'orders' | 'favourites'

const RENDER_PAGE_SIZE = 30

const SORT_CHIPS = ['', 'price_to_up', 'price_to_down', 'pdate_to_down', 'pdate_to_up']

const ACCOUNT_SHOW_TABS = ['active', 'paid', 'deleted', 'closed_inactive'] as const

const STATE_ORDER = [
  'stickied',
  'discount_request',
  'in_buyers_favorites',
  'active',
  'paid',
  'closed',
  'deleted',
  'awaiting',
  'pre_active',
  'pre_upload',
  'pending_deletion',
  'closed_inactive',
  'auto_bump',
]

interface ItemStateTab {
  state: string
  title: string
  count: number
}

const parseItemStates = (raw: Record<string, unknown>): ItemStateTab[] => {
  const box = raw['userItemStates']
  if (!box || typeof box !== 'object') return []
  const src = box as Record<string, unknown>
  const out: ItemStateTab[] = []
  for (const state of STATE_ORDER) {
    const entry = src[state]
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    out.push({
      state,
      title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : state,
      count: typeof o.item_count === 'number' ? o.item_count : 0,
    })
  }
  return out
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const SLUG_BY_NORM: Record<string, string> = Object.fromEntries(
  MARKET_CATEGORIES.filter((c) => c.slug).map((c) => [norm(c.label), c.slug]),
)

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export const AccountsListPage = ({ mode }: { mode: AccountsListMode }) => {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const myUserId =
    status && status.authenticated && status.offline === false ? status.profile.userId : 0

  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({})
  const [catSlugMap, setCatSlugMap] = useState<Record<number, string>>({})
  const [allCats, setAllCats] = useState<Array<{ id: number; count: number }>>([])
  const [selectedCat, setSelectedCat] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedMin, setAppliedMin] = useState('')
  const [appliedMax, setAppliedMax] = useState('')
  const [order, setOrder] = useState('')
  const [show, setShow] = useState<string>('active')
  const [stateTabs, setStateTabs] = useState<ItemStateTab[]>([])
  const [tagsOpen, setTagsOpen] = useState(false)
  const [renderCount, setRenderCount] = useState(RENDER_PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const [params, setParams] = useState<MarketSearchParam[]>([])
  const [games, setGames] = useState<MarketGame[]>([])
  const [filterDraft, setFilterDraft] = useState<FilterValues>({})
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({})

  const buildListQuery = useCallback(() => {
    const filters: Record<string, string> = {}
    for (const [k, v] of Object.entries(appliedFilters)) if (v) filters[k] = v
    return {
      category_id: selectedCat ?? undefined,
      title: appliedSearch || undefined,
      pmin: appliedMin ? Number(appliedMin) : undefined,
      pmax: appliedMax ? Number(appliedMax) : undefined,
      order_by: order || undefined,
      show: mode === 'accounts' ? show : undefined,
      filters: Object.keys(filters).length ? filters : undefined,
    }
  }, [selectedCat, appliedSearch, appliedMin, appliedMax, order, show, mode, appliedFilters])

  const fetchPage = useCallback(
    (targetPage: number): Promise<MarketItemsResult | MarketUserItemsResult> => {
      const query = buildListQuery()
      if (mode === 'accounts') {
        return window.moderator.market.getUserItems(myUserId, targetPage, query)
      }
      if (mode === 'orders') {
        return window.moderator.market.getUserOrders(targetPage, query)
      }
      return window.moderator.market.getFavourites(targetPage, query)
    },
    [mode, myUserId, buildListQuery],
  )

  const enabled = !(mode === 'accounts' && !myUserId)
  const { items, status: loadStatus, total, refresh, refreshing } = useAccountsLoader({
    fetchPage,
    deps: [
      mode,
      myUserId,
      appliedSearch,
      appliedMin,
      appliedMax,
      order,
      show,
      JSON.stringify(appliedFilters),
    ],
    enabled,
  })

  useEffect(() => {
    let cancelled = false
    void window.moderator.market.getCategories().then((res) => {
      if (cancelled || !res.ok) return
      const names: Record<number, string> = {}
      const slugs: Record<number, string> = {}
      for (const c of res.categories) {
        if (c.category_name) {
          names[c.category_id] = c.category_name
          const slug = SLUG_BY_NORM[norm(c.category_name)]
          if (slug) slugs[c.category_id] = slug
        }
      }
      setCategoryMap(names)
      setCatSlugMap(slugs)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'accounts' || !myUserId) {
      setStateTabs([])
      return
    }
    let cancelled = false
    void window.moderator.market.getUserItemStates(myUserId).then((res) => {
      if (cancelled || !res.ok) return
      setStateTabs(parseItemStates(res.states))
    })
    return () => {
      cancelled = true
    }
  }, [mode, myUserId])

  useEffect(() => {
    if (selectedCat !== null) return
    const ids = new Map<number, number>()
    for (const it of items) ids.set(it.category_id, (ids.get(it.category_id) ?? 0) + 1)
    setAllCats(
      Array.from(ids.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count),
    )
  }, [items, selectedCat])

  useEffect(() => {
    if (selectedCat === null) {
      setParams([])
      setGames([])
      return
    }
    const slug = catSlugMap[selectedCat]
    if (!slug) {
      setParams([])
      setGames([])
      return
    }
    let cancelled = false
    void Promise.all([
      window.moderator.market.getCategoryParams(slug),
      window.moderator.market.getCategoryGames(slug),
    ]).then(([paramsRes, gamesRes]) => {
      if (cancelled) return
      setParams(paramsRes.ok ? paramsRes.params : [])
      setGames(gamesRes.ok ? gamesRes.games : [])
    })
    return () => {
      cancelled = true
    }
  }, [selectedCat, catSlugMap])

  const selectCat = (id: number | null) => {
    setSelectedCat(id)
    setFilterDraft({})
    setAppliedFilters({})
    setShowFilters(false)
  }

  const applyControls = () => {
    setAppliedSearch(search.trim())
    setAppliedMin(priceMin)
    setAppliedMax(priceMax)
  }
  const onControlsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyControls()
  }

  const changeFilter = (name: string, value: string) =>
    setFilterDraft((prev) => ({ ...prev, [name]: value }))
  const applyFilters = () => setAppliedFilters(filterDraft)
  const resetFilters = () => {
    setFilterDraft({})
    setAppliedFilters({})
  }

  const hasFilterUi = selectedCat !== null && (params.length > 0 || games.length > 0)

  const visibleTabs = useMemo(() => {
    const source: ItemStateTab[] = stateTabs.length
      ? stateTabs
      : ACCOUNT_SHOW_TABS.map((state) => ({
          state,
          title: t(`market.lists.show.${state}`),
          count: 0,
        }))
    return source.filter((tab) => tab.count > 0 || tab.state === show)
  }, [stateTabs, show, t])

  const chips = useMemo(
    () =>
      allCats.map((c) => ({
        ...c,
        slug: catSlugMap[c.id] ?? '',
        name: categoryMap[c.id] ?? '',
      })),
    [allCats, catSlugMap, categoryMap],
  )

  const visibleItems = useMemo(
    () =>
      selectedCat === null
        ? items
        : items.filter((it) => it.category_id === selectedCat),
    [items, selectedCat],
  )

  const pagedItems = useMemo(
    () => visibleItems.slice(0, renderCount),
    [visibleItems, renderCount],
  )
  const canLoadMore = renderCount < visibleItems.length

  useEffect(() => {
    setRenderCount(RENDER_PAGE_SIZE)
  }, [selectedCat, mode, appliedSearch, appliedMin, appliedMax, order, show, appliedFilters])

  useEffect(() => {
    if (!canLoadMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRenderCount((n) => Math.min(visibleItems.length, n + RENDER_PAGE_SIZE))
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [canLoadMore, visibleItems.length])

  const title =
    mode === 'accounts'
      ? t('market.lists.accountsTitle')
      : mode === 'orders'
        ? t('market.lists.purchasesTitle')
        : t('market.lists.favouritesTitle')

  if (mode === 'accounts' && !myUserId) {
    return (
      <div className={styles.sellerPage}>
        <h2 className={styles.sellerRangeTitle}>{title}</h2>
        <div className={styles.state}>
          <p>{t('market.lists.loginRequired')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.sellerPage}>
      {mode === 'accounts' ? (
        <ul className={tabStyles.tabs} role="tablist">
          {visibleTabs.map((tab) => (
            <li key={tab.state} className={tabStyles.tabItem}>
              <button
                type="button"
                role="tab"
                aria-selected={show === tab.state}
                className={
                  show === tab.state
                    ? `${tabStyles.tab} ${tabStyles.tabActive}`
                    : tabStyles.tab
                }
                onClick={() => setShow(tab.state)}
              >
                {tab.title} ·{' '}
                <span className={tabStyles.tabValue}>
                  {new Intl.NumberFormat('ru-RU').format(tab.count)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {chips.length > 0 ? (
        <div className={styles.sellerCatRow}>
          <button
            type="button"
            className={`${styles.sellerCatChip} ${selectedCat === null ? styles.sellerCatChipActive : ''}`}
            onClick={() => selectCat(null)}
          >
            {t('market.all')}
          </button>
          {chips.map((c) => {
            const icon = getMarketIcon(c.slug)
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.sellerCatChip} ${selectedCat === c.id ? styles.sellerCatChipActive : ''}`}
                onClick={() => selectCat(c.id)}
              >
                {icon ? <img className={styles.sellerCatIcon} src={icon} alt="" aria-hidden="true" /> : null}
                {c.name ? cap(c.name) : c.slug ? cap(c.slug) : `#${c.id}`}
                <span className={styles.sellerCatCount}>{c.count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

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
            className={order === value ? `${styles.sortChip} ${styles.sortChipActive}` : styles.sortChip}
            onClick={() => setOrder(value)}
          >
            {value === '' ? t('market.sort.default') : t(`market.sort.${value}`)}
          </button>
        ))}

        {hasFilterUi ? (
          <button type="button" className={styles.filterToggle} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={15} />
            {t('market.filters')}
          </button>
        ) : null}

        {total > 0 ? (
          <span className={styles.count}>
            {t('market.results', {
              count: selectedCat === null ? total : visibleItems.length,
            })}
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
          loading={loadStatus === 'loading'}
        />
      ) : null}

      <div className={styles.listHeadRow}>
        <h2 className={styles.sellerRangeTitle}>{title}</h2>
        <div className={styles.listHeadActions}>
          {loadStatus === 'streaming' || refreshing ? (
            <span className={styles.loadProgress}>
              <Loader2 className={styles.spin} size={14} />
              {t('market.lists.loadingProgress', { loaded: items.length, total })}
            </span>
          ) : null}
        </div>
      </div>

      {loadStatus === 'error' ? (
        <div className={styles.state}>
          <p className={styles.errorText}>{t('market.error.generic')}</p>
          <button type="button" className={styles.retry} onClick={() => refresh()}>
            {t('market.retry')}
          </button>
        </div>
      ) : loadStatus === 'loading' ? (
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
            {pagedItems.map((item) => (
              <AccountCard
                key={item.item_id}
                item={item}
                categorySlug={catSlugMap[item.category_id]}
                context={mode}
                categoryName={categoryMap[item.category_id]}
                onManageTags={() => setTagsOpen(true)}
              />
            ))}
          </div>
          {canLoadMore ? (
            <div ref={sentinelRef} className={styles.state}>
              <Loader2 className={styles.spin} size={16} />
              <p>
                {t('market.lists.loadingProgress', {
                  loaded: pagedItems.length,
                  total: visibleItems.length,
                })}
              </p>
            </div>
          ) : loadStatus === 'streaming' ? (
            <div className={styles.state}>
              <Loader2 className={styles.spin} size={16} />
              <p>{t('market.lists.loadingProgress', { loaded: items.length, total })}</p>
            </div>
          ) : (
            <span className={styles.end}>{t('market.end')}</span>
          )}
        </>
      )}

      <TagsModal open={tagsOpen} onClose={() => setTagsOpen(false)} />
    </div>
  )
}

export default AccountsListPage
