import { create } from 'zustand'

const STORAGE_KEY = 'lzt.market.hiddenSellers'

const load = (): number[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((v): v is number => typeof v === 'number')
      : []
  } catch {
    return []
  }
}

const persist = (ids: number[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
  }
}

interface HiddenSellersState {
  ids: number[]
  isHidden: (userId: number) => boolean
  hide: (userId: number) => void
  unhide: (userId: number) => void
}

export const useHiddenSellers = create<HiddenSellersState>((set, get) => ({
  ids: load(),
  isHidden: (userId) => get().ids.includes(userId),
  hide: (userId) =>
    set((s) => {
      if (s.ids.includes(userId)) return s
      const ids = [...s.ids, userId]
      persist(ids)
      return { ids }
    }),
  unhide: (userId) =>
    set((s) => {
      const ids = s.ids.filter((id) => id !== userId)
      persist(ids)
      return { ids }
    }),
}))
