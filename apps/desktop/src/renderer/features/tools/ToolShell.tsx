import { type ReactNode, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import styles from './ToolsView.module.scss'

export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(text))
      return true
    }
  } catch {
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = String(text)
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}

interface ToolShellProps {
  title: string
  lead: string
  onBack: () => void
  children: ReactNode
}

export const ToolShell = ({ title, lead, onBack, children }: ToolShellProps) => (
  <div className={styles.tool}>
    <header className={styles.toolHead}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={18} />
      </button>
      <div className={styles.toolHeadText}>
        <h1 className={styles.toolTitle}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
      </div>
    </header>
    <div className={styles.toolBody}>{children}</div>
  </div>
)

export const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  const onClick = useCallback(async () => {
    const ok = await copyText(text)
    if (ok) {
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    }
  }, [text])

  return (
    <button type="button" className={styles.ghost} onClick={() => void onClick()}>
      {done ? <Check size={16} /> : <Copy size={16} />}
      {done ? t('tools.copied') : (label ?? t('tools.copy'))}
    </button>
  )
}

export const Note = ({ kind, text }: { kind: 'ok' | 'warn' | 'info'; text: string }) => {
  const prefix = kind === 'ok' ? '✓ ' : kind === 'warn' ? '⚠ ' : 'ℹ '
  const cls = kind === 'warn' ? styles.noteWarn : kind === 'ok' ? styles.noteOk : styles.noteInfo
  return <div className={`${styles.note} ${cls}`}>{prefix}{text}</div>
}

export const OutputBlock = ({ text, copyLabel }: { text: string; copyLabel?: string }) => (
  <>
    <pre className={styles.output}>{text}</pre>
    <div className={styles.actions}>
      <CopyButton text={text} {...(copyLabel ? { label: copyLabel } : {})} />
    </div>
  </>
)
