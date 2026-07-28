import type { MarketItem } from '@lzt/shared'
import type { AccountLoginDetails } from '../contract'

export interface SteamCreds {
  login: string
  password: string
  sharedSecret: string | null
}

const str = (item: Record<string, unknown>, key: string): string | null => {
  const v = item[key]
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

const LOGIN_KEYS = [
  'login_original',
  'account_login',
  'steam_login',
  'steam_username',
  'account_name',
  'username',
  'login',
] as const

const PASSWORD_KEYS = [
  'password_original',
  'account_password',
  'steam_password',
  'password',
] as const

const nestedOf = (item: MarketItem): Record<string, unknown> | null => {
  for (const k of ['loginData', 'login_data', 'account_data'] as const) {
    const v = (item as Record<string, unknown>)[k]
    if (v && typeof v === 'object') return v as Record<string, unknown>
  }
  return null
}

export const extractSteamCreds = (details: AccountLoginDetails): SteamCreds | null => {
  const { item } = details
  const nested = nestedOf(item)
  const pick = (keys: readonly string[]): string | null => {
    for (const key of keys) {
      if (nested) {
        const nv = nested[key]
        if (typeof nv === 'string' && nv.trim().length > 0) return nv.trim()
      }
      const flat = str(item as Record<string, unknown>, key)
      if (flat) return flat
    }
    return null
  }
  const login = pick(LOGIN_KEYS)
  const password = pick(PASSWORD_KEYS)
  if (!login || !password) return null
  return { login, password, sharedSecret: null }
}
