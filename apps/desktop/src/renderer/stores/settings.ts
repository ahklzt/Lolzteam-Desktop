import type { ModeratorSettings, SettingsSnapshot } from '@lzt/shared'
import { create } from 'zustand'

interface SettingsState {
  snapshot: SettingsSnapshot | null
  setSnapshot: (snapshot: SettingsSnapshot) => void
  patch: (patch: Partial<ModeratorSettings>) => Promise<void>
}

const SAVE_DELAY_MS = 140

export const useSettingsStore = create<SettingsState>((set) => {
  let pendingPatch: Partial<ModeratorSettings> = {}
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveQueue: Promise<void> = Promise.resolve()
  let pendingResolvers: Array<() => void> = []

  const flush = (): void => {
    saveTimer = null
    const patch = pendingPatch
    const resolvers = pendingResolvers
    pendingPatch = {}
    pendingResolvers = []

    const request = saveQueue.then(() => window.moderator.settings.set(patch))
    saveQueue = request.then(
      () => undefined,
      () => undefined
    )
    void request.then(
      (snapshot) => {
        set({
          snapshot: {
            ...snapshot,
            settings: { ...snapshot.settings, ...pendingPatch }
          }
        })
        for (const resolve of resolvers) resolve()
      },
      (error) => {
        console.error('[settings] save failed', error)
        for (const resolve of resolvers) resolve()
      }
    )
  }

  return {
    snapshot: null,
    setSnapshot: (snapshot) =>
      set({
        snapshot: {
          ...snapshot,
          settings: { ...snapshot.settings, ...pendingPatch }
        }
      }),
    patch: (patch) => {
      pendingPatch = { ...pendingPatch, ...patch }
      set((state) =>
        state.snapshot
          ? {
              snapshot: {
                ...state.snapshot,
                settings: { ...state.snapshot.settings, ...patch }
              }
            }
          : state
      )
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(flush, SAVE_DELAY_MS)
      return new Promise((resolve) => pendingResolvers.push(resolve))
    }
  }
})
