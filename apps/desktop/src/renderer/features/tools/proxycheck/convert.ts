
const SCHEME_HTTP = `http${'://'}`
const SCHEME_HTTPS = `https${'://'}`
const SCHEME_SOCKS5 = `socks5${'://'}`

export interface ParsedProxy {
  host: string
  port: number
  username?: string
  password?: string
}

export type ConvertFormat =
  | 'ip_port'
  | 'login_pass_at'
  | 'ip_port_login_pass'
  | 'login_pass_ip_port'
  | 'http'
  | 'https'
  | 'socks5'
  | 'tg'

export const CONVERT_FORMATS: ConvertFormat[] = [
  'ip_port',
  'login_pass_at',
  'ip_port_login_pass',
  'login_pass_ip_port',
  'http',
  'https',
  'socks5',
  'tg',
]

const isPort = (s: string): boolean => {
  const n = Number(s)
  return Number.isInteger(n) && n > 0 && n <= 65535
}

const build = (
  host: string,
  portStr: string,
  username?: string,
  password?: string,
): ParsedProxy | null => {
  if (!host || !isPort(portStr)) return null
  const p: ParsedProxy = { host, port: Number(portStr) }
  if (username) p.username = username
  if (username && password !== undefined) p.password = password
  return p
}

const splitOnce = (s: string, sep: string): [string, string] => {
  const i = s.indexOf(sep)
  if (i < 0) return [s, '']
  return [s.slice(0, i), s.slice(i + sep.length)]
}

export const parseAnyProxy = (raw: string): ParsedProxy | null => {
  const line = raw.trim()
  if (!line) return null

  if (/^tg:\/\//i.test(line)) {
    const qi = line.indexOf('?')
    if (qi < 0) return null
    const params = new URLSearchParams(line.slice(qi + 1))
    const host = params.get('server') ?? ''
    const portStr = params.get('port') ?? ''
    const username = params.get('user') ?? undefined
    const password = params.get('pass') ?? undefined
    return build(host, portStr, username || undefined, password ?? undefined)
  }

  const s = line.replace(/^(socks5|socks4|socks|https|http):\/\//i, '')

  if (s.includes('@')) {
    const [a, b] = splitOnce(s, '@')
    const left = a.split(':')
    const right = b.split(':')
    if (right.length >= 2 && isPort(right[1] ?? '')) {
      const username = left[0] ?? ''
      const password = left.length > 1 ? left.slice(1).join(':') : ''
      return build(right[0] ?? '', right[1] ?? '', username || undefined, password)
    }
    if (left.length >= 2 && isPort(left[1] ?? '')) {
      const username = right[0] ?? ''
      const password = right.length > 1 ? right.slice(1).join(':') : ''
      return build(left[0] ?? '', left[1] ?? '', username || undefined, password)
    }
    return null
  }

  const parts = s.split(':')
  if (parts.length === 2) return build(parts[0] ?? '', parts[1] ?? '')
  if (parts.length === 3 && isPort(parts[1] ?? '')) {
    return build(parts[0] ?? '', parts[1] ?? '', parts[2] ?? undefined, '')
  }
  if (parts.length >= 4) {
    if (isPort(parts[1] ?? '')) {
      const password = parts.slice(3).join(':')
      return build(parts[0] ?? '', parts[1] ?? '', parts[2] ?? '', password)
    }
    const last = parts[parts.length - 1] ?? ''
    if (isPort(last)) {
      const host = parts[parts.length - 2] ?? ''
      const username = parts[0] ?? ''
      const password = parts.slice(1, parts.length - 2).join(':')
      return build(host, last, username || undefined, password)
    }
  }
  return null
}

export const formatProxy = (p: ParsedProxy, fmt: ConvertFormat): string => {
  const auth = p.username ? `${p.username}:${p.password ?? ''}` : ''
  const hp = `${p.host}:${p.port}`
  switch (fmt) {
    case 'ip_port':
      return hp
    case 'login_pass_at':
      return auth ? `${auth}@${hp}` : hp
    case 'ip_port_login_pass':
      return auth ? `${hp}:${auth}` : hp
    case 'login_pass_ip_port':
      return auth ? `${auth}:${hp}` : hp
    case 'http':
      return auth ? `${SCHEME_HTTP}${auth}@${hp}` : `${SCHEME_HTTP}${hp}`
    case 'https':
      return auth ? `${SCHEME_HTTPS}${auth}@${hp}` : `${SCHEME_HTTPS}${hp}`
    case 'socks5':
      return auth ? `${SCHEME_SOCKS5}${auth}@${hp}` : `${SCHEME_SOCKS5}${hp}`
    case 'tg': {
      const params = new URLSearchParams()
      params.set('server', p.host)
      params.set('port', String(p.port))
      if (p.username) params.set('user', p.username)
      if (p.password) params.set('pass', p.password)
      return `tg://socks?${params.toString()}`
    }
  }
}

export const downloadText = (filename: string, text: string, mime = 'text/plain'): void => {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
