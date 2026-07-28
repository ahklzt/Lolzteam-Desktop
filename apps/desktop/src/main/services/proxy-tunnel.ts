import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect as netConnect, type Socket } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

export interface ProxyTarget {
  host: string
  port: number
  username?: string
  password?: string
}

export interface ProxyFetchInit {
  method?: string
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface ProxyFetchResult {
  ok: boolean
  status: number
  body: string
  headers: Record<string, string | string[] | undefined>
  error?: string
}

const authHeader = (proxy: ProxyTarget): string | null =>
  proxy.username
    ? `Basic ${Buffer.from(`${proxy.username}:${proxy.password ?? ''}`).toString('base64')}`
    : null

const openTunnel = (
  proxy: ProxyTarget,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<Socket> =>
  new Promise<Socket>((resolve, reject) => {
    const socket = netConnect({ host: proxy.host, port: proxy.port })
    let settled = false
    const fail = (message: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      reject(new Error(message))
    }
    const timer = setTimeout(() => fail('proxy_connect_timeout'), timeoutMs)

    socket.once('error', (err) => fail(err.message))
    socket.once('connect', () => {
      const lines = [`CONNECT ${host}:${port} HTTP/1.1`, `Host: ${host}:${port}`]
      const auth = authHeader(proxy)
      if (auth) lines.push(`Proxy-Authorization: ${auth}`)
      lines.push('Connection: keep-alive', '', '')
      socket.write(lines.join('\r\n'))
    })

    let buffer = Buffer.alloc(0)
    const onData = (chunk: Buffer): void => {
      buffer = Buffer.concat([buffer, chunk])
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
      socket.removeListener('data', onData)
      const statusLine = buffer.subarray(0, buffer.indexOf('\r\n')).toString('utf8').trim()
      const statusCode = Number.parseInt(statusLine.split(' ')[1] ?? '', 10)
      if (statusCode !== 200) {
        fail(`CONNECT: ${statusLine || 'no response'}`)
        return
      }
      clearTimeout(timer)
      settled = true
      socket.removeListener('error', fail)
      resolve(socket)
    }
    socket.on('data', onData)
  })

const collect = (res: IncomingMessage, finish: (result: ProxyFetchResult) => void): void => {
  const chunks: Buffer[] = []
  res.on('data', (c: Buffer) => chunks.push(c))
  res.on('end', () => {
    const status = res.statusCode ?? 0
    finish({
      ok: status >= 200 && status < 400,
      status,
      body: Buffer.concat(chunks).toString('utf8'),
      headers: res.headers,
    })
  })
}

export const proxyFetch = (
  url: string,
  proxy: ProxyTarget,
  init: ProxyFetchInit = {},
): Promise<ProxyFetchResult> =>
  new Promise<ProxyFetchResult>((resolve) => {
    const timeoutMs = init.timeoutMs ?? 20_000
    let target: URL
    try {
      target = new URL(url)
    } catch {
      resolve({ ok: false, status: 0, body: '', headers: {}, error: 'bad_url' })
      return
    }
    const method = init.method ?? 'GET'
    const baseHeaders = init.headers ?? {}

    let settled = false
    let socketRef: Socket | null = null
    const finish = (result: ProxyFetchResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socketRef?.destroy()
      } catch {
      }
      resolve(result)
    }
    const fail = (error: string): void =>
      finish({ ok: false, status: 0, body: '', headers: {}, error })
    const timer = setTimeout(() => fail('timeout'), timeoutMs)

    if (target.protocol === 'http:') {
      const auth = authHeader(proxy)
      const req = httpRequest(
        {
          host: proxy.host,
          port: proxy.port,
          method,
          path: url,
          headers: {
            Host: target.host,
            ...baseHeaders,
            ...(auth ? { 'Proxy-Authorization': auth } : {}),
          },
        },
        (res) => collect(res, finish),
      )
      req.on('error', (err) => fail(err.message))
      req.end()
      return
    }

    const port = target.port ? Number(target.port) : 443
    openTunnel(proxy, target.hostname, port, timeoutMs)
      .then((socket) => {
        if (settled) {
          socket.destroy()
          return
        }
        socketRef = socket
        const req = httpsRequest(
          url,
          {
            method,
            agent: false,
            createConnection: () => tlsConnect({ socket, servername: target.hostname }),
            headers: baseHeaders,
          },
          (res) => collect(res, finish),
        )
        req.on('error', (err) => fail(err.message))
        req.end()
      })
      .catch((err: Error) => fail(err.message))
  })
