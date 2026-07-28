import type { AccountLoginService } from '@lzt/shared'
import type { ServiceAdapter } from './contract'
import { steamAdapter } from './steam/adapter'
import { telegramAdapter } from './telegram/adapter'
import { instagramAdapter, tiktokAdapter } from './browser/adapter'
import { discordAdapter } from './discord/adapter'
import { llmAdapter } from './llm/adapter'

const REGISTRY: Partial<Record<AccountLoginService, ServiceAdapter>> = {
  steam: steamAdapter,
  telegram: telegramAdapter,
  tiktok: tiktokAdapter,
  instagram: instagramAdapter,
  discord: discordAdapter,
  llm: llmAdapter,
}

export const getAdapter = (id: AccountLoginService | null): ServiceAdapter | null =>
  id ? (REGISTRY[id] ?? null) : null

export const listAdapters = (): readonly ServiceAdapter[] =>
  Object.values(REGISTRY).filter((a): a is ServiceAdapter => Boolean(a))
