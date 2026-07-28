import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import { b64DecodeUtf8 } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const EXAMPLE = 'eyJ1c2VyIjoiWGVucmEiLCJvayI6dHJ1ZX0='

export const Base64DecodePanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    let decoded: string
    try {
      decoded = b64DecodeUtf8(input)
    } catch {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.b64decode.invalid') })
      return
    }
    let pretty: string
    let isJson = true
    try {
      pretty = JSON.stringify(JSON.parse(decoded), null, 2)
    } catch {
      isJson = false
      pretty = decoded
    }
    setOutput(pretty)
    setNote(
      isJson
        ? { kind: 'ok', text: t('tools.b64decode.okJson') }
        : { kind: 'info', text: t('tools.b64decode.okText') },
    )
  }

  return (
    <ToolShell title={t('tools.b64decode.title')} lead={t('tools.b64decode.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.b64decode.inputLabel')}</label>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="eyJhIjoxfQ=="
        spellCheck={false}
        rows={5}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.b64decode.run')}
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
