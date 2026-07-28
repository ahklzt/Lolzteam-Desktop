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
        <section className={styles.sbCard}>
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

      <section className={styles.sbCard}>
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

      <section className={styles.sbCard}>
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

      <section className={styles.sbCard}>
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
            onClick={() => openLztLinkOrExternal(getForumWebBase() + '/forums/826/')}
          />
          <MenuItem
            icon={Lightbulb}
            label={t('market.sidebar.links.suggestIdea')}
            onClick={() => openLztLinkOrExternal(getForumWebBase() + '/forums/707/')}
          />
          <MenuItem icon={Code2} label={t('market.sidebar.links.api')} />
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

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <Clock size={14} />
          <span>{t('market.sidebar.recent.title')}</span>
        </div>
        <p className={styles.sbEmpty}>{t('market.sidebar.empty')}</p>
      </section>

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <Activity size={14} />
          <span>{t('market.sidebar.activity.title')}</span>
        </div>
        <p className={styles.sbEmpty}>{t('market.sidebar.empty')}</p>
      </section>

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <Users size={14} />
          <span>{t('market.sidebar.online.title', { count: 0 })}</span>
        </div>
        <p className={styles.sbEmpty}>{t('market.sidebar.empty')}</p>
      </section>

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <KeyRound size={14} />
          <span>{t('market.sidebar.mailTools.getCode.title')}</span>
        </div>
        <p className={styles.sbNote}>{t('market.sidebar.mailTools.getCode.desc')}</p>
        <button type="button" className={styles.sbWideBtn}>
          {t('market.sidebar.mailTools.getCode.title')}
        </button>
      </section>

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <Inbox size={14} />
          <span>{t('market.sidebar.mailTools.anyMail')}</span>
        </div>
        <button type="button" className={styles.sbWideBtn}>
          {t('market.sidebar.mailTools.anyMail')}
        </button>
      </section>

      <section className={styles.sbCard}>
        <div className={styles.sbTitle}>
          <Bell size={14} />
          <span>{t('market.sidebar.mailTools.steamGuard')}</span>
        </div>
        <button type="button" className={styles.sbWideBtn}>
          {t('market.sidebar.mailTools.steamGuard')}
        </button>
      </section>

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
