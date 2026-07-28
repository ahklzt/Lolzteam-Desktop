import type { AccountLoginDetails } from '../contract'

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

export const extractDiscordToken = (details: AccountLoginDetails): string | null => {
  const secrets = details.item as Record<string, unknown>
  const direct = asString(secrets.login)
  if (direct) return direct

  const ld = secrets.loginData
  if (ld && typeof ld === 'object') {
    const fromLoginData = asString((ld as { login?: unknown }).login)
    if (fromLoginData) return fromLoginData
  }
  return asString(secrets.account_login)
}
