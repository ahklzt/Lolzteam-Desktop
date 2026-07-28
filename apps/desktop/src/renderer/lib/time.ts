import { useSyncExternalStore } from 'react'

export const formatAgo = (epochMs: number, locale: string): string => {
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
  const diffSec = Math.round((epochMs - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

const tickListeners = new Set<() => void>()
let tickTimer: ReturnType<typeof setInterval> | null = null
let tickNow = Date.now()

const emitTick = (): void => {
  tickNow = Date.now()
  for (const listener of tickListeners) listener()
}

const subscribeTick = (onChange: () => void): (() => void) => {
  tickListeners.add(onChange)
  if (!tickTimer) tickTimer = setInterval(emitTick, 1000)
  return () => {
    tickListeners.delete(onChange)
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

const subscribeNoop = (): (() => void) => () => {}

export const useNowTick = (enabled = true): number =>
  useSyncExternalStore(
    enabled ? subscribeTick : subscribeNoop,
    () => (enabled ? tickNow : 0),
    () => 0,
  )
