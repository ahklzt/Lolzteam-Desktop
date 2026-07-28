import type { AccountLoginMethod } from '@lzt/shared'
import type { LoginResult } from '../contract'

export const failLogin = (
  message: string,
  method: AccountLoginMethod = 'native',
): LoginResult => ({
  ok: false,
  method,
  message,
})
