import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  BookOpen,
  Bug,
  ChevronDown,
  Clock,
  Code2,
  CreditCard,
  DollarSign,
  Heart,
  Inbox,
  KeyRound,
  Lightbulb,
  ListOrdered,
  Mail,
  MoreHorizontal,
  Package,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSession } from '~/stores/session'
import { useMarketRoute } from '~/stores/marketRoute'
import type { MarketItem, MarketPayment } from '@lzt/shared'
import { MailToolsModal } from './MailToolsModal'
import { useViewStore } from '~/stores/view'
import { useSettingsRoute } from '~/stores/settingsRoute'
import { useMailTarget } from '~/stores/mailTarget'
import { useForumStore } from '~/features/forum/forum-store'
import { CurrencyModal } from '~/features/profile/CurrencyModal'
import { SiteAccessModal } from './SiteAccessModal'
import { TransferModal } from './TransferModal'
import { TagsModal } from './TagsModal'
import { MARKET_LINKS, marketUserLinks } from './marketLinks'
import { openLztLinkOrExternal } from '~/lib/lztLinks'
import { getForumWebBase } from '@lzt/shared'
import { SellerHeader } from './SellerHeader'
import { AnimatedBalance } from '~/lib/AnimatedBalance'
import styles from './MarketView.module.scss'

const MenuItem = ({
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  trailing?: React.ReactNode
}) => (
  <button type="button" className={styles.sbItem} onClick={onClick}>
    <Icon size={16} className={styles.sbItemIcon} />
    <span className={styles.sbItemLabel}>{label}</span>
    {trailing}
  </button>
)

const formatBalance = (balance: number | null, currency: string | null): string => {
  const code = currency ?? 'RUB'
  const value = balance ?? 0
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value} ${code}`
  }
}

const openForumCreate = (forumId: number, title: string): void => {
  useViewStore.getState().setView('forum')
  useForumStore.getState().selectSection({ type: 'forum', forumId, title })
  useForumStore.getState().openCreate()
}

const openDevApi = (): void => {
  useViewStore.getState().setView('settings')
  setTimeout(() => useSettingsRoute.getState().open('devapi'), 0)
}

const openMailTool = (): void => {
  useViewStore.getState().setView('tools')
  useMailTarget.getState().requestOpen()
}

const fmtMoney = (
  value: number,
  currency: string | null,
  signed = false,
): string => {
  const code = (currency ?? 'rub').toUpperCase()
  const sign = !signed ? '' : value > 0 ? '+' : value < 0 ? '\u2212' : ''
  const abs = Math.abs(value)
  try {
    return `${sign}${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs)} ${code === 'RUB' ? '\u20bd' : code}`
  } catch {
    return `${sign}${abs} ${code}`
  }
}

const fmtOpDate = (unix: number): string => {
  if (!unix) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unix * 1000))
  } catch {
    return ''
  }
}

export const MarketSidebar = () => {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const openPage = useMarketRoute((s) => s.open)
  const seller = useMarketRoute((s) => s.seller)

  const profile =
    status && status.authenticated && status.offline === false ? status.profile : null
  const selected = profile?.currency ?? null

  const [suggested, setSuggested] = useState<string | null>(null)
  const [dismissedPair, setDismissedPair] = useState<string | null>(() =>
    localStorage.getItem('lzt.market.currencyHintDismissed'),
  )
  const [showOther, setShowOther] = useState(false)
  const [siteUrl, setSiteUrl] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [viewedItems, setViewedItems] = useState<MarketItem[]>([])
  const [payments, setPayments] = useState<MarketPayment[]>([])
  const [mailToolsMode, setMailToolsMode] = useState<'letters' | 'guard' | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.moderator.market.getCurrencyRates()
      if (!cancelled && res.ok && res.visitorCurrency) {
        setSuggested(res.visitorCurrency.toUpperCase())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      const [viewed, history] = await Promise.all([
        window.moderator.market.getViewed(1),
        window.moderator.market.getPayments({ showPaymentStats: false }),
      ])
      if (cancelled) return
      if (viewed.ok) setViewedItems(viewed.page.items.slice(0, 5))
      if (history.ok) setPayments(history.page.payments.slice(0, 5))
    })()
    return () => {
      cancelled = true
    }
  }, [profile])

  const pair = selected && suggested ? `${selected}:${suggested}` : ''
  const showCurrency = Boolean(
    selected && suggested && selected !== suggested && pair !== dismissedPair,
  )
  const dismissCurrency = () => {
    if (pair) {
      localStorage.setItem('lzt.market.currencyHintDismissed', pair)
      setDismissedPair(pair)
    }
  }

  const balanceText = formatBalance(profile?.balance ?? null, selected)

  return (
    <aside className={styles.marketSidebar}>
      {seller ? (
        <SellerHeader
          userId={seller.userId}
          username={seller.username}
          usernameHtml={seller.usernameHtml}
          usernameColor={seller.usernameColor}
          variant="sidebar"
          showMessage
        />
      ) : null}

      {showCurrency ? (
        <section className={`${styles.sbCard} ${styles.sbCurrencyCard}`}>
          <div className={styles.sbCardHead}>
            <Wallet size={15} />
            <span>{t('market.sidebar.currency.title')}</span>
          </div>
          <p className={styles.sbNote}>{t('market.sidebar.currency.note')}</p>
          <p className={styles.sbNote}>
            {t('market.sidebar.currency.selected')} — <b>{selected}</b>
          </p>
          <p className={styles.sbNote}>
            {t('market.sidebar.currency.suggested')} — <b>{suggested}</b>
          </p>
          <div className={styles.sbCardActions}>
            <button
              type="button"
              className={styles.sbPrimary}
              onClick={() => setCurrencyOpen(true)}
            >
              {t('market.sidebar.currency.change')}
            </button>
            <button
              type="button"
              className={styles.sbGhostIcon}
              onClick={dismissCurrency}
              title=""
            >
              <X size={16} />
            </button>
          </div>
        </section>
      ) : null}

      <section className={`${styles.sbCard} ${styles.sbBalanceCard}`}>
        <div className={styles.sbBalanceLabel}>{t('market.sidebar.balance.title')}</div>
        <div className={styles.sbBalanceValue}>
          {profile ? (
            <AnimatedBalance value={profile.balance ?? 0} currency={selected ?? 'RUB'} />
          ) : (
            balanceText
          )}
        </div>
        <div className={styles.sbBalanceActions}>
          <button
            type="button"
            className={styles.sbBalanceBtn}
            onClick={() => setSiteUrl(MARKET_LINKS.deposit)}
          >
            <ArrowDownToLine size={16} />
            <span>{t('market.sidebar.balance.topup')}</span>
          </button>
          <button
            type="button"
            className={styles.sbBalanceBtn}
            onClick={() => setSiteUrl(MARKET_LINKS.payout)}
          >
            <ArrowUpFromLine size={16} />
            <span>{t('market.sidebar.balance.withdraw')}</span>
          </button>
          <button
            type="button"
            className={styles.sbBalanceBtn}
            onClick={() => setTransferOpen(true)}
          >
            <ArrowLeftRight size={16} />
            <span>{t('market.sidebar.balance.transfer')}</span>
          </button>
        </div>
      </section>

      <section className={`${styles.sbCard} ${styles.sbNavigationCard}`}>
        <div className={styles.sbMenu}>
          <MenuItem
            icon={User}
            label={t('market.sidebar.menu.myAccounts')}
            onClick={() => openPage('myAccounts')}
          />
          <MenuItem
            icon={ShoppingBag}
            label={t('market.sidebar.menu.myPurchases')}
            onClick={() => openPage('myPurchases')}
          />
          <MenuItem
            icon={ShoppingCart}
            label={t('market.sidebar.menu.cart')}
            onClick={() => openPage('cart')}
          />
          <MenuItem
            icon={ListOrdered}
            label={t('market.sidebar.menu.myOperations')}
            onClick={() => openPage('myOperations')}
          />
          <MenuItem
            icon={Heart}
            label={t('market.sidebar.menu.favorites')}
            onClick={() => openPage('favorites')}
          />
          <MenuItem
            icon={Tag}
            label={t('market.sidebar.menu.tags')}
            onClick={() => setTagsOpen(true)}
          />
          <MenuItem
            icon={CreditCard}
            label={t('market.sidebar.menu.autoBuy')}
            onClick={() => setSiteUrl(MARKET_LINKS.autoBuy)}
          />
          <MenuItem
            icon={MoreHorizontal}
            label={t('market.sidebar.menu.other')}
            onClick={() => setShowOther((v) => !v)}
            trailing={
              <ChevronDown
                size={15}
                className={
                  showOther ? `${styles.sbChevron} ${styles.sbChevronOpen}` : styles.sbChevron
                }
              />
            }
          />
          {showOther ? (
            <div className={styles.sbSub}>
              <MenuItem
                icon={Package}
                label={t('market.sidebar.other.transferred')}
                onClick={() =>
                  profile?.userId
                    ? setSiteUrl(marketUserLinks.transferred(profile.userId))
                    : undefined
                }
              />
              <MenuItem
                icon={ShieldCheck}
                label={t('market.sidebar.other.reviews')}
                onClick={() =>
                  profile?.userId
                    ? setSiteUrl(marketUserLinks.reviews(profile.userId))
                    : undefined
                }
              />
              <MenuItem
                icon={CreditCard}
                label={t('market.sidebar.other.autoPayments')}
                onClick={() => setSiteUrl(MARKET_LINKS.autoPayments)}
              />
              <MenuItem
                icon={Wallet}
                label={t('market.sidebar.other.merchants')}
                onClick={() => setSiteUrl(MARKET_LINKS.merchants)}
              />
              <MenuItem
                icon={TrendingUp}
                label={t('market.sidebar.other.discounts')}
                onClick={() => setSiteUrl(MARKET_LINKS.discounts)}
              />
              <MenuItem
                icon={DollarSign}
                label={t('market.sidebar.other.disputes')}
                onClick={() =>
                  profile?.userId
                    ? setSiteUrl(marketUserLinks.disputes(profile.userId))
                    : undefined
                }
              />
              <MenuItem
                icon={Users}
                label={t('market.sidebar.other.ignoredSellers')}
                onClick={() => setSiteUrl(MARKET_LINKS.ignoredSellers)}
              />
              <MenuItem
                icon={Users}
                label={t('market.sidebar.other.blockedBuyers')}
                onClick={() => setSiteUrl(MARKET_LINKS.blockedBuyers)}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${styles.sbCard} ${styles.sbNavigationCard}`}>
        <div className={styles.sbMenu}>
          <MenuItem
            icon={ShieldCheck}
            label={t('market.sidebar.links.rules')}
            onClick={() => openPage('rules')}
          />
          <MenuItem
            icon={BookOpen}
            label={t('market.sidebar.links.guides')}
            onClick={() => setSiteUrl(MARKET_LINKS.guides)}
          />
          <MenuItem
            icon={Settings}
            label={t('market.sidebar.links.settings')}
            onClick={() => setSiteUrl(MARKET_LINKS.marketSettings)}
          />
          <MenuItem
            icon={DollarSign}
            label={t('market.sidebar.links.rates')}
            onClick={() => openPage('rates')}
          />
          <MenuItem
            icon={Activity}
            label={t('market.sidebar.links.changes')}
            onClick={() => openLztLinkOrExternal(getForumWebBase() + '/threads/1226276/')}
          />
          <MenuItem
            icon={Bug}
            label={t('market.sidebar.links.reportBug')}
            onClick={() => openForumCreate(826, 'Недочеты')}
          />
          <MenuItem
            icon={Lightbulb}
            label={t('market.sidebar.links.suggestIdea')}
            onClick={() => openForumCreate(707, 'Предложения')}
          />
          <MenuItem
            icon={Code2}
            label={t('market.sidebar.links.api')}
            onClick={openDevApi}
          />
          <MenuItem
            icon={Rocket}
            label={t('market.sidebar.links.launcher')}
            onClick={() => openLztLinkOrExternal(getForumWebBase() + '/threads/10024162/')}
          />
          <MenuItem
            icon={Package}
            label={t('market.sidebar.links.steamInventory')}
            onClick={() => setSiteUrl(MARKET_LINKS.steamValue)}
          />
          <MenuItem
            icon={CreditCard}
            label={t('market.sidebar.links.steamTopup')}
            onClick={() => setSiteUrl(MARKET_LINKS.steamTopup)}
          />
          <MenuItem
            icon={Mail}
            label={t('market.sidebar.links.whoseEmail')}
            onClick={() => void window.moderator.app.openExternal(MARKET_LINKS.mailGlass)}
          />
        </div>
      </section>

      <section className={`${styles.sbCard} ${styles.sbActivityCard}`}>
        <div className={styles.sbTitle}>
          <Clock size={14} />
          <span>{t('market.sidebar.recent.title')}</span>
        </div>
        {viewedItems.length === 0 ? (
          <p className={styles.sbEmpty}>{t('market.sidebar.empty')}</p>
        ) : (
          viewedItems.map((item) => (
            <div key={item.item_id} className={styles.sbListEntry}>
              <span className={styles.sbListEntryTitle}>
                {item.title ?? item.title_en ?? ''}
              </span>
              <span className={styles.sbListEntryMeta}>
                {fmtMoney(item.rub_price ?? item.price ?? 0, 'rub')}
                {item.seller?.username ? ` \u00b7 ${item.seller.username}` : ''}
              </span>
            </div>
          ))
        )}
      </section>

      <section className={`${styles.sbCard} ${styles.sbActivityCard}`}>
        <div className={styles.sbTitle}>
          <Activity size={14} />
          <span>{t('market.sidebar.activity.title')}</span>
        </div>
        {payments.length === 0 ? (
          <p className={styles.sbEmpty}>{t('market.sidebar.empty')}</p>
        ) : (
          payments.map((payment) => (
            <div key={payment.operation_id} className={styles.sbListEntry}>
              <span className={styles.sbListEntryTitle}>
                {payment.data.commentPlain ??
                  payment.data.comment ??
                  payment.operation_type}
              </span>
              <span className={styles.sbListEntryMeta}>
                {fmtMoney(
                  payment.incoming_sum > 0
                    ? payment.incoming_sum
                    : -payment.outgoing_sum,
                  null,
                  true,
                )}
                {` \u00b7 ${fmtOpDate(payment.operation_date)}`}
              </span>
            </div>
          ))
        )}
      </section>

      <section className={`${styles.sbCard} ${styles.sbToolCard}`}>
        <div className={styles.sbTitle}>
          <KeyRound size={14} />
          <span>{t('market.sidebar.mailTools.getCode.title')}</span>
        </div>
        <p className={styles.sbNote}>{t('market.sidebar.mailTools.getCode.desc')}</p>
        <button type="button" className={styles.sbWideBtn} onClick={openMailTool}>
          {t('market.sidebar.mailTools.getCode.title')}
        </button>
      </section>

      <section className={`${styles.sbCard} ${styles.sbToolCard}`}>
        <div className={styles.sbTitle}>
          <Inbox size={14} />
          <span>{t('market.sidebar.mailTools.anyMail')}</span>
        </div>
        <button
          type="button"
          className={styles.sbWideBtn}
          onClick={() => setMailToolsMode('letters')}
        >
          {t('market.sidebar.mailTools.anyMail')}
        </button>
      </section>

      <section className={`${styles.sbCard} ${styles.sbToolCard}`}>
        <div className={styles.sbTitle}>
          <Bell size={14} />
          <span>{t('market.sidebar.mailTools.steamGuard')}</span>
        </div>
        <button
          type="button"
          className={styles.sbWideBtn}
          onClick={() => setMailToolsMode('guard')}
        >
          {t('market.sidebar.mailTools.steamGuard')}
        </button>
      </section>

      <MailToolsModal
        open={mailToolsMode !== null}
        mode={mailToolsMode ?? 'letters'}
        onClose={() => setMailToolsMode(null)}
      />
      <SiteAccessModal
        open={siteUrl !== null}
        url={siteUrl ?? ''}
        onClose={() => setSiteUrl(null)}
      />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      <TagsModal open={tagsOpen} onClose={() => setTagsOpen(false)} />
      <CurrencyModal
        open={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        current={selected}
      />
    </aside>
  )
}
