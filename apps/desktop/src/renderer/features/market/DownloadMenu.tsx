import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Download, Loader2 } from 'lucide-react'
import type { MarketDownloadFormat, MarketDownloadQuery } from '@lzt/shared'
import styles from './MarketView.module.scss'

const FORMATS: MarketDownloadFormat[] = [
  'short',
  'custom',
  'mfa_file_steam_id',
  'mfa_file_login',
]

type Props = {
  type: 'items' | 'orders'
  count: number
  categoryId?: number
  show?: string
  title?: string
}

export const DownloadMenu = ({ type, count, categoryId, show, title }: Props) => {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [customFormat, setCustomFormat] = useState('')

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const run = async (format: MarketDownloadFormat) => {
    if (busy) return
    if (format === 'custom' && customFormat.trim().length === 0) return
    setBusy(true)
    setError(false)
    const query: MarketDownloadQuery = {
      type,
      format,
      customFormat: format === 'custom' ? customFormat.trim() : undefined,
      category_id: categoryId,
      show,
      title,
    }
    const res = await window.moderator.market.downloadAccounts(query)
    setBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    setOpen(false)
    void window.moderator.app.openExternal(res.url)
  }

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={styles.sbWideBtn}
        onClick={() => setOpen((v) => !v)}
        disabled={busy || count === 0}
      >
        {busy ? <Loader2 className={styles.spin} size={15} /> : <Download size={15} />}
        {t('market.download.button', { count })}
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className={styles.cardMenu} role="menu">
          <span className={styles.modalHint}>{t('market.download.format')}</span>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={styles.cardMenuItem}
              onClick={() => void run(f)}
            >
              {t(`market.download.formats.${f}`)}
            </button>
          ))}
          <input
            className={styles.fieldInput}
            value={customFormat}
            placeholder={t('market.download.customPlaceholder')}
            onChange={(e) => setCustomFormat(e.target.value)}
          />
          {error ? <p className={styles.errorText}>{t('market.download.error')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export default DownloadMenu
