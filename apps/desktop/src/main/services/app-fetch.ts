import { net, session } from 'electron'


type AppFetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  signal?: AbortSignal
}

const NULL_BODY_STATUS = new Set([204, 205, 304])

export const appFetch = (url: string, init: AppFetchInit = {}): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    let settled = false
    const done = (fn: () => void): void => {
      if (settled) return
      settled = true
      fn()
    }

    const req = net.request({
      url,
      method: init.method ?? 'GET',
      session: session.defaultSession,
      useSessionCookies: false,
    })

    for (const [key, value] of Object.entries(init.headers ?? {})) {
      req.setHeader(key, value)
    }

    const onAbort = (): void => {
      try {
        req.abort()
      } catch {
      }
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      done(() => reject(err))
    }

    if (init.signal) {
      if (init.signal.aborted) {
        onAbort()
        return
      }
      init.signal.addEventListener('abort', onAbort, { once: true })
    }
    const cleanup = (): void => init.signal?.removeEventListener('abort', onAbort)

    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c as Buffer))
      res.on('end', () => {
        cleanup()
        const headers = new Headers()
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const one of value) headers.append(key, one)
          } else if (value != null) {
            headers.set(key, String(value))
          }
        }
        const status = res.statusCode
        const body = NULL_BODY_STATUS.has(status) ? null : Buffer.concat(chunks)
        done(() => resolve(new Response(body, { status, headers })))
      })
    })

    req.on('error', (err) => {
      cleanup()
      done(() => reject(err))
    })

    if (init.body != null) req.write(init.body)
    req.end()
  })
