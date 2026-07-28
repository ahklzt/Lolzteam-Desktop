import type {
  AccountLoginMethod,
  AccountLoginService,
  LoginProgress,
  MarketItem,
  ModeratorSettings,
  ProxyEntry,
} from '@lzt/shared'


export interface AdapterLogger {
  debug: (msg: string, meta?: unknown) => void
  info: (msg: string, meta?: unknown) => void
  warn: (msg: string, meta?: unknown) => void
  error: (msg: string, meta?: unknown) => void
}

export interface AppPaths {
  userData: string
  logs: string
  temp: string
}

export type ProbeResult = { available: true } | { available: false; reason: string }

export interface LoginResult {
  ok: boolean
  method: AccountLoginMethod
  message?: string
  launchedPid?: number
  windowId?: number
}

export interface AccountLoginDetails {
  itemId: number
  service: AccountLoginService | null
  categoryTitle: string
  item: MarketItem
}

export interface AdapterContext {
  log: AdapterLogger
  paths: AppPaths
  abortSignal: AbortSignal
  onProgress?: (event: LoginProgress) => void
  fetchEmailCode?: (itemId: number) => Promise<string | null>
  fetchSteamMafile?: (itemId: number) => Promise<string | null>
  settings?: ModeratorSettings
  proxy?: ProxyEntry
}

export interface ServiceAdapter {
  readonly id: AccountLoginService
  readonly displayName: string
  readonly platforms: readonly NodeJS.Platform[]
  readonly methods: readonly AccountLoginMethod[]
  probe(method: AccountLoginMethod, ctx: AdapterContext): Promise<ProbeResult>
  login(
    method: AccountLoginMethod,
    account: AccountLoginDetails,
    ctx: AdapterContext,
  ): Promise<LoginResult>
}
