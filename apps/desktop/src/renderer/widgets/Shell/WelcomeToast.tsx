import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '~/stores/session'
import styles from './WelcomeToast.module.scss'

const GIF_URL = 'https' + '://nztcdn.com/files/43a2cf63-cd04-4729-a1bd-678a1b05a9af.webp'

let shownThisLaunch = false

const moscowHour = (): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Europe/Moscow',
  }).formatToParts(new Date())
  const raw = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const hour = Number(raw)
  return Number.isFinite(hour) ? hour % 24 : 0
}

export const WelcomeToast = () => {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const username =
    status?.authenticated && !status.offline ? status.profile.username : null

  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (shownThisLaunch || !username) return
    shownThisLaunch = true
    setVisible(true)
  }, [username])

  useEffect(() => {
    if (!visible) return
    const hideTimer = setTimeout(() => setLeaving(true), 3500)
    const removeTimer = setTimeout(() => setVisible(false), 4000)
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(removeTimer)
    }
  }, [visible])

  if (!visible || !username) return null

  const hour = moscowHour()
  const isDay = hour >= 6 && hour < 17
  const greeting = t(isDay ? 'welcome.day' : 'welcome.night', { name: username })

  return (
    <div className={`${styles.toast} ${leaving ? styles.leaving : ''}`} role="status">
      <img className={styles.icon} src={GIF_URL} alt="" />
      <span className={styles.text}>{greeting}</span>
    </div>
  )
}
