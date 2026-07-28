import { useEffect, useState } from 'react'
import { useSettingsStore } from '~/stores/settings'

export { useForumUser } from '~/lib/forum-user'

export const useBodyBackground = (url: string | null) => {
  const disabled = useSettingsStore(
    (s) => s.snapshot?.settings.disableProfileBackgrounds ?? false,
  )
  const effective = disabled ? null : url
  useEffect(() => {
    const body = document.body
    if (effective) {
      body.style.backgroundImage = `linear-gradient(rgba(20, 20, 20, 0.86), rgba(20, 20, 20, 0.94)), url("${url}")`
      body.style.backgroundSize = 'cover'
      body.style.backgroundPosition = 'center top'
      body.style.backgroundAttachment = 'fixed'
      body.style.backgroundRepeat = 'no-repeat'
    } else {
      body.style.backgroundImage = ''
    }
    return () => {
      body.style.backgroundImage = ''
      body.style.backgroundSize = ''
      body.style.backgroundPosition = ''
      body.style.backgroundAttachment = ''
      body.style.backgroundRepeat = ''
    }
  }, [effective])
}

export const useSellerMarketStats = (userId: number | null) => {
  const [stats, setStats] = useState<{
    sold: number | null
    active: number | null
    rating: number | null
  }>({ sold: null, active: null, rating: null })

  useEffect(() => {
    if (!userId) return
    let alive = true
    void (async () => {
      const [itemsRes, statesRes] = await Promise.all([
        window.moderator.market.getUserItems(userId, 1),
        window.moderator.market.getUserItemStates(userId),
      ])
      if (!alive) return
      let sold: number | null = null
      let active: number | null = null
      let rating: number | null = null
      if (itemsRes.ok) {
        const s = itemsRes.page.items[0]?.seller
        if (s) {
          if (typeof s.sold_items_count === 'number') sold = s.sold_items_count
          const a = s.active_items_count ?? s.active_item_count
          if (typeof a === 'number') active = a
          if (typeof s.restore_percents === 'number') rating = s.restore_percents
        }
      }
      if (statesRes.ok) {
        const st = statesRes.states as {
          userItemStates?: { active?: { item_count?: unknown } }
        }
        const c = st.userItemStates?.active?.item_count
        if (typeof c === 'number') active = c
      }
      setStats({ sold, active, rating })
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return stats
}
