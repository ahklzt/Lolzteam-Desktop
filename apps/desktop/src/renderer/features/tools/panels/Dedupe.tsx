import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Note, OutputBlock, ToolShell } from '../ToolShell'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const EXAMPLE = 'apple\nbanana\napple\nApple\n\ncherry\nbanana'

export const DedupePanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [trim, setTrim] = useState(true)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [removeEmpty, setRemoveEmpty] = useState(true)
  const [sort, setSort] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'info'; text: string } | null>(null)

  const run = () => {
    const lines = input.split(/\r?\n/)
    const seen = new Set<string>()
    const res: string[] = []
    let total = 0
    for (const line of lines) {
      const val = trim ? line.trim() : line
      if (removeEmpty && val === '') continue
      total++
      const key = ignoreCase ? val.toLowerCase() : val
      if (seen.has(key)) continue
      seen.add(key)
      res.push(val)
    }
    if (sort) res.sort((a, b) => a.localeCompare(b))
    setOutput(res.join('\n'))
    setNote({
      kind: 'ok',
      text: t('tools.dedupe.done', { total, unique: res.length, removed: total - res.length }),
    })
  }

  return (
    <ToolShell title={t('tools.dedupe.title')} lead={t('tools.dedupe.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.dedupe.inputLabel')}</label>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('tools.dedupe.placeholder')}
        spellCheck={false}
        rows={6}
      />

      <label className={styles.checkRow}>
        <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
        <span>{t('tools.dedupe.trim')}</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
        <span>{t('tools.dedupe.ignoreCase')}</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={removeEmpty} onChange={(e) => setRemoveEmpty(e.target.checked)} />
        <span>{t('tools.dedupe.removeEmpty')}</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={sort} onChange={(e) => setSort(e.target.checked)} />
        <span>{t('tools.dedupe.sort')}</span>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('tools.dedupe.run')}
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
