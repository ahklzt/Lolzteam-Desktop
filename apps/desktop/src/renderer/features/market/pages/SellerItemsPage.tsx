import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, SlidersHorizontal } from 'lucide-react'
import type { MarketGame, MarketItem, MarketSearchParam } from '@lzt/shared'
import { useMarketRoute } from '~/stores/marketRoute'
import { AccountCard } from '../AccountCard'
import { FilterPanel, type FilterValues } from '../FilterPanel'
import { MARKET_CATEGORIES } from '../categories'
import { getMarketIcon } from '../market-icons'
import { useBodyBackground, useForumUser } from '../market-hooks'
import { RichUsername } from '../../profile/RichUsername'
import styles from '../MarketView.module.scss'

type Status = 'loading' | 'loadingMore' | 'error' | 'ready'

const SORT_CHIPS = ['', 'price_to_up', 'price_to_down', 'pdate_to_down', 'pdate_to_up']

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const SLUG_BY_NORM: Record<string, string> = Object.fromEntries(
  MARKET_CATEGORIES.filter((c) => c.slug).map((c) => [norm(c.label), c.slug]),
)

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export const SellerItemsPage = () => {
  const { t } = useTranslation()
  const seller = useMarketRoute((s) => s.seller)
  const userId = seller?.userId ?? 0

  const [items, setItems] = useState<MarketItem[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<Status>('loading')

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

  const [showFilters, setShowFilters] = useState(false)
  const [params, setParams] = useState<MarketSearchParam[]>([])
  const [games, setGames] = useState<MarketGame[]>([])
  const [filterDraft, setFilterDraft] = useState<FilterValues>({})
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({})

  const { profile } = useForumUser(seller?.username ?? null)
  useBodyBackground(profile?.bannerUrl ?? null)

  const buildQuery = useCallback(() => {
    const filters: Record<string, string> = {}
    for (const [k, v] of Object.entries(appliedFilters)) if (v) filters[k] = v
    return {
      category_id: selectedCat ?? undefined,
      title: appliedSearch || undefined,
      pmin: appliedMin ? Number(appliedMin) : undefined,
      pmax: appliedMax ? Number(appliedMax) : undefined,
      order_by: order || undefined,
      filters: Object.keys(filters).length ? filters : undefined,
    }
  }, [selectedCat, appliedSearch, appliedMin, appliedMax, order, appliedFilters])

  const requestRef = useRef(0)

  const load = useCallback(
    async (targetPage: number, mode: 'reset' | 'more') => {
      if (!userId) return
      const reqId = ++requestRef.current
      setStatus(mode === 'reset' ? 'loading' : 'loadingMore')
      const res = await window.moderator.market.getUserItems(userId, targetPage, buildQuery())
      if (reqId !== requestRef.current) return
      if (!res.ok) {
        setStatus('error')
        return
      }
      setHasNext(res.page.hasNextPage)
      setTotal(res.page.totalItems)
      setPage(res.page.page || targetPage)
      setItems((prev) => {
        if (mode === 'reset') return res.page.items
        const seen = new Set(prev.map((it) => it.item_id))
        return [...prev, ...res.page.items.filter((it) => !seen.has(it.item_id))]
      })
      setStatus('ready')
    },
    [userId, buildQuery],
  )

  useEffect(() => {
    void load(1, 'reset')
  }, [load])

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

  const chips = useMemo(
    () =>
      allCats.map((c) => ({
        ...c,
        slug: catSlugMap[c.id] ?? '',
        name: categoryMap[c.id] ?? '',
      })),
    [allCats, catSlugMap, categoryMap],
  )

  const sellerTitleTemplate = t('market.seller.listingsTitle', { username: '__SELLER__' })
  const sellerTitleParts = sellerTitleTemplate.split('__SELLER__')
  const sellerTitleBefore = sellerTitleParts[0] ?? sellerTitleTemplate
  const sellerTitleAfter = sellerTitleParts[1] ?? ''

  if (!seller) return null

  return (
    <div className={styles.sellerPage}>
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

      <section className={styles.marketControls}>
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
            <input
              className={styles.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onControlsKeyDown}
              placeholder={t('market.searchPlaceholder')}
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.searchSubmit}
              onClick={applyControls}
              aria-label={t('market.searchPlaceholder')}
            >
              <Search size={17} />
            </button>
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
            <span className={styles.count}>{t('market.results', { count: total })}</span>
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
      </section>

      <h2 className={styles.sellerRangeTitle}>
        <span>{sellerTitleBefore}</span>
        <RichUsername
          html={profile?.usernameHtml ?? null}
          fallback={seller.username}
          color={profile?.usernameColor ?? null}
        />
        <span>{sellerTitleAfter}</span>
      </h2>

      {status === 'error' ? (
        <div className={styles.state}>
          <p className={styles.errorText}>{t('market.error.generic')}</p>
          <button type="button" className={styles.retry} onClick={() => void load(1, 'reset')}>
            {t('market.retry')}
          </button>
        </div>
      ) : status === 'loading' ? (
        <div className={styles.state}>
          <Loader2 className={styles.spin} size={26} />
          <p>{t('market.loading')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          <p>{t('market.empty')}</p>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {items.map((item) => (
              <AccountCard key={item.item_id} item={item} categorySlug={catSlugMap[item.category_id]} />
            ))}
          </div>
          {hasNext ? (
            <button
              type="button"
              className={styles.sellerMore}
              onClick={() => void load(page + 1, 'more')}
              disabled={status === 'loadingMore'}
            >
              {status === 'loadingMore' ? (
                <>
                  <Loader2 className={styles.spin} size={16} />
                  {t('market.loadingMore')}
                </>
              ) : (
                t('market.seller.loadMore')
              )}
            </button>
          ) : (
            <span className={styles.end}>{t('market.end')}</span>
          )}
        </>
      )}
    </div>
  )
}

export default SellerItemsPage
