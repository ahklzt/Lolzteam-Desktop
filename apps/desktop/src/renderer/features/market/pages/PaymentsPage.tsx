import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Copy,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react'
import type { MarketPayment, MarketPaymentsQuery } from '@lzt/shared'
import { useSession } from '~/stores/session'
import { marketAvatarUrl } from '../user-avatar'
import styles from './MarketPages.module.scss'

type Status = 'loading' | 'loadingMore' | 'error' | 'ready'

const DAY_MS = 86_400_000

const TYPE_TABS = [
  '',
  'income',
  'cost',
  'paid_item',
  'sold_item',
  'withdrawal_balance',
  'refilled_balance',
  'internal_purchase',
  'money_transfer',
  'receiving_money',
  'paid_mail',
  'contest',
  'invoice',
  'balance_exchange',
]

interface FilterForm {
  startDate: string
  endDate: string
  pmin: string
  pmax: string
  receiver: string
  sender: string
  comment: string
  isHold: boolean
  isApi: boolean
}

const EMPTY_FILTERS: FilterForm = {
  startDate: '',
  endDate: '',
  pmin: '',
  pmax: '',
  receiver: '',
  sender: '',
  comment: '',
  isHold: false,
  isApi: false,
}

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const parsed = Number.parseFloat(v)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const formatTime = (unixSeconds: number): string => {
  if (!unixSeconds) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unixSeconds * 1000))
  } catch {
    return String(unixSeconds)
  }
}

const formatFullDate = (unixSeconds: number): string => {
  if (!unixSeconds) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unixSeconds * 1000))
  } catch {
    return String(unixSeconds)
  }
}

const formatDayLabel = (unixSeconds: number): string => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(unixSeconds * 1000))
  } catch {
    return String(unixSeconds)
  }
}

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const formatSum = (value: number, currency: string): string => {
  const code = currency || 'RUB'
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

interface DayGroup {
  key: string
  label: string
  rows: MarketPayment[]
}

const CommentTail = () => (
  <svg className={styles.commentSvg} viewBox="0 0 19 18" focusable="false" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M8 18v-4C8 8 .344.355.344.355.154.159.22.019.5.048.5.048 8.612.593 17 6c1.925 1.24 2 12 2 12H8z"
    />
  </svg>
)

const SAFE_CSS_PROPS = new Set([
  'color',
  'textShadow',
  'background',
  'backgroundImage',
  'backgroundColor',
  'backgroundClip',
  'webkitBackgroundClip',
  'webkitTextFillColor',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'filter',
  'letterSpacing',
])

const parseCssText = (css: unknown): Record<string, string> => {
  if (typeof css !== 'string' || css === '') return {}
  const out: Record<string, string> = {}
  for (const chunk of css.split(';')) {
    const idx = chunk.indexOf(':')
    if (idx <= 0) continue
    const prop = chunk.slice(0, idx).trim()
    const value = chunk.slice(idx + 1).trim()
    if (prop === '' || value === '') continue
    if (/url\s*\(|javascript:|expression\s*\(|[{}]/i.test(value)) continue
    const camel = prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
    if (!SAFE_CSS_PROPS.has(camel)) continue
    out[camel] = value
  }
  return out
}

const UserName = ({ username, css }: { username: string; css?: unknown }) => {
  const style = parseCssText(css)
  return (
    <span
      className={Object.keys(style).length > 0 ? styles.paymentUserStyled : styles.paymentUser}
      style={style}
    >
      {username}
    </span>
  )
}

const DetailRow = ({
  label,
  value,
  copyable,
}: {
  label: string
  value: string
  copyable?: boolean
}) => {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    } catch {
      setDone(false)
    }
  }
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailKey}>{label}</span>
      <span className={styles.detailVal}>
        {value}
        {copyable ? (
          <button
            type="button"
            className={styles.detailCopy}
            onClick={() => void copy()}
            title={label}
          >
            <Copy size={13} />
            {done ? <span className={styles.detailCopied}>✓</span> : null}
          </button>
        ) : null}
      </span>
    </div>
  )
}

export const PaymentsPage = () => {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const currency =
    status && status.authenticated && status.offline === false
      ? status.profile.currency ?? 'RUB'
      : 'RUB'

  const [rows, setRows] = useState<MarketPayment[]>([])
  const [state, setState] = useState<Status>('loading')
  const [hasNext, setHasNext] = useState(false)
  const [lastId, setLastId] = useState<number | null>(null)
  const [incomes, setIncomes] = useState<number | null>(null)
  const [outgoings, setOutgoings] = useState<number | null>(null)
  const [periodPhrase, setPeriodPhrase] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [type, setType] = useState('')
  const [form, setForm] = useState<FilterForm>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<FilterForm>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const requestRef = useRef(0)
  const lastIdRef = useRef<number | null>(null)
  const stateRef = useRef<Status>('loading')
  const hasNextRef = useRef(false)
  const loadRef = useRef<((mode: 'reset' | 'more') => Promise<void>) | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  stateRef.current = state
  hasNextRef.current = hasNext

  const buildQuery = useCallback(
    (f: FilterForm, activeType: string, olderThan: number | null): MarketPaymentsQuery => {
      const q: MarketPaymentsQuery = { showPaymentStats: true }
      if (activeType) q.type = activeType
      if (f.startDate) q.startDate = `${f.startDate}T00:00:00+00:00`
      if (f.endDate) q.endDate = `${f.endDate}T23:59:59+00:00`
      const pmin = Number.parseFloat(f.pmin)
      if (Number.isFinite(pmin)) q.pmin = pmin
      const pmax = Number.parseFloat(f.pmax)
      if (Number.isFinite(pmax)) q.pmax = pmax
      if (f.receiver.trim()) q.receiver = f.receiver.trim()
      if (f.sender.trim()) q.sender = f.sender.trim()
      if (f.comment.trim()) q.comment = f.comment.trim()
      if (f.isHold) q.isHold = true
      if (f.isApi) q.isApi = true
      if (olderThan !== null) q.operationIdLt = olderThan
      return q
    },
    [],
  )

  const load = useCallback(
    async (mode: 'reset' | 'more', nextType?: string, nextForm?: FilterForm) => {
      const activeType = nextType ?? type
      const activeForm = nextForm ?? applied
      if (mode === 'more' && (!hasNextRef.current || stateRef.current === 'loadingMore')) return

      const reqId = ++requestRef.current
      setState(mode === 'reset' ? 'loading' : 'loadingMore')
      stateRef.current = mode === 'reset' ? 'loading' : 'loadingMore'

      const res = await window.moderator.market.getPayments(
        buildQuery(activeForm, activeType, mode === 'more' ? lastIdRef.current : null),
      )
      if (reqId !== requestRef.current) return
      if (!res.ok) {
        setState('error')
        return
      }

      setHasNext(res.page.hasNextPage)
      hasNextRef.current = res.page.hasNextPage
      lastIdRef.current = res.page.lastOperationId
      setLastId(res.page.lastOperationId)

      if (mode === 'reset') {
        setIncomes(res.page.incomesSum)
        setOutgoings(res.page.outgoingsSum)
        setPeriodPhrase(res.page.periodLabelPhrase)
        setRows(res.page.payments)
      } else {
        setRows((prev) => {
          const seen = new Set(prev.map((p) => p.operation_id))
          return [...prev, ...res.page.payments.filter((p) => !seen.has(p.operation_id))]
        })
      }
      setState('ready')
      stateRef.current = 'ready'
    },
    [applied, buildQuery, type],
  )

  useEffect(() => {
    lastIdRef.current = null
    void load('reset')
  }, [])

  loadRef.current = load

  const attachSentinel = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        if (!hasNextRef.current) return
        if (stateRef.current !== 'ready') return
        void loadRef.current?.('more')
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const runFilters = (nextType: string, nextForm: FilterForm) => {
    setType(nextType)
    setApplied(nextForm)
    setRows([])
    setExpanded(null)
    lastIdRef.current = null
    setLastId(null)
    setHasNext(false)
    hasNextRef.current = false
    void load('reset', nextType, nextForm)
  }

  const groups = useMemo<DayGroup[]>(() => {
    const today = startOfDay(new Date())
    const map = new Map<string, DayGroup>()
    for (const row of rows) {
      const date = new Date((row.operation_date || 0) * 1000)
      const day = startOfDay(date)
      const key = String(day)
      let group = map.get(key)
      if (!group) {
        const diff = Math.round((today - day) / DAY_MS)
        const label =
          diff === 0
            ? t('forum.today')
            : diff === 1
              ? t('forum.yesterday')
              : formatDayLabel(row.operation_date)
        group = { key, label, rows: [] }
        map.set(key, group)
      }
      group.rows.push(row)
    }
    return [...map.values()]
  }, [rows, t])

  const hasActiveFilters =
    JSON.stringify(applied) !== JSON.stringify(EMPTY_FILTERS) || type !== ''

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>{t('market.payments.title')}</h2>

      <section className={styles.payHeader}>
        <div className={styles.payHeaderTop}>
          <div className={styles.payHeaderTitles}>
            <span className={styles.payHeaderTitle}>{t('market.payments.statsTitle')}</span>
            {periodPhrase ? (
              <span className={styles.payHeaderPeriod}>{periodPhrase}</span>
            ) : null}
          </div>
          <div className={styles.payTotals}>
            {incomes !== null ? (
              <span className={styles.payTotalIn}>+{formatSum(incomes, currency)}</span>
            ) : null}
            {outgoings !== null ? (
              <span className={styles.payTotalOut}>−{formatSum(outgoings, currency)}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={styles.payFilterToggle}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={15} />
          <span>
            {showFilters ? t('market.payments.hideFilters') : t('market.payments.showFilters')}
          </span>
          <ChevronDown
            size={15}
            className={showFilters ? styles.payChevronOpen : styles.payChevron}
          />
        </button>

        {showFilters ? (
          <div className={styles.payFilters}>
            <div className={styles.payFilterGrid}>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.dateFrom')}</span>
                <input
                  type="date"
                  className={styles.payInput}
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.dateTo')}</span>
                <input
                  type="date"
                  className={styles.payInput}
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.sumFrom')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className={styles.payInput}
                  value={form.pmin}
                  onChange={(e) => setForm({ ...form, pmin: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.sumTo')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className={styles.payInput}
                  value={form.pmax}
                  onChange={(e) => setForm({ ...form, pmax: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.receiver')}</span>
                <input
                  className={styles.payInput}
                  value={form.receiver}
                  onChange={(e) => setForm({ ...form, receiver: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.sender')}</span>
                <input
                  className={styles.payInput}
                  value={form.sender}
                  onChange={(e) => setForm({ ...form, sender: e.target.value })}
                />
              </label>
              <label className={styles.payField}>
                <span className={styles.payFieldLabel}>{t('market.payments.comment')}</span>
                <input
                  className={styles.payInput}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </label>
            </div>

            <div className={styles.payChecks}>
              <label className={styles.payCheck}>
                <input
                  type="checkbox"
                  checked={form.isHold}
                  onChange={(e) => setForm({ ...form, isHold: e.target.checked })}
                />
                <span>{t('market.payments.inHold')}</span>
              </label>
              <label className={styles.payCheck}>
                <input
                  type="checkbox"
                  checked={form.isApi}
                  onChange={(e) => setForm({ ...form, isApi: e.target.checked })}
                />
                <span>{t('market.payments.viaApi')}</span>
              </label>
            </div>

            <div className={styles.payFilterActions}>
              <button
                type="button"
                className={styles.siteBtn}
                onClick={() => runFilters(type, form)}
              >
                {t('market.payments.apply')}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className={styles.payGhostBtn}
                  onClick={() => {
                    setForm(EMPTY_FILTERS)
                    runFilters('', EMPTY_FILTERS)
                  }}
                >
                  {t('market.payments.reset')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.payTabs}>
          {TYPE_TABS.map((tab) => (
            <button
              key={tab || 'all'}
              type="button"
              className={tab === type ? styles.payTabActive : styles.payTab}
              onClick={() => runFilters(tab, applied)}
            >
              {t(`market.payments.types.${tab || 'all'}`)}
            </button>
          ))}
        </div>
      </section>

      {state === 'error' ? (
        <div className={styles.state}>
          <p className={styles.error}>{t('market.payments.error')}</p>
          <button type="button" className={styles.siteBtn} onClick={() => void load('reset')}>
            {t('common.retry')}
          </button>
        </div>
      ) : state === 'loading' ? (
        <div className={styles.state}>
          <Loader2 className={styles.spin} size={24} />
          <p>{t('market.payments.loading')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.state}>
          <p>{t('market.payments.empty')}</p>
        </div>
      ) : (
        <>
          <div className={styles.paymentsContainer}>
            {groups.map((group) => (
              <section key={group.key} className={styles.paymentsBlock}>
                <div className={styles.timestampHeader}>
                  <span className={styles.timestampTitle}>{group.label}</span>
                </div>

                {group.rows.map((p) => {
                  const net = toNum(p.incoming_sum) - toNum(p.outgoing_sum)
                  const positive = net >= 0
                  const username = p.data?.username
                  const userId = p.data?.user_id
                  const comment = p.data?.commentPlain ?? p.data?.comment
                  const avatar =
                    typeof p.data?.avatar === 'string' && p.data.avatar
                      ? p.data.avatar
                      : typeof userId === 'number'
                        ? marketAvatarUrl(userId)
                        : null
                  const typeLabel = p.operation_type
                    ? t(`market.payments.types.${p.operation_type}`, {
                        defaultValue: p.operation_type,
                      })
                    : p.payment_system || ''
                  const isOpen = expanded === p.operation_id
                  const fee = p.data?.fee
                  const paymentId = p.data?.payment_id
                  const invoiceId = p.data?.invoice_id

                  return (
                    <article
                      key={p.operation_id}
                      className={`${styles.paymentItem} ${styles.paymentItemClickable}`}
                      onClick={() => setExpanded(isOpen ? null : p.operation_id)}
                    >
                      <div className={styles.paymentGroup}>
                        <div className={styles.paymentInformation}>
                          <div className={styles.avatarBlock}>
                            {avatar ? (
                              <img
                                className={styles.avatarImg}
                                src={avatar}
                                alt=""
                                loading="lazy"
                              />
                            ) : positive ? (
                              <ArrowDownLeft size={22} className={styles.avatarIconIn} />
                            ) : (
                              <ArrowUpRight size={22} className={styles.avatarIconOut} />
                            )}
                          </div>

                          <div className={styles.detailsBlock}>
                            <div className={styles.paymentTitleBlock}>
                              <div className={styles.paymentTitle}>
                                {typeLabel}
                                {username ? (
                                  <>
                                    {' '}
                                    <UserName
                                      username={username}
                                      css={p.data?.uniq_username_css}
                                    />
                                  </>
                                ) : null}
                              </div>
                              <div className={styles.amountChange}>
                                <span
                                  className={positive ? styles.amountIn : styles.amountOut}
                                  title={
                                    positive
                                      ? t('market.payments.incoming')
                                      : t('market.payments.outgoing')
                                  }
                                >
                                  {positive ? '+' : '−'}
                                  {formatSum(Math.abs(net), currency)}
                                </span>
                              </div>
                            </div>

                            {comment ? (
                              <div className={styles.paymentComment}>
                                <CommentTail />
                                <div className={styles.commentText}>{comment}</div>
                              </div>
                            ) : null}

                            <div className={styles.paymentFooter}>
                              <span className={styles.paymentTime}>
                                {formatTime(p.operation_date)}
                              </span>
                              {p.is_hold ? (
                                <span className={`${styles.payBadge} ${styles.payBadgeHold}`}>
                                  {t('market.payments.hold')}
                                </span>
                              ) : null}
                              {p.data?.is_test ? (
                                <span className={`${styles.payBadge} ${styles.payBadgeTest}`}>
                                  {t('market.payments.test')}
                                </span>
                              ) : null}
                              <span className={styles.payDetailsHint}>
                                {isOpen
                                  ? t('market.payments.detailsHide')
                                  : t('market.payments.details')}
                                <ChevronDown
                                  size={13}
                                  className={isOpen ? styles.payChevronOpen : styles.payChevron}
                                />
                              </span>
                            </div>

                            {isOpen ? (
                              <div
                                className={styles.detailPanel}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DetailRow
                                  label={t('market.payments.f.date')}
                                  value={formatFullDate(p.operation_date)}
                                />
                                <DetailRow
                                  label={t('market.payments.f.operationId')}
                                  value={String(p.operation_id)}
                                  copyable
                                />
                                {paymentId ? (
                                  <DetailRow
                                    label={t('market.payments.f.paymentId')}
                                    value={String(paymentId)}
                                    copyable
                                  />
                                ) : null}
                                {p.payment_system ? (
                                  <DetailRow
                                    label={t('market.payments.f.merchant')}
                                    value={p.payment_system}
                                  />
                                ) : null}
                                {invoiceId ? (
                                  <DetailRow
                                    label={t('market.payments.f.invoiceId')}
                                    value={String(invoiceId)}
                                    copyable
                                  />
                                ) : null}
                                {p.wallet ? (
                                  <DetailRow
                                    label={t('market.payments.f.wallet')}
                                    value={p.wallet}
                                    copyable
                                  />
                                ) : null}
                                {typeof fee === 'number' && fee > 0 ? (
                                  <DetailRow
                                    label={t('market.payments.f.fee')}
                                    value={formatSum(fee, currency)}
                                  />
                                ) : null}
                                {p.item_id ? (
                                  <DetailRow
                                    label={t('market.payments.f.itemId')}
                                    value={String(p.item_id)}
                                    copyable
                                  />
                                ) : null}
                                <DetailRow
                                  label={t('market.payments.f.balanceHold')}
                                  value={`${formatSum(Math.abs(net), currency)} / ${
                                    p.is_hold ? formatSum(Math.abs(net), currency) : formatSum(0, currency)
                                  }`}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            ))}
          </div>

          <div ref={attachSentinel} className={styles.paySentinel}>
            {state === 'loadingMore' ? (
              <span className={styles.payMoreState}>
                <Loader2 className={styles.spin} size={16} />
                {t('market.payments.loadingMore')}
              </span>
            ) : hasNext ? (
              <button
                type="button"
                className={styles.payGhostBtn}
                onClick={() => void load('more')}
              >
                {t('market.payments.loadMore')}
              </button>
            ) : (
              <span className={styles.payMoreState}>{t('market.payments.allLoaded')}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default PaymentsPage
