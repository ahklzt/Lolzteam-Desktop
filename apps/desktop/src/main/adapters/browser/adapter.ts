import type { AccountLoginService } from '@lzt/shared'
import type {
  AccountLoginDetails,
  AccountLoginMethod,
  AdapterContext,
  LoginResult,
  ProbeResult,
  ServiceAdapter,
} from '../contract'
import { failLogin as fail } from '../_shared/fail'
import { accountLabel, extractBrowserLogin } from './extract'
import { injectCookies, openBrowserWindow } from './window'

const createBrowserAdapter = (id: AccountLoginService, displayName: string): ServiceAdapter => ({
  id,
  displayName,
  platforms: ['win32', 'darwin', 'linux'] as const,
  methods: ['web'] as const,

  async probe(method: AccountLoginMethod): Promise<ProbeResult> {
    if (method !== 'web') {
      return { available: false, reason: 'Поддерживается только вход через браузер' }
    }
    return { available: true }
  },

  async login(
    method: AccountLoginMethod,
    account: AccountLoginDetails,
    ctx: AdapterContext,
  ): Promise<LoginResult> {
    if (method !== 'web') return fail('Поддерживается только вход через браузер', method)
    if (ctx.abortSignal.aborted) return fail('Вход отменён', method)

    const data = extractBrowserLogin(account)
    if (!data) {
      ctx.log.warn(`[browser] no cookies for #${account.itemId} (${account.categoryTitle})`)
      return fail('У этого аккаунта нет cookie для входа через браузер', method)
    }

    const partition = `persist:lzt-account-${account.itemId}`
    ctx.onProgress?.({ step: 'injecting-cookies' })
    ctx.log.info(`[browser] injecting ${data.cookies.length} cookie(s) for #${account.itemId}`)
    await injectCookies(partition, data.cookies, ctx)

    if (ctx.abortSignal.aborted) return fail('Вход отменён', method)

    const label = accountLabel(account)
    ctx.onProgress?.({ step: 'launching-browser' })
    ctx.log.info(`[browser] opening ${data.landingUrl}`)
    const { windowId } = openBrowserWindow(
      partition,
      data.landingUrl,
      `${displayName} — ${label}`,
      ctx,
    )

    return {
      ok: true,
      method,
      windowId,
      message: `${displayName} открыт под аккаунтом ${label}`,
    }
  },
})

export const tiktokAdapter = createBrowserAdapter('tiktok', 'TikTok')
export const instagramAdapter = createBrowserAdapter('instagram', 'Instagram')
