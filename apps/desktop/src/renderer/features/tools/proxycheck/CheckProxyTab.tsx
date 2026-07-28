import { type ChangeEvent, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ClipboardPaste,
  Globe,
  Loader2,
  SearchCheck,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import type { ProxyCheckProtocol, ProxyCheckResult, SiteCheckResult } from '@lzt/shared'
import { CopyButton, copyText } from '../ToolShell'
import { type ParsedProxy, downloadText, parseAnyProxy } from './convert'
import { Dropdown } from '~/widgets/Dropdown/Dropdown'
import styles from './ProxyCheckTool.module.scss'

type Mode = null | 'health' | 'site'
type Protocol = ProxyCheckProtocol

interface HealthRow {
  line: string
  input: ParsedProxy
  result: ProxyCheckResult | 'pending'
}

const PROTOCOLS: Protocol[] = ['auto', 'http', 'https', 'socks5']

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      const idx = cursor++
      const item = items[idx]
      if (item === undefined) continue
      await worker(item, idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
}

const exportLine = (p: ParsedProxy): string =>
  p.username ? `${p.host}:${p.port}:${p.username}:${p.password ?? ''}` : `${p.host}:${p.port}`

const HealthMode = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [protocol, setProtocol] = useState<Protocol>('auto')
  const [rows, setRows] = useState<HealthRow[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
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

  const onRun = useCallback(async () => {
    const parsed: HealthRow[] = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const input = parseAnyProxy(line)
        return input ? { line, input, result: 'pending' as const } : null
      })
      .filter((x): x is HealthRow => x !== null)

    if (parsed.length === 0) {
      setRows([])
      return
    }

    setBusy(true)
    setDone(0)
    setRows(parsed)

    await runPool(parsed, 5, async (row, idx) => {
      const result = await window.moderator.proxy.check({
        protocol,
        host: row.input.host,
        port: row.input.port,
        ...(row.input.username ? { username: row.input.username } : {}),
        ...(row.input.password ? { password: row.input.password } : {}),
      })
      setRows((prev) => {
        const next = [...prev]
        const target = next[idx]
        if (target) next[idx] = { ...target, result }
        return next
      })
      setDone((d) => d + 1)
    })

    setBusy(false)
  }, [text, protocol])

  const working = rows.filter(
    (r): r is HealthRow & { result: Extract<ProxyCheckResult, { ok: true }> } =>
      r.result !== 'pending' && r.result.ok,
  )
  const workingLines = working.map((r) => exportLine(r.input)).join('\n')

  const onDownload = useCallback(() => {
    if (workingLines) downloadText('working-proxies.txt', workingLines)
  }, [workingLines])

  const onDownloadJson = useCallback(() => {
    const data = working.map((r) => ({ proxy: exportLine(r.input), ...r.result }))
    downloadText('working-proxies.json', JSON.stringify(data, null, 2), 'application/json')
  }, [working])

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} /> {t('proxycheck.back')}
      </button>

      <label className={styles.label} htmlFor="pc-health-text">
        {t('proxycheck.health.label')}
      </label>
      <textarea
        id="pc-health-text"
        className={styles.textarea}
        rows={7}
        placeholder={t('proxycheck.health.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className={styles.row}>
        <Dropdown
          value={protocol}
          onChange={(v) => setProtocol(v)}
          options={PROTOCOLS.map((p) => ({
            value: p,
            label: t(`proxycheck.protocol.${p}`),
          }))}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void onRun()} disabled={busy}>
          {busy ? <Loader2 size={16} className={styles.spin} /> : <SearchCheck size={16} />}
          {busy ? `${t('proxycheck.health.checking')} ${done}/${rows.length}` : t('proxycheck.health.run')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => void onPaste()}>
          <ClipboardPaste size={16} /> {t('proxycheck.paste')}
        </button>
        <button type="button" className={styles.ghost} onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> {t('proxycheck.loadTxt')}
        </button>
        <input ref={fileRef} type="file" accept=".txt" hidden onChange={onFile} />
      </div>

      {rows.length > 0 && (
        <>
          <div className={styles.summary}>
            <span className={styles.summaryNum}>{working.length}</span>
            <span className={styles.summaryLabel}>
              {t('proxycheck.health.working')} ({working.length}/{rows.length})
            </span>
            {working.length > 0 && (
              <div className={styles.exportBar}>
                <button type="button" className={styles.ghost} onClick={() => void copyText(workingLines)}>
                  {t('proxycheck.health.exportCopy')}
                </button>
                <button type="button" className={styles.ghost} onClick={onDownload}>
                  {t('proxycheck.health.exportTxt')}
                </button>
                <button type="button" className={styles.ghost} onClick={onDownloadJson}>
                  {t('proxycheck.health.exportJson')}
                </button>
              </div>
            )}
          </div>

          <div className={styles.results}>
            {rows.map((row, i) => (
              <HealthResultCard key={`${row.line}-${i}`} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>{value || '—'}</span>
  </div>
)

const HealthResultCard = ({ row }: { row: HealthRow }) => {
  const { t } = useTranslation()
  const { result, input } = row

  if (result === 'pending') {
    return (
      <div className={styles.resultRow}>
        <div className={styles.resultHead}>
          <Loader2 size={16} className={styles.spin} />
          <span className={styles.resultLine}>{row.line}</span>
        </div>
      </div>
    )
  }

  if (!result.ok) {
    return (
      <div className={`${styles.resultRow} ${styles.bad}`}>
        <div className={styles.resultHead}>
          <span className={styles.dotBad} />
          <span className={styles.resultLine}>{row.line}</span>
          <span className={styles.resultPing}>{t('proxycheck.fields.failed')}</span>
        </div>
        <div className={styles.errText}>{result.message}</div>
      </div>
    )
  }

  return (
    <div className={`${styles.resultRow} ${styles.ok}`}>
      <div className={styles.resultHead}>
        <span className={styles.dotOk} />
        <span className={styles.resultLine}>{row.line}</span>
        <span className={styles.resultPing}>
          {t('proxycheck.fields.ping')}: {result.ms} ms
        </span>
      </div>
      <div className={styles.grid}>
        <Field label={t('proxycheck.fields.login')} value={input.username ?? ''} />
        <Field label={t('proxycheck.fields.password')} value={input.password ?? ''} />
        <Field label={t('proxycheck.fields.ip')} value={input.host} />
        <Field label={t('proxycheck.fields.port')} value={String(input.port)} />
        <Field label={t('proxycheck.fields.realIp')} value={result.realIp} />
        <Field label={t('proxycheck.fields.ipVersion')} value={result.ipVersion} />
        <Field label={t('proxycheck.fields.protocol')} value={result.protocol.toUpperCase()} />
        <Field label={t('proxycheck.fields.isp')} value={result.geo.isp} />
        <Field label={t('proxycheck.fields.asn')} value={result.geo.asn} />
        <Field
          label={t('proxycheck.fields.geo')}
          value={[result.geo.city, result.geo.country].filter(Boolean).join(', ')}
        />
        <Field label={t('proxycheck.fields.timezone')} value={result.geo.timezone} />
        <Field label={t('proxycheck.fields.type')} value={result.ipType} />
        <Field
          label={t('proxycheck.fields.typeIp')}
          value={result.rotating ? t('proxycheck.fields.rotating') : t('proxycheck.fields.static')}
        />
        <Field label={t('proxycheck.fields.responseTime')} value={`${result.ms} ms`} />
      </div>
    </div>
  )
}

const SiteMode = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation()
  const [proxyText, setProxyText] = useState('')
  const [siteText, setSiteText] = useState('')
  const [protocol, setProtocol] = useState<Protocol>('auto')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SiteCheckResult | null>(null)
  const [error, setError] = useState('')

  const onRun = useCallback(async () => {
    setError('')
    setResult(null)
    const parsed = parseAnyProxy(proxyText)
    if (!parsed) {
      setError(t('proxycheck.site.emptyProxy'))
      return
    }
    if (!siteText.trim()) {
      setError(t('proxycheck.site.emptyUrl'))
      return
    }
    setBusy(true)
    const res = await window.moderator.proxy.checkSite({
      proxy: {
        protocol,
        host: parsed.host,
        port: parsed.port,
        ...(parsed.username ? { username: parsed.username } : {}),
        ...(parsed.password ? { password: parsed.password } : {}),
      },
      targetUrl: siteText.trim(),
    })
    setResult(res)
    setBusy(false)
  }, [proxyText, siteText, protocol, t])

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} /> {t('proxycheck.back')}
      </button>

      <label className={styles.label} htmlFor="pc-site-proxy">
        {t('proxycheck.site.proxyLabel')}
      </label>
      <input
        id="pc-site-proxy"
        className={styles.input}
        placeholder={t('proxycheck.site.proxyPlaceholder')}
        value={proxyText}
        onChange={(e) => setProxyText(e.target.value)}
      />

      <label className={styles.label} htmlFor="pc-site-url">
        {t('proxycheck.site.urlLabel')}
      </label>
      <input
        id="pc-site-url"
        className={styles.input}
        placeholder={t('proxycheck.site.sitePlaceholder')}
        value={siteText}
        onChange={(e) => setSiteText(e.target.value)}
      />

      <div className={styles.row}>
        <Dropdown
          value={protocol}
          onChange={(v) => setProtocol(v)}
          options={PROTOCOLS.map((p) => ({
            value: p,
            label: t(`proxycheck.protocol.${p}`),
          }))}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void onRun()} disabled={busy}>
          {busy ? <Loader2 size={16} className={styles.spin} /> : <Globe size={16} />}
          {busy ? t('proxycheck.site.checking') : t('proxycheck.site.run')}
        </button>
      </div>

      {error && <div className={`${styles.note} ${styles.noteWarn}`}>⚠ {error}</div>}

      {result && <SiteResult result={result} />}
    </div>
  )
}

const Kv = ({ k, v }: { k: string; v: string }) => (
  <div className={styles.kv}>
    <span className={styles.kvKey}>{k}</span>
    <span className={styles.kvVal}>{v || '—'}</span>
  </div>
)

const SiteResult = ({ result }: { result: SiteCheckResult }) => {
  const { t } = useTranslation()
  const fmtBytes = (n: number): string =>
    n < 1024
      ? `${n} B`
      : n < 1024 * 1024
        ? `${(n / 1024).toFixed(1)} KB`
        : `${(n / 1024 / 1024).toFixed(2)} MB`

  if (!result.ok) {
    return <div className={`${styles.note} ${styles.noteWarn}`}>⚠ {result.message}</div>
  }

  return (
    <div className={styles.siteReport}>
      <div className={result.opened ? styles.statusOk : styles.statusBad}>
        {result.opened ? t('proxycheck.site.opened') : t('proxycheck.site.notOpened')}
      </div>

      {(result.cloudflare || result.captcha) && (
        <div className={styles.badges}>
          {result.cloudflare && <span className={styles.badgeWarn}>Cloudflare</span>}
          {result.captcha && <span className={styles.badgeWarn}>{t('proxycheck.site.captcha')}</span>}
        </div>
      )}

      {result.proxyInfo && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('proxycheck.site.secProxy')}</h4>
          <Kv k={t('proxycheck.fields.realIp')} v={result.proxyInfo.realIp} />
          <Kv k={t('proxycheck.fields.protocol')} v={result.proxyInfo.protocol.toUpperCase()} />
          <Kv
            k={t('proxycheck.fields.geo')}
            v={[result.proxyInfo.geo.city, result.proxyInfo.geo.country].filter(Boolean).join(', ')}
          />
          <Kv k={t('proxycheck.fields.isp')} v={result.proxyInfo.geo.isp} />
          <Kv k={t('proxycheck.fields.type')} v={result.proxyInfo.ipType} />
        </section>
      )}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('proxycheck.site.secResponse')}</h4>
        <Kv k={t('proxycheck.site.httpStatus')} v={String(result.httpStatus)} />
        <Kv k={t('proxycheck.site.responseTime')} v={`${result.responseTimeMs} ms`} />
        <Kv k={t('proxycheck.site.httpVersion')} v={result.httpVersion} />
        <Kv k={t('proxycheck.site.targetUrl')} v={result.targetUrl} />
        <Kv k={t('proxycheck.site.finalUrl')} v={result.finalUrl} />
        <Kv
          k={t('proxycheck.site.redirects')}
          v={
            result.redirects.length > 0
              ? String(result.redirects.length)
              : t('proxycheck.site.redirectsNo')
          }
        />
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('proxycheck.site.secPage')}</h4>
        <Kv k={t('proxycheck.site.pageTitle')} v={result.page.title} />
        <Kv k={t('proxycheck.site.pageDesc')} v={result.page.description} />
        <Kv k={t('proxycheck.site.contentType')} v={result.page.contentType} />
        <Kv k={t('proxycheck.site.encoding')} v={result.page.encoding} />
        <Kv k={t('proxycheck.site.size')} v={fmtBytes(result.page.sizeBytes)} />
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('proxycheck.site.secServer')}</h4>
        <Kv k={t('proxycheck.site.server')} v={result.server.server} />
        <Kv k={t('proxycheck.site.poweredBy')} v={result.server.poweredBy} />
        <Kv k={t('proxycheck.site.date')} v={result.server.date} />
      </section>

      {result.redirects.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{t('proxycheck.site.secRedirects')}</h4>
          {result.redirects.map((r, i) => (
            <div key={`${r.url}-${i}`} className={styles.chainItem}>
              <span className={styles.badgeOk}>{r.status}</span> {r.url}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export const CheckProxyTab = ({ onExit }: { onExit: () => void }) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>(null)

  if (mode === 'health') return <HealthMode onBack={() => setMode(null)} />
  if (mode === 'site') return <SiteMode onBack={() => setMode(null)} />

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.back} onClick={onExit}>
        <ArrowLeft size={16} /> {t('proxycheck.backTools')}
      </button>

      <div className={styles.modeGrid}>
        <button type="button" className={styles.modeCard} onClick={() => setMode('health')}>
          <span className={styles.modeIcon}>
            <SearchCheck size={22} />
          </span>
          <span className={styles.modeTitle}>{t('proxycheck.modes.health.title')}</span>
          <span className={styles.modeDesc}>{t('proxycheck.modes.health.desc')}</span>
        </button>
        <button type="button" className={styles.modeCard} onClick={() => setMode('site')}>
          <span className={styles.modeIcon}>
            <ShieldCheck size={22} />
          </span>
          <span className={styles.modeTitle}>{t('proxycheck.modes.site.title')}</span>
          <span className={styles.modeDesc}>{t('proxycheck.modes.site.desc')}</span>
        </button>
      </div>
    </div>
  )
}
