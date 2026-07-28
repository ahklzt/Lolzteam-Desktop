import { LZT_CONFIG } from "./config";

export const DISCORD_APP_ID = "1240457969867427881";

export const DISCORD_DEFAULT_LARGE_IMAGE = "lolzteam";

export type DiscordRpcAnimation = "none" | "pulse" | "typewriter" | "cycle";

export interface DiscordRpcSettings {
  enabled: boolean;
  showDetails: boolean;
  showElapsed: boolean;
  idleDetails: string;
  stateText: string;
  largeImageKey: string;
  largeImageText: string;
  smallImageKey: string;
  smallImageText: string;
  button1Label: string;
  button1Url: string;
  button2Label: string;
  button2Url: string;
  animation: DiscordRpcAnimation;
  animationIntervalSec: number;
  animationLines: string[];
}

export const DEFAULT_DISCORD_RPC_SETTINGS: DiscordRpcSettings = {
  enabled: false,
  showDetails: true,
  showElapsed: true,
  idleDetails: "В сети",
  stateText: "Lolzteam Desktop",
  largeImageKey: DISCORD_DEFAULT_LARGE_IMAGE,
  largeImageText: "Lolzteam Desktop",
  smallImageKey: "",
  smallImageText: "",
  button1Label: "Открыть Lolzteam",
  button1Url: LZT_CONFIG.webUrl,
  button2Label: "",
  button2Url: "",
  animation: "pulse",
  animationIntervalSec: 8,
  animationLines: [],
};

export const DISCORD_RPC_MIN_ANIMATION_SEC = 4;

export type DiscordPresenceActivity =
  | { kind: "idle" }
  | { kind: "forum_section"; name: string }
  | { kind: "profile"; nickname: string }
  | { kind: "market_category"; name: string }
  | { kind: "market_item"; name: string }
  | { kind: "market_seller"; name: string }
  | { kind: "settings" }
  | { kind: "messages" }
  | { kind: "tools" }
  | { kind: "faq" }
  | { kind: "ads" }
  | { kind: "plugin"; name?: string };

export interface DiscordRpcStatus {
  enabled: boolean;
  connected: boolean;
  lastError: string | null;
}

export interface DiscordRpcSnapshot {
  settings: DiscordRpcSettings;
  status: DiscordRpcStatus;
}

export const describePresence = (
  activity: DiscordPresenceActivity,
): string | null => {
  switch (activity.kind) {
    case "forum_section":
      return `Просматривает раздел ${activity.name}`;
    case "profile":
      return `Просматривает профиль пользователя ${activity.nickname}`;
    case "market_category":
      return `Просматривает категорию ${activity.name}`;
    case "market_item":
      return `Просматривает товар на маркете ${activity.name}`;
    case "market_seller":
      return `Просматривает объявления продавца ${activity.name}`;
    case "settings":
      return "Изменяет настройки профиля";
    case "messages":
      return "Читает личные сообщения";
    case "tools":
      return "Пользуется инструментами";
    case "faq":
      return "Читает FAQ и правила";
    case "ads":
      return "Смотрит рекламный раздел";
    case "plugin":
      return activity.name ? `Плагин: ${activity.name}` : "Использует плагин";
    case "idle":
    default:
      return null;
  }
};
