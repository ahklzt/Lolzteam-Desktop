import type { ProxyEntry, ProxyProtocol } from '@lzt/shared'

export const proxyKey = (
  p: Pick<ProxyEntry, 'host' | 'port' | 'username' | 'password' | 'protocol'>,
): string => `${p.protocol ?? 'http'}://${p.host}:${p.port}:${p.username ?? ''}:${p.password ?? ''}`

const normalizeProtocol = (scheme: string): ProxyProtocol | null => {
  const s = scheme.toLowerCase()
  if (s === 'http') return 'http'
  if (s === 'https') return 'https'
  if (s === 'socks' || s === 'socks5' || s === 'socks5h') return 'socks5'
  if (s === 'socks4' || s === 'socks4a') return 'socks4'
  return null
}

const isPort = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 65535
}

const splitHostPort = (raw: string): { host: string; port: string } => {
  const clean = (raw.split('/')[0] ?? '').trim()
  const idx = clean.lastIndexOf(':')
  if (idx === -1) return { host: clean, port: '' }
  return { host: clean.slice(0, idx), port: clean.slice(idx + 1) }
}

const splitCreds = (raw: string): { username?: string; password?: string } => {
  const idx = raw.indexOf(':')
  if (idx === -1) return raw ? { username: raw } : {}
  const username = raw.slice(0, idx)
  const password = raw.slice(idx + 1)
  return {
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  }
}

export const parseProxyLine = (line: string): Omit<ProxyEntry, 'id'> | null => {
  let rest = line.trim()
  if (!rest || rest.startsWith('#') || rest.startsWith('//')) return null

  let protocol: ProxyProtocol = 'http'
  const schemeMatch = /^([a-z][a-z0-9]*):\/\//i.exec(rest)
  if (schemeMatch?.[1]) {
    const proto = normalizeProtocol(schemeMatch[1])
    if (proto) {
      protocol = proto
      rest = rest.slice(schemeMatch[0].length)
    }
  }

  let host = ''
  let portRaw = ''
  let username: string | undefined
  let password: string | undefined

  const at = rest.lastIndexOf('@')
  if (at !== -1) {
    const left = rest.slice(0, at)
    const right = rest.slice(at + 1)
    const hpRight = splitHostPort(right)
    if (isPort(hpRight.port)) {
      host = hpRight.host
      portRaw = hpRight.port
      const creds = splitCreds(left)
      username = creds.username
      password = creds.password
    } else {
      const hpLeft = splitHostPort(left)
      host = hpLeft.host
      portRaw = hpLeft.port
      const creds = splitCreds(right)
      username = creds.username
      password = creds.password
    }
  } else {
    const parts = rest.replace(/[\s|,;]+/g, ':').split(':')
    host = parts[0] ?? ''
    portRaw = parts[1] ?? ''
    username = parts[2]
    password = parts.length > 3 ? parts.slice(3).join(':') : undefined
  }

  const port = Number(portRaw)
  if (!host || !isPort(portRaw) || !Number.isInteger(port)) return null

  return {
    protocol,
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  }
}
