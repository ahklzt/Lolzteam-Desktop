import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton, Note, ToolShell } from '../ToolShell'
import { totpBase32Decode, totpCompute } from '../lib'
import styles from '../ToolsView.module.scss'

interface PanelProps {
  onBack: () => void
}

const PERIOD = 30

export const TwoFAPanel = ({ onBack }: PanelProps) => {
  const { t } = useTranslation()
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(PERIOD)
  const lastStepRef = useRef<number>(-1)

  useEffect(() => {
    const clean = secret.replace(/\s+/g, '')
    if (clean === '') {
      setCode('')
      setError(null)
      lastStepRef.current = -1
      return
    }
    const bytes = totpBase32Decode(clean)
    if (!bytes) {
      setCode('')
      setError(t('tools.twofa.invalid'))
      lastStepRef.current = -1
      return
    }

    let cancelled = false
    const tick = async () => {
      const nowSec = Math.floor(Date.now() / 1000)
      const step = Math.floor(nowSec / PERIOD)
      setRemaining(PERIOD - (nowSec % PERIOD))
      if (step === lastStepRef.current) return
      try {
        const next = await totpCompute(bytes, nowSec)
        if (cancelled) return
        lastStepRef.current = step
        setCode(next)
        setError(null)
      } catch {
        if (!cancelled) setError(t('tools.twofa.computeError'))
      }
    }

    void tick()
    const id = setInterval(() => void tick(), 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [secret, t])

  const pct = (remaining / PERIOD) * 100

  return (
    <ToolShell title={t('tools.twofa.title')} lead={t('tools.twofa.lead')} onBack={onBack}>
      <label className={styles.label}>{t('tools.twofa.secretLabel')}</label>
      <input
        className={styles.input}
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="JBSWY3DPEHPK3PXP"
        spellCheck={false}
        autoComplete="off"
      />

      {error ? <Note kind="warn" text={error} /> : null}

      {code !== '' ? (
        <>
          <div className={styles.totpCode}>{code}</div>
          <div className={styles.totpBar}>
            <div className={styles.totpBarFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.totpTimer}>{t('tools.twofa.refreshIn', { sec: remaining })}</div>
          <div className={styles.actions}>
            <CopyButton text={code} label={t('tools.twofa.copyCode')} />
          </div>
        </>
      ) : (
        !error && <div className={styles.hint}>{t('tools.twofa.enterSecret')}</div>
      )}
    </ToolShell>
  )
}
