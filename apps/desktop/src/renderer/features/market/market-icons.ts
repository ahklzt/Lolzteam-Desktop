import battlenet from '../../assets/market-icons/battlenet.svg'
import chatgpt from '../../assets/market-icons/chatgpt.svg'
import discord from '../../assets/market-icons/discord.svg'
import ea from '../../assets/market-icons/ea.svg'
import epicgames from '../../assets/market-icons/epicgames.svg'
import escapeFromTarkov from '../../assets/market-icons/escape-from-tarkov.svg'
import fortnite from '../../assets/market-icons/fortnite.svg'
import gifts from '../../assets/market-icons/gifts.svg'
import hytale from '../../assets/market-icons/hytale.svg'
import instagram from '../../assets/market-icons/instagram.svg'
import leagueOfLegends from '../../assets/market-icons/league-of-legends.svg'
import mihoyo from '../../assets/market-icons/mihoyo.svg'
import minecraft from '../../assets/market-icons/minecraft.svg'
import riot from '../../assets/market-icons/riot.svg'
import roblox from '../../assets/market-icons/roblox.svg'
import socialclub from '../../assets/market-icons/socialclub.svg'
import steam from '../../assets/market-icons/steam.svg'
import supercell from '../../assets/market-icons/supercell.svg'
import telegram from '../../assets/market-icons/telegram.svg'
import tiktok from '../../assets/market-icons/tiktok.svg'
import uplay from '../../assets/market-icons/uplay.svg'
import valorant from '../../assets/market-icons/valorant.svg'
import vpn from '../../assets/market-icons/vpn.svg'
import warface from '../../assets/market-icons/warface.svg'
import wotBlitz from '../../assets/market-icons/wot-blitz.svg'
import worldOfTanks from '../../assets/market-icons/world-of-tanks.svg'

export const MARKET_ICONS: Record<string, string> = {
  steam,
  fortnite,
  riot,
  telegram,
  supercell,
  gifts,
  epicgames,
  'escape-from-tarkov': escapeFromTarkov,
  socialclub,
  uplay,
  discord,
  tiktok,
  instagram,
  battlenet,
  chatgpt,
  vpn,
  roblox,
  warface,
  minecraft,
  mihoyo,
  'world-of-tanks': worldOfTanks,
  'wot-blitz': wotBlitz,
  ea,
  hytale,
  'league-of-legends': leagueOfLegends,
  valorant,
}

export const getMarketIcon = (slug: string | undefined): string | undefined =>
  slug ? MARKET_ICONS[slug] : undefined
