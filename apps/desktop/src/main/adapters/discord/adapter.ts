import type {
  AccountLoginDetails,
  AccountLoginMethod,
  AdapterContext,
  LoginResult,
  ProbeResult,
  ServiceAdapter,
} from '../contract'
import { failLogin as fail } from '../_shared/fail'
import { accountLabel } from '../browser/extract'
import { injectCookies, openBrowserWindow } from '../browser/window'
import { extractDiscordToken } from './extract'

const LOGIN_URL = 'https://discord.com/login'
const APP_URL = 'https://discord.com/channels/@me'

const buildInjectionScript = (token: string): string => {
  const json = JSON.stringify(JSON.stringify(token))
  return `(() => {
    try {
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      iframe.contentWindow.localStorage.setItem('token', ${json});
      iframe.remove();
      return true;
    } catch (e) {
      try {
        window.localStorage.setItem('token', ${json});
        return true;
      } catch (_) {
        return false;
      }
    }
  })()`
}

export const discordAdapter: ServiceAdapter = {
  id: 'discord',
  displayName: 'Discord',
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

    const token = extractDiscordToken(account)
    if (!token) {
      ctx.log.warn(`[discord] no token for #${account.itemId} (${account.categoryTitle})`)
      return fail('У этого аккаунта нет токена для входа в Discord', method)
    }

    const partition = `persist:lzt-account-${account.itemId}`
    await injectCookies(partition, [], ctx)

    if (ctx.abortSignal.aborted) return fail('Вход отменён', method)

    const label = accountLabel(account)
    ctx.onProgress?.({ step: 'injecting-token' })
    ctx.log.info(`[discord] opening Discord for #${account.itemId}`)

    let injected = false
    const { windowId } = openBrowserWindow(partition, LOGIN_URL, `Discord — ${label}`, ctx, {
      onEachLoad: (site) => {
        if (injected) return
        injected = true
        site
          .executeJavaScript(buildInjectionScript(token), true)
          .then((ok: unknown) => {
            ctx.log.info(`[discord] token injected (${ok ? 'ok' : 'fallback failed'}), entering app`)
            ctx.onProgress?.({ step: 'launching-browser' })
            return site.loadURL(APP_URL)
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            ctx.log.warn(`[discord] token injection failed: ${msg}`)
          })
      },
    })

    return {
      ok: true,
      method,
      windowId,
      message: `Discord открыт под аккаунтом ${label}`,
    }
  },
}
