
export const totpBase32Decode = (input: string): Uint8Array | null => {
  const s = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[\s-]+/g, '')
  if (!s) return null
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (let i = 0; i < s.length; i++) {
    const idx = alphabet.indexOf(s.charAt(i))
    if (idx < 0) return null
    bits += `00000${idx.toString(2)}`.slice(-5)
  }
  const out = new Uint8Array(Math.floor(bits.length / 8))
  for (let j = 0, p = 0; j + 8 <= bits.length; j += 8, p++) {
    out[p] = Number.parseInt(bits.substr(j, 8), 2)
  }
  return out.length > 0 ? out : null
}

export const totpCompute = async (secretBytes: Uint8Array, epochSec: number): Promise<string> => {
  const step = Math.floor(epochSec / 30)
  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  dv.setUint32(0, Math.floor(step / 0x100000000))
  dv.setUint32(4, step >>> 0)
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
  const off = (sig[19] ?? 0) & 0x0f
  const code =
    (((sig[off] ?? 0) & 0x7f) << 24) |
    ((sig[off + 1] ?? 0) << 16) |
    ((sig[off + 2] ?? 0) << 8) |
    (sig[off + 3] ?? 0)
  let s = String(code % 1000000)
  while (s.length < 6) s = `0${s}`
  return s
}

export const b64EncodeUtf8 = (str: string): string => {
  const bytes = new TextEncoder().encode(String(str))
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export const b64DecodeUtf8 = (b64: string): string => {
  let s = String(b64 || '').replace(/\s+/g, '')
  if (s === '') throw new Error('empty')
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4 !== 0) s += '='
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('not_base64')
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export interface CookieFormatResult {
  fmt: '' | 'json' | 'netscape' | 'string' | 'unknown'
  label: string
  note: string
}

export const detectCookieFormat = (raw: string): CookieFormatResult => {
  const t = String(raw || '').trim()
  if (t === '') return { fmt: '', label: '', note: '' }

  try {
    const j = JSON.parse(t) as unknown
    if (Array.isArray(j)) {
      const first = j[0] as Record<string, unknown> | undefined
      const looks =
        j.length > 0 &&
        !!first &&
        typeof first === 'object' &&
        Object.prototype.hasOwnProperty.call(first, 'name') &&
        Object.prototype.hasOwnProperty.call(first, 'value')
      return {
        fmt: 'json',
        label: 'JSON',
        note: looks
          ? `Массив cookie-объектов (name/value), элементов: ${j.length}`
          : `Корректный JSON-массив, элементов: ${j.length}`,
      }
    }
    if (j && typeof j === 'object') {
      return { fmt: 'json', label: 'JSON', note: `Корректный JSON-объект, ключей: ${Object.keys(j).length}` }
    }
    return { fmt: 'json', label: 'JSON', note: 'Корректное JSON-значение' }
  } catch {
  }

  const lines = t.split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = /^#\s*(Netscape\s+)?HTTP\s+Cookie\s+File/i.test(t)
  let tabRows = 0
  let dataRows = 0
  for (const ln of lines) {
    if (ln.charAt(0) === '#') continue
    dataRows++
    const cols = ln.split('\t')
    if (cols.length >= 6 && cols.length <= 7) tabRows++
  }
  if (header || (dataRows > 0 && tabRows / dataRows >= 0.6)) {
    return {
      fmt: 'netscape',
      label: 'Netscape',
      note: `Табличный формат Netscape/curl (домен, флаги, путь, secure, срок, имя, значение). Строк-cookie: ${tabRows}`,
    }
  }

  const pairs = t
    .replace(/\r?\n/g, '; ')
    .split(/;\s*/)
    .filter((p) => p.trim() !== '')
  let okPairs = 0
  for (const p of pairs) {
    if (/^[^=;\s][^=]*=.*$/.test(p.trim())) okPairs++
  }
  if (pairs.length > 0 && okPairs / pairs.length >= 0.6) {
    return {
      fmt: 'string',
      label: 'Строка name=value',
      note: `Формат заголовка Cookie: пары name=value через «; ». Найдено пар: ${okPairs}`,
    }
  }

  return {
    fmt: 'unknown',
    label: 'Не распознан',
    note: 'Не удалось однозначно определить формат — проверьте данные.',
  }
}

export const toolUnescape = (s: string): string =>
  String(s).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')

export interface NetscapeCookie {
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  session: boolean
  expirationDate: number | null
  name: string
  value: string
}

export const parseNetscapeCookies = (raw: string): NetscapeCookie[] => {
  const lines = String(raw || '').split(/\r?\n/)
  const out: NetscapeCookie[] = []
  for (const line of lines) {
    if (line == null) continue
    let httpOnly = false
    let t = line
    if (t.indexOf('#HttpOnly_') === 0) {
      httpOnly = true
      t = t.slice(10)
    }
    const head = t.replace(/^\s+/, '')
    if (head === '' || head.charAt(0) === '#') continue
    const f = t.split('\t')
    if (f.length < 7) continue
    const domain = f[0] ?? ''
    const secure = String(f[3] ?? '').toUpperCase() === 'TRUE'
    let expiry = Number.parseInt(f[4] ?? '', 10)
    if (Number.isNaN(expiry)) expiry = 0
    out.push({
      domain,
      hostOnly: domain.charAt(0) !== '.',
      path: f[2] ?? '',
      secure,
      httpOnly,
      session: expiry === 0,
      expirationDate: expiry === 0 ? null : expiry,
      name: f[5] ?? '',
      value: f.slice(6).join('\t'),
    })
  }
  return out
}
