import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity } from 'lucide-react'
import styles from './PingPill.module.scss'

type PingState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'online'; ms: number }
  | { status: 'offline' }

export const PingPill = () => {
  const { t } = useTranslation()
  const [state, setState] = useState<PingState>({ status: 'idle' })

  const check = useCallback(async () => {
    setState({ status: 'checking' })
    const res = await window.moderator.app.pingApi()
    setState(res.online ? { status: 'online', ms: res.ms } : { status: 'offline' })
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  const label =
    state.status === 'online'
      ? `${state.ms} мс`
      : state.status === 'checking'
        ? t('topbar.pingChecking')
        : state.status === 'offline'
          ? t('topbar.pingFail')
          : ''

  const dotClass =
    state.status === 'online'
      ? styles.online
      : state.status === 'offline'
        ? styles.offline
        : styles.checking

  return (
    <button
      type="button"
      className={styles.pill}
      onClick={() => void check()}
      title={t('topbar.pingRefresh')}
      disabled={state.status === 'checking'}
    >
      <span className={`${styles.dot} ${dotClass}`} />
      <Activity size={14} />
      <span className={styles.text}>
        {t('topbar.ping')}
        {label ? ` • ${label}` : ''}
      </span>
    </button>
  )
}
