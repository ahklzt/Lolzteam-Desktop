import log from 'electron-log/main'

export interface RateLimiterOptions {
  ratePerSec: number
  burst: number
}

export interface RateLimiterSnapshot {
  remaining: number | null
  limit: number | null
  resetAt: number | null
  availableTokens: number
  capacity: number
  cooldownUntil: number | null
}

const now = (): number => Date.now()

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class RateLimiter {
  private readonly capacity: number
  private tokens: number
  private readonly refillPerMs: number
  private lastRefill: number
  private cooldownUntil = 0
  private headerRemaining: number | null = null
  private headerLimit: number | null = null
  private headerResetAt: number | null = null

  constructor(opts: RateLimiterOptions) {
    this.capacity = Math.max(1, opts.burst)
    this.tokens = this.capacity
    this.refillPerMs = opts.ratePerSec / 1000
    this.lastRefill = now()
  }

  private refill(): void {
    const t = now()
    const elapsed = t - this.lastRefill
    if (elapsed <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs)
    this.lastRefill = t
  }

  async acquire(): Promise<void> {
    for (;;) {
      const t = now()
      if (this.cooldownUntil > t) {
        await sleep(this.cooldownUntil - t)
        continue
      }
      this.refill()
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }
      const needed = 1 - this.tokens
      const waitMs = Math.max(15, Math.ceil(needed / this.refillPerMs))
      await sleep(waitMs)
    }
  }

  applyHeaders(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining')
    const limit = headers.get('x-ratelimit-limit')
    const reset = headers.get('x-ratelimit-reset')
    if (remaining !== null) {
      const n = Number.parseInt(remaining, 10)
      this.headerRemaining = Number.isFinite(n) ? n : null
    }
    if (limit !== null) {
      const n = Number.parseInt(limit, 10)
      this.headerLimit = Number.isFinite(n) ? n : null
    }
    if (reset !== null) {
      const n = Number.parseInt(reset, 10)
      if (Number.isFinite(n)) {
        this.headerResetAt = n > 1e12 ? n : n * 1000
      }
    }
    if (this.headerRemaining !== null && this.headerRemaining <= 0) {
      const until = this.headerResetAt ?? now() + 1000
      this.cooldownUntil = Math.max(this.cooldownUntil, until)
    }
  }

  noteRetryAfter(headers: Headers): void {
    const retry = headers.get('retry-after')
    let waitMs = 2000
    if (retry !== null) {
      const n = Number.parseInt(retry, 10)
      if (Number.isFinite(n)) waitMs = n * 1000
    }
    this.cooldownUntil = Math.max(this.cooldownUntil, now() + waitMs)
    this.tokens = 0
    log.warn(`[market] rate limited, cooling down for ${waitMs}ms`)
  }

  snapshot(): RateLimiterSnapshot {
    this.refill()
    return {
      remaining: this.headerRemaining,
      limit: this.headerLimit,
      resetAt: this.headerResetAt,
      availableTokens: Math.floor(this.tokens),
      capacity: this.capacity,
      cooldownUntil: this.cooldownUntil > now() ? this.cooldownUntil : null,
    }
  }
}

export const marketLimiter = new RateLimiter({ ratePerSec: 4, burst: 8 })
