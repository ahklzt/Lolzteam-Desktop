import { type ChangeEvent, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ClipboardPaste, Repeat, Upload } from 'lucide-react'
import { CopyButton } from '../ToolShell'
import {
  CONVERT_FORMATS,
  type ConvertFormat,
  downloadText,
  formatProxy,
  parseAnyProxy,
} from './convert'
import styles from './ProxyCheckTool.module.scss'

export const ConvertTab = ({ onExit }: { onExit: () => void }) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [format, setFormat] = useState<ConvertFormat>('login_pass_at')
  const [output, setOutput] = useState('')
  const [stats, setStats] = useState<{ ok: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void file.text().then((content) => setText((prev) => (prev ? `${prev}\n${content}` : content)))
    e.target.value = ''
  }, [])

  const onPaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) setText((prev) => (prev ? `${prev}\n${clip}` : clip))
    } catch {
    }
  }, [])

  const onConvert = useCallback(() => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const out: string[] = []
    let ok = 0
    for (const line of lines) {
      const parsed = parseAnyProxy(line)
      if (parsed) {
        out.push(formatProxy(parsed, format))
        ok++
      }
    }
    setOutput(out.join('\n'))
    setStats({ ok, total: lines.length })
  }, [text, format])

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.back} onClick={onExit}>
        <ArrowLeft size={16} /> {t('proxycheck.backTools')}
      </button>

      <label className={styles.label} htmlFor="pc-convert-text">
        {t('proxycheck.convert.label')}
      </label>
      <textarea
        id="pc-convert-text"
        className={styles.textarea}
        rows={7}
        placeholder={t('proxycheck.convert.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <label className={styles.label} htmlFor="pc-convert-fmt">
        {t('proxycheck.convert.formatLabel')}
      </label>
      <div className={styles.formatPills} id="pc-convert-fmt">
        {CONVERT_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.formatPill} ${format === f ? styles.formatPillActive : ''}`}
            onClick={() => setFormat(f)}
          >
            {t(`proxycheck.convert.fmt.${f}`)}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onConvert}>
          <Repeat size={16} /> {t('proxycheck.convert.run')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => void onPaste()}>
          <ClipboardPaste size={16} /> {t('proxycheck.paste')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> {t('proxycheck.loadTxt')}
        </button>
        <input ref={fileRef} type="file" accept=".txt" hidden onChange={onFile} />
      </div>

      {stats && (
        <div className={`${styles.note} ${styles.noteInfo}`}>
          ℹ {t('proxycheck.convert.done', { ok: stats.ok, total: stats.total })}
        </div>
      )}

      {output && (
        <>
          <pre className={styles.output}>{output}</pre>
          <div className={styles.actions}>
            <CopyButton text={output} />
            <button
              type="button"
              className={styles.ghost}
              onClick={() => downloadText('proxies.txt', output)}
            >
              {t('proxycheck.health.exportTxt')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
