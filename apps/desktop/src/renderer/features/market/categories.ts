import { MARKET_ICONS } from './market-icons'

export interface MarketCategoryDef {
  slug: string
  label: string
  iconUrl?: string
}

export const MARKET_CATEGORIES: MarketCategoryDef[] = [
  { slug: '', label: '\u0412\u0441\u0435' },
  { slug: 'steam', label: 'Steam', iconUrl: MARKET_ICONS.steam },
  { slug: 'fortnite', label: 'Fortnite', iconUrl: MARKET_ICONS.fortnite },
  { slug: 'riot', label: 'Riot', iconUrl: MARKET_ICONS.riot },
  { slug: 'telegram', label: 'Telegram', iconUrl: MARKET_ICONS.telegram },
  { slug: 'supercell', label: 'Supercell', iconUrl: MARKET_ICONS.supercell },
  { slug: 'gifts', label: 'Gifts', iconUrl: MARKET_ICONS.gifts },
  { slug: 'epicgames', label: 'Epic Games', iconUrl: MARKET_ICONS.epicgames },
  {
    slug: 'escape-from-tarkov',
    label: 'Escape from Tarkov',
    iconUrl: MARKET_ICONS['escape-from-tarkov'],
  },
  { slug: 'socialclub', label: 'Social Club', iconUrl: MARKET_ICONS.socialclub },
  { slug: 'uplay', label: 'Uplay', iconUrl: MARKET_ICONS.uplay },
  { slug: 'discord', label: 'Discord', iconUrl: MARKET_ICONS.discord },
  { slug: 'tiktok', label: 'TikTok', iconUrl: MARKET_ICONS.tiktok },
  { slug: 'instagram', label: 'Instagram', iconUrl: MARKET_ICONS.instagram },
  { slug: 'battlenet', label: 'BattleNet', iconUrl: MARKET_ICONS.battlenet },
  { slug: 'chatgpt', label: 'LLM', iconUrl: MARKET_ICONS.chatgpt },
  { slug: 'vpn', label: 'VPN', iconUrl: MARKET_ICONS.vpn },
  { slug: 'roblox', label: 'Roblox', iconUrl: MARKET_ICONS.roblox },
  { slug: 'warface', label: 'Warface', iconUrl: MARKET_ICONS.warface },
  { slug: 'minecraft', label: 'Minecraft', iconUrl: MARKET_ICONS.minecraft },
  { slug: 'mihoyo', label: 'miHoYo', iconUrl: MARKET_ICONS.mihoyo },
  {
    slug: 'world-of-tanks',
    label: 'World of Tanks',
    iconUrl: MARKET_ICONS['world-of-tanks'],
  },
  { slug: 'wot-blitz', label: 'WoT Blitz', iconUrl: MARKET_ICONS['wot-blitz'] },
  { slug: 'ea', label: 'EA (Origin)', iconUrl: MARKET_ICONS.ea },
  { slug: 'hytale', label: 'Hytale', iconUrl: MARKET_ICONS.hytale },
]
