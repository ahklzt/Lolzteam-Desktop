import { MARKET_ICONS } from "~/features/market/market-icons";

export interface CheckerCategoryDef {
  slug: string;
  label: string;
  icon?: string;
  implemented: boolean;
}

export const CHECKER_CATEGORIES: CheckerCategoryDef[] = [
  { slug: "steam", label: "Steam", implemented: true },
  { slug: "telegram", label: "Telegram", implemented: false },
  { slug: "epicgames", label: "Epic Games", implemented: false },
  { slug: "roblox", label: "Roblox", implemented: false },
  { slug: "tiktok", label: "TikTok", implemented: false },
  { slug: "discord", label: "Discord", implemented: false },
  { slug: "instagram", label: "Instagram", implemented: false },
  { slug: "llm", label: "LLM", icon: MARKET_ICONS.chatgpt, implemented: false },
];

export const CHECKER_TG_CHANNEL = "https://t.me/Lolzteam_Desktop";
