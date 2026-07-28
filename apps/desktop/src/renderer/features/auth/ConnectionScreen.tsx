import type { AuthStatus } from '@lzt/shared'
import { APP_ICON_DATA_URLS } from '@lzt/shared'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSettingsStore } from '~/stores/settings'
import { APP_ICON_DATA_URL } from '~/lib/appIcon'
import s from './ConnectionScreen.module.scss'

interface Props {
  mode: 'loading' | 'offline'
  onRetry: () => Promise<AuthStatus | undefined>
}

export const ConnectionScreen = ({ mode, onRetry }: Props) => {
  const appIconId = useSettingsStore((st) => st.snapshot?.settings.appIconId ?? 1)
  const appIcon = APP_ICON_DATA_URLS[appIconId - 1] ?? APP_ICON_DATA_URL
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const pendingRef = useRef(false)

  const retry = async () => {
    if (busyRef.current) {
      pendingRef.current = true
      return
    }
    busyRef.current = true
    setBusy(true)
    try {
      do {
        pendingRef.current = false
        await onRetry()
      } while (pendingRef.current)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className={s.container}>
        <div className={s.brandLoader}>
          <span className={s.brandRing} />
          <img
            className={s.brandIcon}
            src={appIcon}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </div>
        <span className={s.brandTitle}>Lolzteam Desktop</span>
      </div>
    )
  }

  return (
    <div className={s.container}>
      <div className={s.ring}>
        <CloudOff size={28} />
      </div>
      <div className={s.text}>
        <span className={s.title}>Нет связи с LZT</span>
        <span className={s.subtitle}>Проверьте интернет или попробуйте ещё раз</span>
      </div>
      <button type="button" className={s.button} onClick={() => void retry()} disabled={busy}>
        <RefreshCw size={16} className={busy ? s.spin : ''} />
        <span>{busy ? 'Повторяем…' : 'Повторить'}</span>
      </button>
    </div>
  )
}
