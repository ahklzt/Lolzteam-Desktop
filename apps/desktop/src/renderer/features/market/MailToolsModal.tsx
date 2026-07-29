import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { MarketMailLetter } from '@lzt/shared'
import { Modal } from '~/widgets/Modal/Modal'
import styles from './TransferModal.module.scss'

interface MailToolsModalProps {
  open: boolean
  mode: 'letters' | 'guard'
  onClose: () => void
}

const ERR: Record<string, string> = {
  no_token: 'noToken',
  unauthorized: 'noToken',
  rate_limited: 'rateLimited',
  timeout: 'timeout',
  network: 'timeout',
  bad_response: 'generic',
}

const fmtLetterDate = (unix: number, locale: string): string => {
  if (!unix) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unix * 1000))
  } catch {
    return ''
  }
}

export const MailToolsModal = ({ open, mode, onClose }: MailToolsModalProps) => {
  const { t, i18n } = useTranslation()
  const [pair, setPair] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [itemId, setItemId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [letters, setLetters] = useState<MarketMailLetter[]>([])
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(false)
    setLetters([])
    setCode(null)
  }, [open])

  const loadLetters = async (): Promise<void> => {
    const combined = pair.trim()
    const addr = email.trim()
    if (!combined && !addr) {
      setError(t('market.error.generic'))
      return
    }
    setLoading(true)
    setError(null)
    const res = combined
      ? await window.moderator.market.getLetters(combined)
      : await window.moderator.market.getLetters(addr, password)
    setLoading(false)
    if (!res.ok) {
      setError(t('market.error.' + (ERR[res.reason] ?? 'generic')))
      return
    }
    setLetters(res.letters)
  }

  const loadGuardCode = async (): Promise<void> => {
    const id = Number.parseInt(itemId.trim(), 10)
    if (!Number.isFinite(id) || id <= 0) {
      setError(t('market.error.generic'))
      return
    }
    setLoading(true)
    setError(null)
    const res = await window.moderator.market.getGuardCode(id)
    setLoading(false)
    if (!res.ok) {
      setError(t('market.error.' + (ERR[res.reason] ?? 'generic')))
      return
    }
    setCode(res.code)
  }

  const title =
    mode === 'letters'
      ? t('market.sidebar.mailTools.anyMail')
      : t('market.sidebar.mailTools.steamGuard')
  const locale = i18n.resolvedLanguage || i18n.language || 'ru-RU'
  const pairLabel = `${t('market.loginData.email')}:${t('market.loginData.password')}`

  return (
    <Modal title={title} open={open} onClose={onClose}>
      {mode === 'letters' ? (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>{pairLabel}</span>
            <input
              className={styles.input}
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="mail@example.com:password"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('market.loginData.email')}</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('market.loginData.password')}</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={loading}
            onClick={() => void loadLetters()}
          >
            {loading ? <Loader2 size={14} className={styles.spin} /> : title}
          </button>
          {letters.map((letter, index) => (
            <div key={`${letter.date}-${index}`} className={styles.field}>
              <span className={styles.label}>
                {letter.from} {fmtLetterDate(letter.date, locale)}
              </span>
              <p>{letter.textPlain}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>{t('market.sidebar.mailTools.itemId')}</span>
            <input
              className={styles.input}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={loading}
            onClick={() => void loadGuardCode()}
          >
            {loading ? <Loader2 size={14} className={styles.spin} /> : title}
          </button>
          {code ? <p className={styles.done}>{code}</p> : null}
        </div>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </Modal>
  )
}
