import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eye,
  Flag,
  Heart,
  Loader2,
  ShoppingCart,
  StickyNote,
  Tag,
  UserPen,
} from 'lucide-react'
import { LZT_CONFIG, type MarketAccountResult, type MarketItem } from '@lzt/shared'
import { useMarketRoute } from '~/stores/marketRoute'
import { useReportPresence } from '~/stores/presence'
import { AccountCard } from '../AccountCard'
import { SellerHeader } from '../SellerHeader'
import { LocalNoteModal } from '../LocalNoteModal'
import { BuyModal } from '../BuyModal'
import { useBodyBackground, useForumUser } from '../market-hooks'
import styles from '../MarketView.module.scss'
import { LiveRelativeTime } from '~/lib/LiveRelativeTime'

type Status = 'loading' | 'error' | 'ready'
type Loaded = Extract<MarketAccountResult, { ok: true }>

const TELEGRAM_CATEGORY_ID = 24

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const formatNumber = (v: number): string => nf.format(v)

const formatDate = (unix: number): string =>
  new Date(unix * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const formatAgo = (unix: number): string => {
  const diff = Date.now() - unix * 1000
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'только что'
  if (s < 60) return `${s} сек. назад`
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} мин. назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч. назад`
  const d = Math.floor(h / 24)
  return `${d} дн. назад`
}

const TRUSTED: Array<{
  id: string
  keys: string[]
  kind: 'text' | 'bool' | 'date' | 'digits' | 'spam'
}> = [
  { id: 'country', keys: ['telegram_country', 'account_country', 'country'], kind: 'text' },
  { id: 'lastActivity', keys: ['telegram_last_seen', 'telegram_last_activity', 'account_last_activity', 'last_seen', 'last_activity'], kind: 'date' },
  { id: 'premium', keys: ['telegram_premium', 'is_premium'], kind: 'bool' },
  { id: 'password', keys: ['telegram_password', 'account_password', 'has_password'], kind: 'bool' },
  { id: 'idDigits', keys: ['telegram_id_digits', 'account_id_digits', 'id_digits', 'telegram_id', 'telegram_user_id'], kind: 'digits' },
  { id: 'spamBlock', keys: ['telegram_spam_block', 'account_spam_block', 'spam_block'], kind: 'spam' },
  { id: 'origin', keys: ['itemOriginPhrase', 'item_origin'], kind: 'text' },
]

export const ItemDetailPage = () => {
  const { t, i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')
  const route = useMarketRoute((s) => s.item)
  const itemId = route?.itemId ?? 0

  const [data, setData] = useState<Loaded | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [similar, setSimilar] = useState<MarketItem[]>([])
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({})
  const [noteOpen, setNoteOpen] = useState(false)
  const [userNoteOpen, setUserNoteOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [inCart, setInCart] = useState(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [cartError, setCartError] = useState(false)

  const load = useCallback(async () => {
    if (!itemId) return
    setStatus('loading')
    const res = await window.moderator.market.getAccount(itemId)
    if (!res.ok) {
      setStatus('error')
      return
    }
    setData(res)
    setStatus('ready')
  }, [itemId])

  useEffect(() => {
    void load()
  }, [load])

  const item: MarketItem | null = data?.item ?? null
  const raw = item as Record<string, unknown> | null
  const seller = item?.seller
  const sellerId = seller?.user_id ?? 0
  const sellerUsername = seller?.username ?? ''

  const { profile } = useForumUser(sellerUsername || null)
  useBodyBackground(profile?.bannerUrl ?? null)

  useEffect(() => {
    if (!sellerId) return
    let alive = true
    void window.moderator.market.getUserItems(sellerId, 1).then((res) => {
      if (!alive || !res.ok) return
      setSimilar(res.page.items.filter((it) => it.item_id !== itemId).slice(0, 5))
    })
    return () => {
      alive = false
    }
  }, [sellerId, itemId])

  useEffect(() => {
    let cancelled = false
    void window.moderator.market.getCategories().then((res) => {
      if (cancelled || !res.ok) return
      const map: Record<number, string> = {}
      for (const c of res.categories) if (c.category_name) map[c.category_id] = c.category_name
      setCategoryMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const title = useMemo(() => {
    if (!item) return ''
    return (isEn ? item.title_en : item.title) || item.title || item.title_en || `#${item.item_id}`
  }, [item, isEn])

  useReportPresence(item ? { kind: 'market_item', name: title } : null)

  const priceMain =
    item && typeof item.rub_price === 'number' && item.rub_price > 0
      ? `${formatNumber(item.rub_price)} ₽`
      : item && typeof item.price === 'number'
        ? `${formatNumber(item.price)} ${(item.price_currency ?? '').toUpperCase()}`.trim()
        : '—'
  const priceAlt =
    item &&
    typeof item.price === 'number' &&
    (item.price_currency ?? 'rub').toLowerCase() !== 'rub'
      ? `≈ ${formatNumber(item.price)} ${(item.price_currency ?? '').toUpperCase()}`.trim()
      : null

  const trustedRows = useMemo(() => {
    if (!raw) return [] as Array<{ id: string; label: string; value: string }>
    const rows: Array<{ id: string; label: string; value: string }> = []
    for (const f of TRUSTED) {
      let val: unknown
      for (const k of f.keys) {
        const v = raw[k]
        if (v !== undefined && v !== null && v !== -1 && v !== '') {
          val = v
          break
        }
      }
      if (val === undefined) continue
      let text = ''
      if (f.kind === 'bool') text = val ? t('market.item.yes') : t('market.item.no')
      else if (f.kind === 'date') text = typeof val === 'number' ? formatDate(val) : String(val)
      else if (f.kind === 'digits') {
        const n = typeof val === 'number' ? val : Number(val)
        text = Number.isFinite(n) && n > 9999 ? String(String(Math.trunc(n)).length) : String(val)
      } else if (f.kind === 'spam') {
        const empty = val === 0 || val === '0' || val === false || val === 'none'
        text = empty ? t('market.item.spamNone') : String(val)
      } else text = String(val)
      rows.push({ id: f.id, label: t(`market.item.trusted.${f.id}`), value: text })
    }
    return rows
  }, [raw, t])

  const description =
    (isEn
      ? ((raw?.descriptionEnPlain as string) ?? (raw?.description_en as string))
      : ((raw?.descriptionPlain as string) ?? (item?.description as string))) ||
    (item?.description as string) ||
    ''

  const isTelegram = item?.category_id === TELEGRAM_CATEGORY_ID
  const hasGuarantee = Boolean(item?.guarantee)

  const openLink = (path: string) => {
    void window.moderator.app.openExternal(`${LZT_CONFIG.marketWebUrl}/${path}`)
  }
  const buyOnSite = () => {
    const url = data?.itemLink || `${LZT_CONFIG.marketWebUrl}/${itemId}`
    void window.moderator.app.openExternal(url)
  }

  const toggleCart = async () => {
    if (!itemId) return
    setCartBusy(true)
    setCartError(false)
    const res = inCart
      ? await window.moderator.market.removeFromCart(itemId)
      : await window.moderator.market.addToCart(itemId)
    setCartBusy(false)
    if (res.ok) setInCart(!inCart)
    else setCartError(true)
  }

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    void (async () => {
      const res = await window.moderator.market.getCart()
      if (cancelled || !res.ok) return
      setInCart(res.page.items.some((it) => it.item_id === itemId))
    })()
    return () => {
      cancelled = true
    }
  }, [itemId])

  if (!itemId) return null
  if (status === 'loading') {
    return (
      <div className={styles.state}>
        <Loader2 className={styles.spin} size={26} />
        <p>{t('market.item.loading')}</p>
      </div>
    )
  }
  if (status === 'error' || !item) {
    return (
      <div className={styles.state}>
        <p className={styles.errorText}>{t('market.item.error')}</p>
        <button type="button" className={styles.retry} onClick={() => void load()}>
          {t('market.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.itemPage}>
      {seller ? (
        <SellerHeader
          userId={seller.user_id}
          username={sellerUsername}
          usernameHtml={seller.username_html ?? null}
          usernameColor={seller.username_color ?? null}
          avatarDate={seller.avatar_date}
          variant="page"
        />
      ) : null}

      <div className={styles.itemTitleRow}>
        <h1 className={styles.itemTitle}>{title}</h1>
        <div className={styles.itemPriceBox}>
          <span className={styles.itemPrice}>{priceMain}</span>
          {priceAlt ? <span className={styles.itemPriceAlt}>{priceAlt}</span> : null}
        </div>
      </div>

      <div className={styles.itemMeta}>
        {typeof item.published_date === 'number' ? (
          <LiveRelativeTime
            unix={item.published_date}
            format={(u) =>
              `${formatDate(u)} (${t('market.item.promoted', { ago: formatAgo(u) })})`
            }
          />
        ) : null}
        {typeof item.view_count === 'number' ? (
          <span className={styles.itemMetaViews}>
            <Eye size={14} />
            {formatNumber(item.view_count)}
          </span>
        ) : null}
      </div>

      <div className={styles.itemActions}>
        <button type="button" className={styles.itemBuyBtn} onClick={() => setBuyOpen(true)}>
          <ShoppingCart size={16} />
          {t('market.item.buy')} · {priceMain}
        </button>
        <button
          type="button"
          className={styles.itemCartBtn}
          disabled={cartBusy}
          onClick={() => void toggleCart()}
        >
          {cartBusy
            ? inCart
              ? t('market.cart.removing')
              : t('market.cart.adding')
            : cartError
              ? t('market.cart.addError')
              : inCart
                ? t('market.cart.remove')
                : t('market.item.cart')}
        </button>
        <button type="button" className={styles.iconBtn} title={t('market.item.favorite')} onClick={buyOnSite}>
          <Heart size={16} />
        </button>
        <button type="button" className={styles.iconBtn} title={t('market.note.open')} onClick={() => setNoteOpen(true)}>
          <StickyNote size={16} />
        </button>
        {data?.canReportItem ? (
          <button type="button" className={styles.iconBtn} title={t('market.item.report')} onClick={() => openLink(`${itemId}/report`)}>
            <Flag size={16} />
          </button>
        ) : null}
        <button type="button" className={styles.iconBtn} title={t('market.item.tags')} onClick={() => openLink(`${itemId}`)}>
          <Tag size={16} />
        </button>
        {seller ? (
          <button type="button" className={styles.iconBtn} title={t('market.userNote.open')} onClick={() => setUserNoteOpen(true)}>
            <UserPen size={16} />
          </button>
        ) : null}
      </div>

      {isTelegram || hasGuarantee ? (
        <section className={styles.itemGuarantee}>
          {isTelegram ? (
            <div className={styles.itemGuaranteeRow}>{t('market.item.guaranteeTData')}</div>
          ) : null}
          {hasGuarantee ? (
            <div className={styles.itemGuaranteeRow}>{t('market.item.guaranteeLifetime')}</div>
          ) : null}
        </section>
      ) : null}

      {trustedRows.length > 0 ? (
        <section className={styles.itemSection}>
          <h2 className={styles.itemSectionTitle}>{t('market.item.trustedTitle')}</h2>
          <div className={styles.itemTrustedGrid}>
            {trustedRows.map((r) => (
              <div key={r.id} className={styles.itemTrustedCell}>
                <div className={styles.itemTrustedValue}>{r.value}</div>
                <div className={styles.itemTrustedLabel}>{r.label}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.itemSection}>
        <h2 className={styles.itemSectionTitle}>{t('market.item.description')}</h2>
        <p className={styles.itemDescription}>{description || t('market.item.noDescription')}</p>
      </section>

      {similar.length > 0 ? (
        <section className={styles.itemSection}>
          <h2 className={styles.itemSectionTitle}>{t('market.item.similar')}</h2>
          <div className={styles.list}>
            {similar.map((it) => (
              <AccountCard key={it.item_id} item={it} categorySlug={categoryMap[it.category_id]} />
            ))}
          </div>
        </section>
      ) : null}

      <LocalNoteModal open={noteOpen} kind="item" id={itemId} onClose={() => setNoteOpen(false)} />
      <BuyModal itemId={itemId} open={buyOpen} onClose={() => setBuyOpen(false)} />
      {seller ? (
        <LocalNoteModal open={userNoteOpen} kind="user" id={seller.user_id} onClose={() => setUserNoteOpen(false)} />
      ) : null}
    </div>
  )
}

export default ItemDetailPage
