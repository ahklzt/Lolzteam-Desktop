const s = "http" + "s" + "://";

export const PROVIDER_ICONS: Record<string, string> = {
  rambler: s + "www.rambler.ru/favicon-192x192.png",
  smakmail: s + "smakmail.com/newlogosmak.svg?v=3",
  outlook: s + "support.microsoft.com/favicon-32x32.png",
  gmx: s + "s.uicdn.com/mailint/10.206.0/assets/favicon_gmxcom.ico",
  mailru: s + "home.imgsmail.ru/resplash/819449/i/meta/favicon.ico",
  notletters: s + "notletters.com/favicon.ico",
};

export const providerIcon = (key: string): string | null =>
  PROVIDER_ICONS[key] ?? null;
