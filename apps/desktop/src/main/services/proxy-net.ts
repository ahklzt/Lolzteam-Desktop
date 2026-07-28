import { randomUUID } from 'node:crypto'
import { type Session, net, session } from 'electron'

export interface ProxyNetTarget {
  host: string
  port: number
  username?: string
  password?: string
  protocol?: string
}

export interface ProxyNetInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  maxBytes?: number
  followRedirects?: boolean
}

export interface ProxyNetResult {
  ok: boolean
  status: number
  headers: Record<string, string | string[]>
  body: string
  redirects: Array<{ status: number; url: string }>
  finalUrl: string
  sizeBytes: number
  error?: string
}

const proxyRulesFor = (t: ProxyNetTarget): string => {
  const scheme =
    t.protocol === 'socks5'
      ? 'socks5'
      : t.protocol === 'socks4'
        ? 'socks4'
        : t.protocol === 'https'
          ? 'https'
          : 'http'
  return `${scheme}://${t.host}:${t.port}`
}

export const proxyRequest = (
  target: ProxyNetTarget,
  url: string,
  init: ProxyNetInit = {},
): Promise<ProxyNetResult> =>
  new Promise<ProxyNetResult>((resolve) => {
    const timeoutMs = init.timeoutMs ?? 15_000
    const maxBytes = init.maxBytes ?? 2 * 1024 * 1024
    const method = init.method ?? 'GET'
    const redirect = init.followRedirects === false ? 'manual' : 'follow'
    const ses: Session = session.fromPartition(`pn-${randomUUID()}`)

    const redirects: Array<{ status: number; url: string }> = []
    let finalUrl = url
    let settled = false
    let req: Electron.ClientRequest | null = null

    const finish = (result: ProxyNetResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void ses.clearStorageData().catch(() => {})
      resolve(result)
    }
    const fail = (error: string): void =>
      finish({ ok: false, status: 0, headers: {}, body: '', redirects, finalUrl, sizeBytes: 0, error })

    const timer = setTimeout(() => {
      try {
        req?.abort()
      } catch {
      }
      fail('timeout')
    }, timeoutMs)

    ses
      .setProxy({ proxyRules: proxyRulesFor(target) })
      .then(() => {
        req = net.request({ session: ses, url, method, useSessionCookies: false, redirect })

        req.on('login', (authInfo, cb) => {
          if (authInfo.isProxy && target.username) cb(target.username, target.password ?? '')
          else cb()
        })

        if (redirect === 'manual') {
          req.on('redirect', (status, _method, redirectUrl) => {
            redirects.push({ status, url: redirectUrl })
            finalUrl = redirectUrl
            if (redirects.length > 20) {
              try {
                req?.abort()
              } catch {
              }
              fail('too_many_redirects')
              return
            }
            try {
              req?.followRedirect()
            } catch {
            }
          })
        }

        for (const [key, value] of Object.entries(init.headers ?? {})) req.setHeader(key, value)
        if (init.body !== undefined && init.body !== '') req.write(init.body)

        req.on('response', (res) => {
          const chunks: Buffer[] = []
          let size = 0
          let stored = 0
          res.on('data', (c: Buffer) => {
            size += c.length
            if (stored < maxBytes) {
              chunks.push(c)
              stored += c.length
            }
          })
          res.on('end', () => {
            const status = res.statusCode
            finish({
              ok: status >= 200 && status < 400,
              status,
              headers: res.headers as Record<string, string | string[]>,
              body: Buffer.concat(chunks).toString('utf8'),
              redirects,
              finalUrl,
              sizeBytes: size,
            })
          })
        })

        req.on('error', (err) => fail(err.message))
        req.end()
      })
      .catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
  })
