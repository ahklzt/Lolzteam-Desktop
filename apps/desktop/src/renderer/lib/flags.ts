import type { LocalePreference, MarketCurrency } from '@lzt/shared'


const SCHEME = 'https' + '://'
const TWEMOJI_BASE = `${SCHEME}cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/`

export const CURRENCY_FLAG: Record<MarketCurrency, string> = {
  rub: '\u{1F1F7}\u{1F1FA}',
  uah: '\u{1F1FA}\u{1F1E6}',
  kzt: '\u{1F1F0}\u{1F1FF}',
  byn: '\u{1F1E7}\u{1F1FE}',
  usd: '\u{1F1FA}\u{1F1F8}',
  eur: '\u{1F1EA}\u{1F1FA}',
  gbp: '\u{1F1EC}\u{1F1E7}',
  cny: '\u{1F1E8}\u{1F1F3}',
  try: '\u{1F1F9}\u{1F1F7}',
  jpy: '\u{1F1EF}\u{1F1F5}',
  brl: '\u{1F1E7}\u{1F1F7}',
}

export const LOCALE_FLAG: Record<LocalePreference, string> = {
  ru: '\u{1F1F7}\u{1F1FA}',
  en: '\u{1F1EC}\u{1F1E7}',
}

const emojiToTwemojiCode = (emoji: string): string =>
  Array.from(emoji)
    .map((ch) => ch.codePointAt(0))
    .filter((cp): cp is number => cp !== undefined)
    .map((cp) => cp.toString(16))
    .join('-')

export const flagImageUrl = (emoji: string): string => {
  const code = emojiToTwemojiCode(emoji)
  return code ? `${TWEMOJI_BASE}${code}.svg` : ''
}

export const currencyFlagUrl = (code: MarketCurrency): string => flagImageUrl(CURRENCY_FLAG[code])
export const localeFlagUrl = (locale: LocalePreference): string => flagImageUrl(LOCALE_FLAG[locale])
