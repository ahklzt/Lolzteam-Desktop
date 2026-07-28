export const LZT_CONFIG = {
  appName: "Lolzteam Desktop",
  appId: "com.lolzteam.desktop",
  protocolScheme: "lztmoderator",

  webUrl: "https://lolz.team",
  marketWebUrl: "https://lzt.market",
  marketApiUrl: "https://prod-api.lzt.market",
  forumApiUrl: "https://prod-api.lolz.live",

  clientId: "pljag10ubf",
  authRedirectUri: "lztmoderator://oauth/callback",
  oauthScopes: "basic read post conversate payment invoice chatbox market",
} as const;

export type LztConfig = typeof LZT_CONFIG;
