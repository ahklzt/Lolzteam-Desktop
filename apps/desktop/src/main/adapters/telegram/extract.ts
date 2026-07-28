import type { AccountLoginDetails } from '../contract'

export interface TelegramAuthKey {
  authKeyHex: string
  dcId: number
}

export interface TelegramCreds {
  phone: string
  password: string | null
  apiId: number | null
  apiHash: string | null
  authKey: TelegramAuthKey | null
  userId: number | null
  deviceModel: string | null
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

const PHONE_KEYS = ['telegram_phone', 'account_phone', 'phone'] as const

const PASSWORD_KEYS = ['telegram_password_value', 'twoFa', 'two_fa'] as const

const pickFromKeys = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const k of keys) {
    const found = asString(source[k])
    if (found) return found
  }
  return null
}

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? `+${digits}` : raw
}

const isPlausiblePhone = (phone: string): boolean => {
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

interface TelegramJsonShape {
  app_id?: unknown
  app_hash?: unknown
  twoFA?: unknown
  phone?: unknown
  dc_id?: unknown
  device?: unknown
}

interface LoginDataShape {
  raw?: unknown
  encodedRaw?: unknown
  login?: unknown
  password?: unknown
}

const pickTelegramJson = (secrets: Record<string, unknown>): TelegramJsonShape | null => {
  const tj = secrets.telegram_json
  if (tj && typeof tj === 'object') return tj as TelegramJsonShape
  return null
}

const pickLoginData = (secrets: Record<string, unknown>): LoginDataShape | null => {
  const ld = (secrets as Record<string, unknown>).loginData
  if (ld && typeof ld === 'object') return ld as LoginDataShape
  return null
}

const HEX_256_BYTES = 256 * 2
const isHexOfLen = (s: string, len: number): boolean =>
  s.length === len && /^[0-9a-fA-F]+$/.test(s)

const toPositiveInt = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isInteger(n) && n > 0) return n
  }
  return null
}

const PROD_DC_RANGE = [1, 2, 3, 4, 5] as const
const isProdDcId = (dcId: number): boolean =>
  PROD_DC_RANGE.includes(dcId as (typeof PROD_DC_RANGE)[number])

const parseAuthKeyRaw = (raw: string, fallbackDcId: number | null): TelegramAuthKey | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const sep = trimmed.lastIndexOf(':')
  if (sep > 0) {
    const hex = trimmed.slice(0, sep)
    const tail = trimmed.slice(sep + 1)
    const dcId = toPositiveInt(tail)
    if (isHexOfLen(hex, HEX_256_BYTES) && dcId !== null && isProdDcId(dcId)) {
      return { authKeyHex: hex.toLowerCase(), dcId }
    }
    return null
  }

  if (isHexOfLen(trimmed, HEX_256_BYTES) && fallbackDcId !== null && isProdDcId(fallbackDcId)) {
    return { authKeyHex: trimmed.toLowerCase(), dcId: fallbackDcId }
  }
  return null
}

const extractAuthKey = (
  secrets: Record<string, unknown>,
  tj: TelegramJsonShape | null,
): TelegramAuthKey | null => {
  const ld = pickLoginData(secrets)
  const rawCandidate = asString(ld?.raw)
  if (!rawCandidate) return null

  const tjDc = toPositiveInt(tj?.dc_id)
  const secretDc = toPositiveInt((secrets as Record<string, unknown>).telegram_dc_id)
  const fallbackDc = tjDc ?? secretDc ?? null

  return parseAuthKeyRaw(rawCandidate, fallbackDc)
}

export const extractTelegramCreds = (details: AccountLoginDetails): TelegramCreds | null => {
  const secrets = details.item as Record<string, unknown>
  const tj = pickTelegramJson(secrets)

  const phoneRaw = pickFromKeys(secrets, PHONE_KEYS) ?? asString(tj?.phone)
  const password = pickFromKeys(secrets, PASSWORD_KEYS) ?? asString(tj?.twoFA)
  const apiId = typeof tj?.app_id === 'number' ? tj.app_id : null
  const apiHash = asString(tj?.app_hash)
  const authKey = extractAuthKey(secrets, tj)
  const userId = toPositiveInt(secrets.telegram_id)
  const deviceModel = asString(tj?.device)

  if (!phoneRaw && !authKey) return null

  const phone = phoneRaw ? normalizePhone(phoneRaw) : ''
  if (phoneRaw && !isPlausiblePhone(phone)) {
    if (!authKey) return null
    return { phone: '', password, apiId, apiHash, authKey, userId, deviceModel }
  }

  return { phone, password, apiId, apiHash, authKey, userId, deviceModel }
}
