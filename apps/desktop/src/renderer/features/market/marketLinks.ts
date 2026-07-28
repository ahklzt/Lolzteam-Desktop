import { LZT_CONFIG } from '@lzt/shared'

const SCHEME = 'https' + '://'
const market = LZT_CONFIG.marketWebUrl

export const MARKET_LINKS = {
  deposit: market + '/payment/balance/deposit',
  payout: market + '/balance/payout',
  steamTopup: market + '/balance-steam/',
  terms: market + '/terms',
  statusUpgrade: market + '/account/upgrades',
  secretSettings: market + '/account/security',
  mailGlass: SCHEME + 'mail.glass/',
  guides: market + '/forums/7/?prefix_id[]=119&order=first_post_likes',
  siteChanges: market + '/new-features/unread',
  reportBug: market + '/forums/bugs/create-thread',
  suggestIdea: market + '/forums/suggestions/create-thread',
  autoBuy: market + '/auto-buy/',
  autoPayments: market + '/auto-payments',
  merchants: market + '/account/merchants',
  discounts: market + '/custom-discounts',
  ignoredSellers: market + '/ignored-users',
  blockedBuyers: market + '/ignored-buyers',
  marketSettings: market + '/account/market',
  steamValue: market + '/steam-value/',
} as const

export const marketUserLinks = {
  transferred: (userId: number) => market + '/user/' + userId + '/items/history',
  reviews: (userId: number) => market + '/user/' + userId + '/items/feedbacks',
  disputes: (userId: number) =>
    market +
    '/forums/tab/userthreads/' +
    userId +
    '/?node_id[]=239&node_id[]=774&node_id[]=774&node_id[]=918',
} as const
