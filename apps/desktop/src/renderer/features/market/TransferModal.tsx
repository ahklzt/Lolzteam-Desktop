import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { MARKET_CURRENCIES, type MarketCurrency } from '@lzt/shared'
import { Modal } from '~/widgets/Modal/Modal'
import { Dropdown } from '~/widgets/Dropdown/Dropdown'
import { Toggle } from '~/widgets/Toggle/Toggle'
import { useSession } from '~/stores/session'
import { MARKET_LINKS } from './marketLinks'
import styles from './TransferModal.module.scss'

interface TransferModalProps {
  open: boolean
  onClose: () => void
}

const HOLD_DAYS = [1, 3, 7, 14, 30, 60, 90]

const ERR: Record<string, string> = {
  invalid_secret: 'invalidSecret',
  user_not_found: 'userNotFound',
  unauthorized: 'auth',
  no_token: 'auth',
  rate_limited: 'rateLimited',
  timeout: 'timeout',
  network: 'timeout',
  bad_request: 'generic',
  bad_response: 'generic',
  unknown: 'generic',
}

export const TransferModal = ({ open, onClose }: TransferModalProps) => {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const profile =
    status && status.authenticated && status.offline === false ? status.profile : null
  const mainCurrency = (profile?.currency ?? 'RUB') as string

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<MarketCurrency>('rub')
  const [comment, setComment] = useState('')
  const [tgDeal, setTgDeal] = useState(false)
  const [tgUser, setTgUser] = useState('')
  const [hold, setHold] = useState(false)
  const [holdDays, setHoldDays] = useState(3)
  const [secret, setSecret] = useState('')
  const [feePercent, setFeePercent] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setDone(false)
      setSubmitting(false)
    }
  }, [open])

  const amountNum = useMemo(() => Number(amount.replace(',', '.')), [amount])

  useEffect(() => {
    if (!open || !Number.isFinite(amountNum) || amountNum <= 0) {
      setFeePercent(null)
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      const res = await window.moderator.market.getTransferFee(amountNum)
      if (!cancelled && res.ok) setFeePercent(res.fee.commissionPercentage)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [open, amountNum])

  const submit = async () => {
    setError(null)
    if (!recipient.trim()) return setError(t('market.transfer.errors.noUser'))
    if (!Number.isFinite(amountNum) || amountNum <= 0)
      return setError(t('market.transfer.errors.badAmount'))
    if (!secret.trim()) return setError(t('market.transfer.errors.noSecret'))
    setSubmitting(true)
    const res = await window.moderator.market.transfer({
      username: recipient.trim(),
      amount: amountNum,
      currency,
      comment: comment.trim() || undefined,
      telegramDeal: tgDeal || undefined,
      telegramUsername: tgDeal ? tgUser.trim() || undefined : undefined,
      transferHold: hold || undefined,
      holdLengthValue: hold ? holdDays : undefined,
      holdLengthOption: hold ? 'day' : undefined,
      secretAnswer: secret.trim(),
    })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
      return
    }
    setError(t('market.transfer.errors.' + (ERR[res.reason] ?? 'generic')))
  }

  return (
    <Modal title={t('market.transfer.title')} open={open} onClose={onClose}>
      {done ? (
        <p className={styles.done}>{t('market.transfer.success')}</p>
      ) : (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>{t('market.transfer.recipient')}</label>
            <input
              className={styles.input}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t('market.transfer.recipientPh')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('market.transfer.balance')}</label>
            <div className={styles.staticValue}>{t('market.transfer.balanceMain', { currency: mainCurrency })}</div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>{t('market.transfer.amount')}</label>
              <input
                className={styles.input}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className={styles.fieldNarrow}>
              <label className={styles.label}>&nbsp;</label>
              <Dropdown
                value={currency}
                onChange={(v) => setCurrency(v)}
                options={MARKET_CURRENCIES.map((c) => ({
                  value: c,
                  label: c.toUpperCase(),
                }))}
              />
            </div>
          </div>
          <p className={styles.fee}>{t('market.transfer.fee', { percent: feePercent ?? 0 })}</p>
          <div className={styles.field}>
            <label className={styles.label}>{t('market.transfer.comment')}</label>
            <input
              className={styles.input}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('market.transfer.commentPh')}
            />
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.label}>{t('market.transfer.tgQuestion')}</span>
            <div className={styles.toggle}>
              <button type="button" className={!tgDeal ? styles.toggleActive : ''} onClick={() => setTgDeal(false)}>{t('market.transfer.no')}</button>
              <button type="button" className={tgDeal ? styles.toggleActive : ''} onClick={() => setTgDeal(true)}>{t('market.transfer.yes')}</button>
            </div>
          </div>
          {tgDeal && (
            <div className={styles.field}>
              <input
                className={styles.input}
                value={tgUser}
                onChange={(e) => setTgUser(e.target.value)}
                placeholder={t('market.transfer.tgPh')}
              />
            </div>
          )}
          <div className={styles.checkRow}>
            <Toggle
              checked={hold}
              onChange={setHold}
              label={t('market.transfer.hold')}
            />
            {hold && (
              <Dropdown
                value={holdDays}
                onChange={(v) => setHoldDays(v)}
                options={HOLD_DAYS.map((d) => ({
                  value: d,
                  label: t('market.transfer.days', { days: d }),
                }))}
              />
            )}
          </div>
          {hold ? (
            <p className={styles.hintWarn}>{t('market.transfer.holdOn')}</p>
          ) : (
            <p className={styles.hintOk}>{t('market.transfer.holdOff')}</p>
          )}
          <div className={styles.field}>
            <label className={styles.label}>{t('market.transfer.secret')}</label>
            <input
              className={styles.input}
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t('market.transfer.secretPh')}
            />
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => void window.moderator.app.openExternal(MARKET_LINKS.secretSettings)}
            >
              {t('market.transfer.forgot')}
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="button" className={styles.primary} onClick={submit} disabled={submitting}>
            {submitting && <Loader2 size={16} className={styles.spin} />}
            {t('market.transfer.submit')}
          </button>
        </div>
      )}
    </Modal>
  )
}
