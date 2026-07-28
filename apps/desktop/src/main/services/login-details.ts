import type { AccountLoginService, MarketItem } from '@lzt/shared'
import type { AccountLoginDetails } from '../adapters/contract'
import { getAccount } from './market-api'

const SERVICE_BY_KEY: Record<string, AccountLoginService> = {
  steam: 'steam',
  telegram: 'telegram',
  tiktok: 'tiktok',
  instagram: 'instagram',
  discord: 'discord',
  llm: 'llm',
  chatgpt: 'llm',
  claude: 'llm',
  gemini: 'llm',
  grok: 'llm',
  cursor: 'llm',
  perplexity: 'llm',
}

const STEAM_CATEGORY_ID = 1

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const serviceFor = (item: MarketItem): AccountLoginService | null => {
  const key = (str(item['category_name']) || str(item['category_title']))
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  const mapped = SERVICE_BY_KEY[key]
  if (mapped) return mapped
  if (item.category_id === STEAM_CATEGORY_ID) return 'steam'
  return null
}

export const getAccountLoginDetails = async (
  itemId: number,
): Promise<AccountLoginDetails | null> => {
  const res = await getAccount(itemId)
  if (!res.ok) return null
  const { item } = res
  const categoryTitle = str(item['category_title']) || str(item['category_name'])
  return { itemId, service: serviceFor(item), categoryTitle, item }
}
