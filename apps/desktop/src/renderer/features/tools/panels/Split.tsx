import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import { toolUnescape } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

export const SplitPanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [sep, setSep] = useState('')
  const [unescape, setUnescape] = useState(false)
  const [trim, setTrim] = useState(true)
  const [removeEmpty, setRemoveEmpty] = useState(true)
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    let s = sep
    if (unescape) s = toolUnescape(s)
    if (s === '') {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.split.noSep') })
      return
    }
    let parts = text.split(s)
    if (trim) parts = parts.map((p) => p.trim())
    if (removeEmpty) parts = parts.filter((p) => p !== '')
    setOutput(parts.join('\n'))
    setNote({ kind: 'ok', text: t('tools.split.done', { count: parts.length }) })
  }

  const fillExample = () => {
    setText('red, green, blue, red')
    setSep(',')
  }

  return (
    <ToolShell title={t('tools.split.title')} lead={t('tools.split.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.split.textLabel')}</label>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="a,b,c,d"
        spellCheck={false}
        rows={5}
      />
      <label className={styles.label}>{t('tools.split.sep')}</label>
      <input className={styles.input} value={sep} onChange={(e) => setSep(e.target.value)} placeholder="," />

      <label className={styles.checkRow}>
        <input type="checkbox" checked={unescape} onChange={(e) => setUnescape(e.target.checked)} />
        <span>{t('tools.recognizeEscapes')}</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
        <span>{t('tools.split.trim')}</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={removeEmpty} onChange={(e) => setRemoveEmpty(e.target.checked)} />
        <span>{t('tools.split.removeEmpty')}</span>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.split.run')}
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
