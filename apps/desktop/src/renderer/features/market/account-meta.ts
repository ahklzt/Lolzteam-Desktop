import type { MarketItem } from '@lzt/shared'

export type LoginService =
  | 'steam'
  | 'telegram'
  | 'tiktok'
  | 'instagram'
  | 'discord'
  | 'llm'

const SERVICE_BY_KEY: Record<string, LoginService> = {
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

export const loginServiceFor = (
  slug?: string,
  categoryName?: string,
  categoryId?: number,
): LoginService | null => {
  const key = (slug || categoryName || '').toLowerCase().replace(/[^a-z]/g, '')
  if (SERVICE_BY_KEY[key]) return SERVICE_BY_KEY[key]
  if (categoryId === STEAM_CATEGORY_ID) return 'steam'
  return null
}

export type ChipTone = 'green' | 'red' | 'neutral'

export interface MetaChip {
  id: string
  label: string
  tone: ChipTone
}

export interface UserTag {
  id: number
  title: string
  color: string | null
}

const toneFor = (label: string): ChipTone => {
  const t = label.toLowerCase()
  if (/vac|ban|бан|блок|spam|спам|ограни|limit|украд|заблок/.test(t)) return 'red'
  if (/гарант|guarantee|валид|valid|premium|премиум/.test(t)) return 'green'
  return 'neutral'
}

const tagEntries = (item: MarketItem): unknown[] => {
  const out: unknown[] = []
  const push = (raw: unknown) => {
    if (Array.isArray(raw)) out.push(...raw)
    else if (raw && typeof raw === 'object') out.push(...Object.values(raw as Record<string, unknown>))
  }
  push(item.tags as unknown)
  push(item['public_tags'])
  return out
}

const tagId = (entry: unknown): number | null => {
  if (!entry || typeof entry !== 'object') return null
  const raw = (entry as Record<string, unknown>).tag_id
  return typeof raw === 'number' ? raw : null
}

const tagTitle = (entry: Record<string, unknown>): string => {
  if (typeof entry.title === 'string') return entry.title.trim()
  if (typeof entry.name === 'string') return entry.name.trim()
  return ''
}

export const metaChips = (item: MarketItem): MetaChip[] => {
  const out: MetaChip[] = []
  const seen = new Set<string>()
  tagEntries(item).forEach((entry, i) => {
    if (tagId(entry) !== null) return
    let label = ''
    if (typeof entry === 'string') label = entry.trim()
    else if (entry && typeof entry === 'object') label = tagTitle(entry as Record<string, unknown>)
    if (!label || seen.has(label)) return
    seen.add(label)
    out.push({ id: `c${i}`, label, tone: toneFor(label) })
  })
  return out
}

export const userTags = (item: MarketItem): UserTag[] => {
  const out: UserTag[] = []
  const seen = new Set<number>()
  for (const entry of tagEntries(item)) {
    const id = tagId(entry)
    if (id === null || seen.has(id)) continue
    const o = entry as Record<string, unknown>
    const title = tagTitle(o)
    if (!title) continue
    seen.add(id)
    const bc = typeof o.bc === 'string' ? o.bc.trim() : ''
    out.push({ id, title, color: bc || null })
  }
  return out
}

export interface SteamGameMeta {
  appId: number
  parentGameId: number
  title: string
  hours: number
  iconUrl: string
}

const STEAM_ICON_BASE = 'https://nztcdn.com/steam/icon'

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}

export const steamGames = (item: MarketItem, limit = 8): SteamGameMeta[] => {
  const full = item['steam_full_games']
  const listRaw =
    full && typeof full === 'object'
      ? (full as Record<string, unknown>)['list']
      : null
  const records: unknown[] = Array.isArray(listRaw)
    ? listRaw
    : listRaw && typeof listRaw === 'object'
      ? Object.values(listRaw as Record<string, unknown>)
      : []
  const games: SteamGameMeta[] = []
  for (const r of records) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const appId = num(o.appid) ?? num(o.appId) ?? 0
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!appId || !title) continue
    const parentGameId = num(o.parentGameId) ?? appId
    games.push({
      appId,
      parentGameId,
      title,
      hours: Math.round(num(o.playtime_forever) ?? 0),
      iconUrl: `${STEAM_ICON_BASE}/${parentGameId}.webp`,
    })
  }
  games.sort((a, b) => b.hours - a.hours)
  return games.slice(0, limit)
}

export const purchasedAt = (item: MarketItem): number | null => {
  const buyer = item['buyer']
  if (buyer && typeof buyer === 'object') {
    const od = num((buyer as Record<string, unknown>)['operation_date'])
    if (od) return od
  }
  return (
    num(item['purchased']) ??
    num(item['purchase_date']) ??
    num(item['item_bought_at']) ??
    null
  )
}

export const emailCredentials = (item: MarketItem): string | null => {
  const pick = (v: unknown): { login?: string; password?: string; raw?: string } | null =>
    v && typeof v === 'object' ? (v as Record<string, string>) : null
  const emailData = pick(item['emailLoginData']) ?? pick(item['email_login_data'])
  if (emailData) {
    if (typeof emailData.raw === 'string' && emailData.raw.includes(':')) return emailData.raw
    if (emailData.login && emailData.password) return `${emailData.login}:${emailData.password}`
  }
  const str = (key: string): string | null => {
    const v = item[key]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const login = str('account_login') ?? str('login') ?? str('email')
  const password = str('account_password') ?? str('password') ?? str('email_password')
  if (login && password) return `${login}:${password}`
  return null
}
