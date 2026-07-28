import { useEffect, useMemo, useRef, useState } from 'react'
import { LZT_CONFIG, type AccountLoginMethod, type MarketItem } from '@lzt/shared'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Heart,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  Store,
  Tag,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EnrichedUsername } from '../profile/EnrichedUsername'
import { useMarketRoute } from '~/stores/marketRoute'
import { useHiddenSellers } from '~/stores/hiddenSellers'
import { useViewStore } from '~/stores/view'
import { useMailTarget } from '~/stores/mailTarget'
import { pushToast } from '~/stores/toast'
import { useLoginSession } from '~/stores/loginSession'
import { useSettingsStore } from '~/stores/settings'
import { getMarketIcon } from './market-icons'
import {
  emailCredentials,
  loginServiceFor,
  metaChips,
  purchasedAt,
  steamGames,
  userTags,
} from './account-meta'
import { TagPicker } from './TagPicker'
import { PurchaseLoginData } from './PurchaseLoginData'
import styles from './AccountCard.module.scss'

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)

const daysAgo = (unixSeconds: number): number =>
  Math.max(0, Math.floor((Date.now() - unixSeconds * 1000) / 86_400_000))

export type AccountCardContext = 'catalog' | 'accounts' | 'orders' | 'favourites'

interface Props {
  item: MarketItem
  categorySlug?: string
  context?: AccountCardContext
  categoryName?: string
  onManageTags?: () => void
}

export const AccountCard = ({
  item,
  categorySlug,
  context = 'catalog',
  categoryName,
  onManageTags,
}: Props) => {
  const { t, i18n } = useTranslation()
  const isEn = i18n.language.startsWith('en')

  const title =
    (isEn ? item.title_en : item.title) ||
    item.title ||
    item.title_en ||
    `#${item.item_id}`

  const iconUrl = getMarketIcon(categorySlug)

  const priceValue =
    typeof item.rub_price === 'number' && item.rub_price > 0
      ? formatNumber(item.rub_price)
      : typeof item.price === 'number'
        ? formatNumber(item.price)
        : '—'
  const priceIsRub =
    (typeof item.rub_price === 'number' && item.rub_price > 0) ||
    (item.price_currency ?? '').toLowerCase() === 'rub'
  const priceCurrency =
    !priceIsRub && typeof item.price === 'number'
      ? (item.price_currency ?? '').toUpperCase()
      : ''

  const published =
    typeof item.published_date === 'number' ? daysAgo(item.published_date) : null
  const timeAgo =
    published === null
      ? null
      : published === 0
        ? t('market.justNow')
        : `${published} ${t('market.daysShort')}`

  const seller = item.seller
  const sold = seller?.sold_items_count

  const isPurchased =
    context === 'orders' ||
    (context === 'favourites' &&
      (item['canViewLoginData'] === true || item.item_state === 'paid'))

  const service = loginServiceFor(categorySlug, categoryName, item.category_id)
  const canLogin = isPurchased && service !== null

  const chips = useMemo(() => metaChips(item), [item])
  const shownChips = isPurchased ? chips : chips.slice(0, 6)
  const games = useMemo(
    () => (isPurchased && service === 'steam' ? steamGames(item) : []),
    [isPurchased, service, item],
  )
  const boughtAt = isPurchased ? purchasedAt(item) : null
  const boughtLabel =
    boughtAt !== null
      ? new Intl.DateTimeFormat(isEn ? 'en' : 'ru-RU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date(boughtAt * 1000))
      : null

  const openItemPage = useMarketRoute((s) => s.openItem)
  const openItem = () => openItemPage(item.item_id)

  const openSeller = useMarketRoute((s) => s.openSeller)
  const hideSeller = useHiddenSellers((s) => s.hide)
  const setView = useViewStore((s) => s.setView)
  const setMailPending = useMailTarget((s) => s.setPending)
  const startLogin = useLoginSession((s) => s.start)
  const failLogin = useLoginSession((s) => s.fail)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const sellerId = seller?.user_id
  const sellerName = seller?.username ?? ''

  const [tagOpen, setTagOpen] = useState(false)
  const [starred, setStarred] = useState(context === 'favourites')
  const [starBusy, setStarBusy] = useState(false)
  const [checkTagIds, setCheckTagIds] = useState<number[]>([])

  const labels = useMemo(() => userTags(item), [item])
  const appliedTagIds = useMemo(
    () => Array.from(new Set([...labels.map((l) => l.id), ...checkTagIds])),
    [labels, checkTagIds],
  )

  const [loginNonce, setLoginNonce] = useState(0)

  const [checkBusy, setCheckBusy] = useState(false)
  const [checkResult, setCheckResult] = useState<{ valid: boolean; message?: string } | null>(
    null,
  )

  const toggleStar = async () => {
    if (starBusy) return
    setStarBusy(true)
    const res = starred
      ? await window.moderator.market.unstarItem(item.item_id)
      : await window.moderator.market.starItem(item.item_id)
    setStarBusy(false)
    if (res.ok) setStarred((v) => !v)
  }

  const viewSellerItems = () => {
    setMenuOpen(false)
    if (typeof sellerId !== 'number') return
    openSeller({
      userId: sellerId,
      username: sellerName,
      usernameHtml: seller?.username_html ?? null,
      usernameColor: seller?.username_color ?? null,
    })
  }

  const hideSellerItems = () => {
    setMenuOpen(false)
    if (typeof sellerId === 'number') hideSeller(sellerId)
  }

  const reportItem = () => {
    setMenuOpen(false)
    void window.moderator.app.openExternal(
      `${LZT_CONFIG.marketWebUrl}/${item.item_id}/report`,
    )
  }

  const openOnMarket = () => {
    setMenuOpen(false)
    void window.moderator.app.openExternal(`${LZT_CONFIG.marketWebUrl}/${item.item_id}/`)
  }

  const openEmail = async () => {
    setMenuOpen(false)
    let creds = emailCredentials(item)
    if (!creds) {
      const res = await window.moderator.market.getAccount(item.item_id)
      if (res.ok) creds = emailCredentials(res.item)
    }
    if (!creds) {
      pushToast({ kind: 'error', title: t('market.card.menu.email'), message: t('market.email.noData') })
      return
    }
    setMailPending(creds)
    setView('tools')
  }

  const checkValidity = async () => {
    setMenuOpen(false)
    if (checkBusy) return
    setCheckBusy(true)
    const res = await window.moderator.market.checkAccount(item.item_id)
    setCheckBusy(false)
    if (!res.ok) {
      pushToast({ kind: 'error', title: t('market.card.menu.check'), message: t('market.check.failed') })
      return
    }
    setCheckResult({ valid: res.valid, message: res.message })
    if (res.tagIds.length) setCheckTagIds(res.tagIds)
    pushToast({
      kind: res.valid ? 'success' : 'error',
      title: t('market.card.menu.check'),
      message: res.valid ? t('market.check.valid') : t('market.check.invalid'),
    })
  }

  const openLabels = () => {
    setMenuOpen(false)
    setTagOpen(true)
  }

  const handleLogin = async () => {
    if (!service) return
    const pref = useSettingsStore.getState().snapshot?.settings.preferredLoginMethod ?? 'ask'
    const method: AccountLoginMethod = pref === 'browser' ? 'web' : 'native'
    startLogin(item.item_id, title, service)
    const res = await window.moderator.account.login(item.item_id, method)
    if (!res.ok) failLogin(res.message)
  }

  return (
    <article className={styles.item}>
      <div className={styles.rightCol}>
        <span className={styles.price}>
          <span className={styles.value}>{priceValue}</span>
          {priceIsRub ? (
            <span className={styles.rub} aria-hidden="true" />
          ) : priceCurrency ? (
            <span className={styles.value}>{priceCurrency}</span>
          ) : null}
        </span>
      </div>

      <div className={styles.topContainer}>
        {iconUrl ? (
          <img className={styles.categoryIcon} src={iconUrl} alt="" aria-hidden="true" />
        ) : null}
        <span className={styles.title}>{title}</span>
        {item.item_state === 'paid' ? (
          <span className={styles.helpfulIcons} title={t('market.card.sold')}>
            <CheckCircle2 size={20} />
          </span>
        ) : null}
      </div>

      {shownChips.length > 0 || (!isPurchased && Boolean(item.guarantee)) ? (
        <div className={styles.stats}>
          {!isPurchased && Boolean(item.guarantee) ? (
            <span className={`${styles.stat} ${styles.statGreen}`}>
              <ShieldCheck size={13} />
              {t('market.guarantee')}
            </span>
          ) : null}
          {shownChips.map((chip) => (
            <span
              key={chip.id}
              className={
                chip.tone === 'green'
                  ? `${styles.stat} ${styles.statGreen}`
                  : chip.tone === 'red'
                    ? `${styles.stat} ${styles.statRed}`
                    : styles.stat
              }
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {item.itemOriginPhrase ? (
        <div className={styles.badges}>
          <span className={styles.badge}>{item.itemOriginPhrase}</span>
        </div>
      ) : null}

      {games.length > 0 ? (
        <div className={styles.gameRow}>
          {games.map((g) => (
            <span
              key={g.appId}
              className={styles.gameChip}
              title={`${g.title} — ${g.hours} ${t('market.hoursShort')}`}
            >
              <img
                className={styles.gameIcon}
                src={g.iconUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              <span className={styles.gameName}>{g.title}</span>
              {g.hours > 0 ? (
                <span className={styles.gameHours}>
                  {g.hours} {t('market.hoursShort')}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.otherInfo}>
        <div className={styles.inlineGroup}>
          <span className={styles.inlineInfo}>
            {seller?.username ? (
              <EnrichedUsername
                className={styles.username}
                username={seller.username}
                html={seller.username_html ?? null}
                color={seller.username_color ?? null}
              />
            ) : null}
            {typeof sold === 'number' ? (
              <span className={styles.ratingBox} title={t('market.card.soldCount')}>
                <span className={styles.ratingReviews}>{formatNumber(sold)}</span>
              </span>
            ) : null}
            {timeAgo ? (
              <>
                <span className={styles.separator} />
                <span className={styles.muted}>{timeAgo}</span>
              </>
            ) : null}
            {boughtLabel ? (
              <>
                <span className={styles.separator} />
                <span className={styles.muted}>{t('market.card.purchasedAt', { date: boughtLabel })}</span>
              </>
            ) : null}
            {typeof item.view_count === 'number' ? (
              <>
                <span className={styles.separator} />
                <span className={styles.muted}>
                  <Eye size={13} />
                  {formatNumber(item.view_count)}
                </span>
              </>
            ) : null}
            {checkResult ? (
              <>
                <span className={styles.separator} />
                <span className={checkResult.valid ? styles.checkOk : styles.checkBad}>
                  {checkResult.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {checkResult.valid ? t('market.check.valid') : t('market.check.invalid')}
                </span>
              </>
            ) : null}
          </span>

          <span className={styles.inlineButtons}>
            <div className={styles.menuRoot} ref={menuRef}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonIcon}`}
                title={t('market.card.more')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen ? (
                <div className={styles.cardMenu} role="menu">
                  {isPurchased ? (
                    <>
                      <button type="button" className={styles.cardMenuItem} onClick={() => void openEmail()}>
                        <Mail size={15} />
                        {t('market.card.menu.email')}
                      </button>
                      <button
                        type="button"
                        className={styles.cardMenuItem}
                        onClick={() => void checkValidity()}
                        disabled={checkBusy}
                      >
                        {checkBusy ? <Loader2 size={15} className={styles.spin} /> : <ShieldCheck size={15} />}
                        {t('market.card.menu.check')}
                      </button>
                      <button type="button" className={styles.cardMenuItem} onClick={openLabels}>
                        <Tag size={15} />
                        {t('market.card.menu.labels')}
                      </button>
                      <button type="button" className={styles.cardMenuItem} onClick={openOnMarket}>
                        <Store size={15} />
                        {t('market.card.menu.openMarket')}
                      </button>
                      <button
                        type="button"
                        className={styles.cardMenuItem}
                        onClick={() => {
                          setMenuOpen(false)
                          setLoginNonce((n) => n + 1)
                        }}
                      >
                        <KeyRound size={15} />
                        {t('market.card.menu.loginData')}
                      </button>
                    </>
                  ) : null}
                  {typeof sellerId === 'number' ? (
                    <button type="button" className={styles.cardMenuItem} onClick={viewSellerItems}>
                      <Store size={15} />
                      {t('market.card.menu.viewSeller', { username: sellerName })}
                    </button>
                  ) : null}
                  {typeof sellerId === 'number' && !isPurchased ? (
                    <button type="button" className={styles.cardMenuItem} onClick={hideSellerItems}>
                      <EyeOff size={15} />
                      {t('market.card.menu.hideSeller')}
                    </button>
                  ) : null}
                  <button type="button" className={styles.cardMenuItem} onClick={reportItem}>
                    <Flag size={15} />
                    {t('market.card.menu.report')}
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`${styles.menuRoot} ${styles.tagsWrapper}`}>
              <button
                type="button"
                className={styles.itemTags}
                title={t('market.card.tag')}
                aria-haspopup="menu"
                aria-expanded={tagOpen}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setTagOpen((v) => !v)}
              >
                {labels.length > 0 ? (
                  labels.map((label) => (
                    <span
                      key={label.id}
                      className={styles.tag}
                      style={label.color ? { background: label.color } : undefined}
                    >
                      {label.title}
                    </span>
                  ))
                ) : (
                  <span className={styles.setTag}>{t('market.card.tag')}</span>
                )}
              </button>
              {tagOpen ? (
                <TagPicker
                  itemId={item.item_id}
                  appliedTagIds={appliedTagIds}
                  onClose={() => setTagOpen(false)}
                  onManage={onManageTags}
                />
              ) : null}
            </div>

            <button
              type="button"
              className={
                starred
                  ? `${styles.button} ${styles.buttonIcon} ${styles.buttonActive}`
                  : `${styles.button} ${styles.buttonIcon}`
              }
              title={starred ? t('market.card.favorited') : t('market.card.favorite')}
              disabled={starBusy}
              onClick={() => void toggleStar()}
            >
              <Heart size={16} fill={starred ? 'currentColor' : 'none'} />
            </button>

            {canLogin ? (
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => void handleLogin()}
              >
                <LogIn size={15} />
                {t('market.card.login')}
              </button>
            ) : context === 'catalog' ? (
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={openItem}
              >
                {t('market.card.buy')}
              </button>
            ) : null}
          </span>
        </div>

        {isPurchased ? (
          <PurchaseLoginData
            item={item}
            categoryName={categoryName}
            categorySlug={categorySlug}
            openSignal={loginNonce}
          />
        ) : null}
      </div>

      <button
        type="button"
        className={styles.linkClicker}
        aria-label={title}
        onClick={openItem}
      />
    </article>
  )
}
