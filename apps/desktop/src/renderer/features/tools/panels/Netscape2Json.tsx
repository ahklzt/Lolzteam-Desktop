import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import { parseNetscapeCookies } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const EXAMPLE =
  '.example.com\tTRUE\t/\tTRUE\t1700000000\tsid\tABC123\n#HttpOnly_.example.com\tTRUE\t/\tTRUE\t0\ttoken\tXYZ'

export const Netscape2JsonPanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    const arr = parseNetscapeCookies(input)
    if (arr.length === 0) {
      setOutput(null)
      setNote({ kind: 'warn', text: t('tools.netscape.empty') })
      return
    }
    setOutput(JSON.stringify(arr, null, 2))
    setNote({ kind: 'ok', text: t('tools.netscape.ok', { count: arr.length }) })
  }

  return (
    <ToolShell title={t('tools.netscape.title')} lead={t('tools.netscape.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.netscape.inputLabel')}</label>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('tools.netscape.placeholder')}
        spellCheck={false}
        rows={6}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.netscape.run')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => setInput(EXAMPLE)}>
          {t('tools.example')}
        </button>
      </div>

      {note ? <Note kind={note.kind} text={note.text} /> : null}
      {output !== null ? <OutputBlock text={output} copyLabel={t('tools.netscape.copyJson')} /> : null}
    </ToolShell>
  )
}
