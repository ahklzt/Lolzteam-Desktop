import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, ToolShell } from '../ToolShell'
import { type CookieFormatResult, detectCookieFormat } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const EXAMPLE = '.example.com\tTRUE\t/\tTRUE\t1700000000\tsid\tABC123'

export const CookieFormatPanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<CookieFormatResult | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setResult(detectCookieFormat(raw)), 250)
    return () => clearTimeout(id)
  }, [raw])

  return (
    <ToolShell title={t('tools.cookieFmt.title')} lead={t('tools.cookieFmt.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.cookieFmt.inputLabel')}</label>
      <textarea
        className={styles.textarea}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={t('tools.cookieFmt.placeholder')}
        spellCheck={false}
        rows={6}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={() => setRaw(EXAMPLE)}>
          {t('tools.example')}
        </button>
      </div>

      {result && result.fmt !== '' ? (
        result.fmt === 'unknown' ? (
          <Note kind="warn" text={`${result.label} — ${result.note}`} />
        ) : (
          <div className={styles.resultCard}>
            <div className={styles.resultTitle}>
              {t('tools.cookieFmt.format')}: {result.label}
            </div>
            <div className={styles.resultNote}>{result.note}</div>
          </div>
        )
      ) : (
        <div className={styles.hint}>{t('tools.cookieFmt.hint')}</div>
      )}
    </ToolShell>
  )
}
