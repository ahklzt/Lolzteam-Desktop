import { useEffect, useState } from 'react'
import type { FullProfile } from '@lzt/shared'

const profileCache = new Map<string, FullProfile>()
const inflight = new Map<string, Promise<FullProfile | null>>()

const MAX_PARALLEL = 3
let running = 0
const waiters: Array<() => void> = []

const acquireSlot = (): Promise<void> =>
  new Promise((resolve) => {
    if (running < MAX_PARALLEL) {
      running += 1
      resolve()
    } else {
      waiters.push(() => {
        running += 1
        resolve()
      })
    }
  })

const releaseSlot = (): void => {
  running -= 1
  const next = waiters.shift()
  if (next) next()
}

const fetchForumUser = async (username: string): Promise<FullProfile | null> => {
  await acquireSlot()
  try {
    const res = await window.moderator.profile.getUser(username)
    return res.ok ? res.profile : null
  } finally {
    releaseSlot()
  }
}

export const useForumUser = (username: string | null) => {
  const key = (username ?? '').trim().toLowerCase()
  const [profile, setProfile] = useState<FullProfile | null>(
    key ? (profileCache.get(key) ?? null) : null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key || !username) {
      setProfile(null)
      return
    }
    const cached = profileCache.get(key)
    if (cached) {
      setProfile(cached)
      return
    }
    let alive = true
    setLoading(true)
    let req = inflight.get(key)
    if (!req) {
      req = fetchForumUser(username)
        .then((prof) => {
          if (prof) profileCache.set(key, prof)
          return prof
        })
        .finally(() => inflight.delete(key))
      inflight.set(key, req)
    }
    void req.then((prof) => {
      if (!alive) return
      setProfile(prof)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [key, username])

  return { profile, loading }
}
