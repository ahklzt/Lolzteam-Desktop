import { MARKET_ICONS } from "~/features/market/market-icons";

export interface SellCategoryDef {
  slug: string;
  label: string;
  labelKey?: string;
  categoryId: number;
  icon?: string;
  implemented: boolean;
}

export const SELL_CATEGORIES: SellCategoryDef[] = [
  { slug: "steam", label: "Steam", categoryId: 1, implemented: true },
  { slug: "telegram", label: "Telegram", categoryId: 24, implemented: true },
  { slug: "fortnite", label: "Fortnite", categoryId: 9, implemented: false },
  { slug: "riot", label: "Riot Games", categoryId: 13, implemented: false },
  { slug: "ea", label: "EA", categoryId: 3, implemented: false },
  {
    slug: "uplay",
    label: "Ubisoft Connect (Uplay)",
    categoryId: 5,
    implemented: false,
  },
  { slug: "minecraft", label: "Minecraft", categoryId: 28, implemented: false },
  { slug: "supercell", label: "Supercell", categoryId: 15, implemented: false },
  { slug: "roblox", label: "Roblox", categoryId: 31, implemented: true },
  {
    slug: "world-of-tanks",
    label: "World of Tanks",
    categoryId: 14,
    implemented: false,
  },
  {
    slug: "wot-blitz",
    label: "World of Tanks Blitz",
    categoryId: 16,
    implemented: false,
  },
  { slug: "epicgames", label: "Epic Games", categoryId: 12, implemented: true },
  {
    slug: "gifts",
    label: "\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0438",
    labelKey: "lztmarket.sellAccount.names.gifts",
    categoryId: 30,
    implemented: false,
  },
  {
    slug: "escape-from-tarkov",
    label: "Escape from Tarkov",
    categoryId: 18,
    implemented: false,
  },
  { slug: "socialclub", label: "Social Club", categoryId: 7, implemented: false },
  { slug: "discord", label: "Discord", categoryId: 22, implemented: true },
  { slug: "tiktok", label: "TikTok", categoryId: 20, implemented: true },
  { slug: "instagram", label: "Instagram", categoryId: 10, implemented: true },
  { slug: "battlenet", label: "Battle.net", categoryId: 11, implemented: false },
  {
    slug: "llm",
    label: "LLM",
    categoryId: 6,
    icon: MARKET_ICONS.chatgpt,
    implemented: false,
  },
  { slug: "mihoyo", label: "miHoYo", categoryId: 17, implemented: false },
  { slug: "vpn", label: "VPN", categoryId: 19, implemented: false },
  { slug: "warface", label: "Warface", categoryId: 4, implemented: false },
  { slug: "hytale", label: "Hytale", categoryId: 8, implemented: false },
];

export const SELL_ORIGINS = [
  "brute",
  "phishing",
  "stealer",
  "personal",
  "resale",
  "autoreg",
  "dummy",
] as const;

export type SellOrigin = (typeof SELL_ORIGINS)[number];

export const STEAM_PLAY_FLAGS = [
  "uplay_games",
  "ea_games",
  "ark",
  "ark_ascended",
  "warframe",
  "the_quarry",
  "brawlhalla",
] as const;

export type SteamPlayFlag = (typeof STEAM_PLAY_FLAGS)[number];
