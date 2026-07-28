import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import { b64EncodeUtf8 } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const EXAMPLE = '{"user":"Xenra","ok":true,"tags":["a","b"]}'

export const Base64EncodePanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [minify, setMinify] = useState(true)
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    const raw = input.trim()
    if (raw === '') {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.b64encode.empty') })
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      setOutput(null)
      setNote({
        kind: 'warn',
        text: `${t('tools.b64encode.invalid')} ${e instanceof Error ? e.message : ''}`.trim(),
      })
      return
    }
    const text = minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2)
    try {
      setOutput(b64EncodeUtf8(text))
      setNote({ kind: 'ok', text: t('tools.b64encode.ok') })
    } catch {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.b64encode.encodeFailed') })
    }
  }

  return (
    <ToolShell title={t('tools.b64encode.title')} lead={t('tools.b64encode.lead')} onBack={onBack}>
      <label className={styles.label}>JSON</label>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('tools.b64encode.placeholder')}
        spellCheck={false}
        rows={6}
      />
      <label className={styles.checkRow}>
        <input type="checkbox" checked={minify} onChange={(e) => setMinify(e.target.checked)} />
        <span>{t('tools.b64encode.minify')}</span>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.b64encode.run')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => setInput(EXAMPLE)}>
          {t('tools.example')}
        </button>
      </div>

      {note ? <Note kind={note.kind} text={note.text} /> : null}
      {output !== null ? <OutputBlock text={output} /> : null}
    </ToolShell>
  )
}
