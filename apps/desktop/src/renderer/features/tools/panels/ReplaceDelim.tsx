import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import { toolUnescape } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

export const ReplaceDelimPanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [unescape, setUnescape] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    let f = from
    let target = to
    if (unescape) {
      f = toolUnescape(f)
      target = toolUnescape(target)
    }
    if (f === '') {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.replace.noFrom') })
      return
    }
    const parts = text.split(f)
    const count = parts.length - 1
    setOutput(parts.join(target))
    setNote({ kind: 'ok', text: t('tools.replace.done', { count }) })
  }

  const fillExample = () => {
    setText('a,b,c,d')
    setFrom(',')
    setTo(';')
  }

  return (
    <ToolShell title={t('tools.replace.title')} lead={t('tools.replace.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.replace.textLabel')}</label>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="a,b,c,d"
        spellCheck={false}
        rows={5}
      />
      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>{t('tools.replace.from')}</label>
          <input className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="," />
        </div>
        <div>
          <label className={styles.label}>{t('tools.replace.to')}</label>
          <input className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} placeholder=";" />
        </div>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={unescape} onChange={(e) => setUnescape(e.target.checked)} />
        <span>{t('tools.recognizeEscapes')}</span>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.replace.run')}
        </button>
        <button type="button" className={styles.ghost} onClick={fillExample}>
          {t('tools.example')}
        </button>
      </div>

      {note ? <Note kind={note.kind} text={note.text} /> : null}
      {output !== null ? <OutputBlock text={output} /> : null}
    </ToolShell>
  )
}
