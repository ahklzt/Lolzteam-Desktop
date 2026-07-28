import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, MapPin, Search } from 'lucide-react'
import type { IpLookupResult } from '@lzt/shared'
import styles from './ProxyCheckTool.module.scss'

const localTime = (timezone: string): string => {
  if (!timezone) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date())
  } catch {
    return ''
  }
}

const Kv = ({ k, v }: { k: string; v: string }) => (
  <div className={styles.kv}>
    <span className={styles.kvKey}>{k}</span>
    <span className={styles.kvVal}>{v || '—'}</span>
  </div>
)

export const CheckIpTab = ({ onExit }: { onExit: () => void }) => {
  const { t } = useTranslation()
  const [ip, setIp] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<IpLookupResult | null>(null)
  const [ownLoaded, setOwnLoaded] = useState(false)

  const lookup = useCallback(async (value: string) => {
    setBusy(true)
    const res = await window.moderator.proxy.lookupIp(value.trim())
    setResult(res)
    setBusy(false)
  }, [])

  useEffect(() => {
    if (ownLoaded) return
    setOwnLoaded(true)
    void lookup('')
  }, [ownLoaded, lookup])

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.back} onClick={onExit}>
        <ArrowLeft size={16} /> {t('proxycheck.backTools')}
      </button>

      <label className={styles.label} htmlFor="pc-ip-input">
        {t('proxycheck.ip.label')}
      </label>
      <div className={styles.row}>
        <input
          id="pc-ip-input"
          className={styles.input}
          placeholder={t('proxycheck.ip.placeholder')}
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void lookup(ip)
          }}
        />
        <button type="button" className={styles.primary} onClick={() => void lookup(ip)} disabled={busy}>
          {busy ? <Loader2 size={16} className={styles.spin} /> : <Search size={16} />}
          {t('proxycheck.ip.run')}
        </button>
      </div>

      {result && !result.ok && (
        <div className={`${styles.note} ${styles.noteWarn}`}>⚠ {result.message}</div>
      )}

      {result?.ok && (
        <div className={styles.ipReport}>
          <div className={styles.ipHead}>
            <MapPin size={16} />
            <span className={styles.ipBig}>{result.ip}</span>
          </div>
          <section className={styles.section}>
            <Kv k={t('proxycheck.ip.country')} v={[result.city, result.country].filter(Boolean).join(', ')} />
            <Kv k={t('proxycheck.ip.isp')} v={result.isp} />
            <Kv k={t('proxycheck.ip.asn')} v={result.asn} />
            <Kv k={t('proxycheck.ip.type')} v={result.ipType} />
            <Kv k={t('proxycheck.ip.coords')} v={`${result.lat}, ${result.lon}`} />
            <Kv k={t('proxycheck.ip.timezone')} v={result.timezone} />
            <Kv k={t('proxycheck.ip.time')} v={localTime(result.timezone)} />
          </section>
        </div>
      )}
    </div>
  )
}
