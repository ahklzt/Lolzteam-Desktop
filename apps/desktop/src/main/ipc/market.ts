import {
  IPC,
  type MarketItem,
  type MarketCategoriesResult,
  type MarketCategoryGamesResult,
  type MarketCategoryParamsResult,
  type MarketItemsResult,
  type MarketUserItemsResult,
  type MarketUserItemsQuery,
  type MarketUserItemStatesResult,
  type MarketAccountResult,
  type ItemNote,
  type ItemNotesResult,
  type MarketQuery,
  type MarketTransferInput,
  type MarketTransferResult,
  type MarketTransferFeeResult,
  type MarketCurrencyRatesResult,
  type MarketPaymentsQuery,
  type MarketPaymentsResult,
  type MarketTagsResult,
  type MarketTagInput,
  type MarketTagMutationResult,
  type MarketSimpleResult,
  type MarketTempEmailPasswordResult,
  type MarketMafileResult,
  type MarketCheckResult,
  type MarketDownloadQuery,
  type MarketDownloadResult,
  type MarketPublishInput,
  type MarketPublishResult,
  type MarketFastSellInput,
  type MarketFastSellResult,
  type MarketEditPriceInput,
  type MarketPriceEditResult,
  type MarketRateLimitState,
  type MarketProxyListResult,
  type MarketSellUploadInput,
  type MarketSellUploadResult,
} from '@lzt/shared'
import { ipcMain } from 'electron'
import {
  checkTransferFee,
  getCategoryGames,
  getCategoryParams,
  getCurrencyRates,
  getMarketCategories,
  getAccount,
  getMarketItems,
  getUserItemStates,
  getUserItems,
  getUserOrders,
  getFavourites,
  getPayments,
  getUserTags,
  createUserTag,
  updateUserTag,
  deleteUserTag,
  reorderUserTags,
  addItemTag,
  removeItemTag,
  addPublicTag,
  removePublicTag,
  starItem,
  unstarItem,
  getTempEmailPassword,
  getItemMafile,
  checkAccount,
  buildDownloadUrl,
  transferMoney,
} from '../services/market-api'
import {
  publishItem,
  fastSellItem,
  editItemPrice,
  sellUpload,
  getMarketProxyList,
} from '../services/market-publish'
import { marketLimiter } from '../services/market-rate-limiter'
import {
  getItemNote,
  setItemNote,
  listItemNotes,
  deleteItemNote,
} from '../services/local-data'
import {
  getCachedList,
  setCachedList,
  clearAccountsCache,
} from '../services/accounts-cache-store'

export const registerMarketIpc = (): void => {
  ipcMain.handle(
    IPC.MARKET_GET_ITEMS,
    async (_e, payload?: { query?: MarketQuery }): Promise<MarketItemsResult> =>
      getMarketItems(payload?.query ?? {}),
  )

  ipcMain.handle(
    IPC.MARKET_GET_CATEGORIES,
    async (): Promise<MarketCategoriesResult> => getMarketCategories(),
  )

  ipcMain.handle(
    IPC.MARKET_GET_CATEGORY_PARAMS,
    async (
      _e,
      payload?: { slug?: string },
    ): Promise<MarketCategoryParamsResult> => {
      const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : ''
      if (!slug) return { ok: false, reason: 'bad_response' }
      return getCategoryParams(slug)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_CATEGORY_GAMES,
    async (
      _e,
      payload?: { slug?: string },
    ): Promise<MarketCategoryGamesResult> => {
      const slug = typeof payload?.slug === 'string' ? payload.slug.trim() : ''
      if (!slug) return { ok: false, reason: 'bad_response' }
      return getCategoryGames(slug)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_USER_ITEMS,
    async (
      _e,
      payload?: { userId?: number; page?: number; query?: MarketUserItemsQuery },
    ): Promise<MarketUserItemsResult> => {
      const userId = typeof payload?.userId === 'number' ? payload.userId : 0
      if (!userId) return { ok: false, reason: 'bad_response' }
      const page = typeof payload?.page === 'number' ? payload.page : 1
      return getUserItems(userId, page, payload?.query)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_USER_ITEM_STATES,
    async (
      _e,
      payload?: { userId?: number },
    ): Promise<MarketUserItemStatesResult> => {
      const userId = typeof payload?.userId === 'number' ? payload.userId : 0
      if (!userId) return { ok: false, reason: 'bad_response' }
      return getUserItemStates(userId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_ACCOUNT,
    async (
      _e,
      payload?: { itemId?: number },
    ): Promise<MarketAccountResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return getAccount(itemId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_TRANSFER,
    async (
      _e,
      payload?: { input?: MarketTransferInput },
    ): Promise<MarketTransferResult> => {
      const input = payload?.input
      if (!input || typeof input.amount !== 'number' || input.amount <= 0) {
        return { ok: false, reason: 'bad_request' }
      }
      if (!input.username && input.userId === undefined) {
        return { ok: false, reason: 'user_not_found' }
      }
      return transferMoney(input)
    },
  )

  ipcMain.handle(
    IPC.MARKET_TRANSFER_FEE,
    async (_e, payload?: { amount?: number }): Promise<MarketTransferFeeResult> => {
      const amount = typeof payload?.amount === 'number' ? payload.amount : 0
      if (amount <= 0) return { ok: false, reason: 'bad_response' }
      return checkTransferFee(amount)
    },
  )

  ipcMain.handle(
    IPC.MARKET_ITEM_NOTE_GET,
    async (_e, payload?: { itemId?: number }): Promise<ItemNote> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { itemId: 0, text: '', updatedAt: 0 }
      const text = await getItemNote(itemId)
      return { itemId, text, updatedAt: 0 }
    },
  )
  ipcMain.handle(
    IPC.MARKET_ITEM_NOTE_SET,
    async (
      _e,
      payload?: { itemId?: number; text?: string },
    ): Promise<{ ok: boolean }> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false }
      const text = typeof payload?.text === 'string' ? payload.text : ''
      await setItemNote(itemId, text)
      return { ok: true }
    },
  )
  ipcMain.handle(
    IPC.MARKET_ITEM_NOTES_LIST,
    async (): Promise<ItemNotesResult> => {
      const notes = await listItemNotes()
      return { notes }
    },
  )
  ipcMain.handle(
    IPC.MARKET_ITEM_NOTE_DELETE,
    async (_e, payload?: { itemId?: number }): Promise<{ ok: boolean }> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false }
      await deleteItemNote(itemId)
      return { ok: true }
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_CURRENCY,
    async (): Promise<MarketCurrencyRatesResult> => getCurrencyRates(),
  )

  ipcMain.handle(
    IPC.MARKET_GET_ORDERS,
    async (
      _e,
      payload?: { page?: number; query?: MarketUserItemsQuery },
    ): Promise<MarketItemsResult> => {
      const page = typeof payload?.page === 'number' ? payload.page : 1
      return getUserOrders(page, payload?.query)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_FAVOURITES,
    async (
      _e,
      payload?: { page?: number; query?: MarketUserItemsQuery },
    ): Promise<MarketItemsResult> => {
      const page = typeof payload?.page === 'number' ? payload.page : 1
      return getFavourites(page, payload?.query)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_PAYMENTS,
    async (
      _e,
      payload?: { query?: MarketPaymentsQuery },
    ): Promise<MarketPaymentsResult> => getPayments(payload?.query),
  )

  ipcMain.handle(
    IPC.MARKET_GET_TAGS,
    async (): Promise<MarketTagsResult> => getUserTags(),
  )
  ipcMain.handle(
    IPC.MARKET_CREATE_TAG,
    async (
      _e,
      payload?: { input?: MarketTagInput },
    ): Promise<MarketTagMutationResult> => {
      const input = payload?.input
      if (!input || !input.title?.trim()) return { ok: false, reason: 'bad_response' }
      return createUserTag({
        title: input.title.trim().slice(0, 16),
        backgroundColor: input.backgroundColor,
      })
    },
  )
  ipcMain.handle(
    IPC.MARKET_UPDATE_TAG,
    async (
      _e,
      payload?: { tagId?: number; input?: MarketTagInput },
    ): Promise<MarketTagMutationResult> => {
      const tagId = typeof payload?.tagId === 'number' ? payload.tagId : 0
      const input = payload?.input
      if (!tagId || !input || !input.title?.trim()) {
        return { ok: false, reason: 'bad_response' }
      }
      return updateUserTag(tagId, {
        title: input.title.trim().slice(0, 16),
        backgroundColor: input.backgroundColor,
      })
    },
  )
  ipcMain.handle(
    IPC.MARKET_DELETE_TAG,
    async (_e, payload?: { tagId?: number }): Promise<MarketSimpleResult> => {
      const tagId = typeof payload?.tagId === 'number' ? payload.tagId : 0
      if (!tagId) return { ok: false, reason: 'bad_response' }
      return deleteUserTag(tagId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_REORDER_TAGS,
    async (
      _e,
      payload?: { tagOrder?: number[] },
    ): Promise<MarketSimpleResult> => {
      const tagOrder = Array.isArray(payload?.tagOrder)
        ? payload!.tagOrder.filter((id): id is number => typeof id === 'number')
        : []
      if (tagOrder.length === 0) return { ok: false, reason: 'bad_response' }
      return reorderUserTags(tagOrder)
    },
  )

  const requireItemAndTag = (payload?: {
    itemId?: number
    tagId?: number
  }): { itemId: number; tagId: number } | null => {
    const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
    const tagId = typeof payload?.tagId === 'number' ? payload.tagId : 0
    if (!itemId || !tagId) return null
    return { itemId, tagId }
  }
  ipcMain.handle(
    IPC.MARKET_ADD_ITEM_TAG,
    async (_e, payload?): Promise<MarketSimpleResult> => {
      const args = requireItemAndTag(payload)
      if (!args) return { ok: false, reason: 'bad_response' }
      return addItemTag(args.itemId, args.tagId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_REMOVE_ITEM_TAG,
    async (_e, payload?): Promise<MarketSimpleResult> => {
      const args = requireItemAndTag(payload)
      if (!args) return { ok: false, reason: 'bad_response' }
      return removeItemTag(args.itemId, args.tagId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_ADD_PUBLIC_TAG,
    async (_e, payload?): Promise<MarketSimpleResult> => {
      const args = requireItemAndTag(payload)
      if (!args) return { ok: false, reason: 'bad_response' }
      return addPublicTag(args.itemId, args.tagId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_REMOVE_PUBLIC_TAG,
    async (_e, payload?): Promise<MarketSimpleResult> => {
      const args = requireItemAndTag(payload)
      if (!args) return { ok: false, reason: 'bad_response' }
      return removePublicTag(args.itemId, args.tagId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_STAR,
    async (_e, payload?: { itemId?: number }): Promise<MarketSimpleResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return starItem(itemId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_UNSTAR,
    async (_e, payload?: { itemId?: number }): Promise<MarketSimpleResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return unstarItem(itemId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_GET_TEMP_EMAIL_PASSWORD,
    async (
      _e,
      payload?: { itemId?: number },
    ): Promise<MarketTempEmailPasswordResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return getTempEmailPassword(itemId)
    },
  )
  ipcMain.handle(
    IPC.MARKET_GET_MAFILE,
    async (_e, payload?: { itemId?: number }): Promise<MarketMafileResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return getItemMafile(itemId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_CHECK_ACCOUNT,
    async (_e, payload?: { itemId?: number }): Promise<MarketCheckResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return checkAccount(itemId)
    },
  )

  ipcMain.handle(
    IPC.MARKET_DOWNLOAD,
    async (
      _e,
      payload?: { query?: MarketDownloadQuery },
    ): Promise<MarketDownloadResult> => {
      const query = payload?.query
      if (!query || (query.type !== 'items' && query.type !== 'orders')) {
        return { ok: false, reason: 'bad_response' }
      }
      return buildDownloadUrl(query)
    },
  )

  ipcMain.handle(
    IPC.MARKET_ACCOUNTS_CACHE_GET,
    async (_e, payload?: { key?: string }) => {
      const key = typeof payload?.key === 'string' ? payload.key : ''
      if (!key) return null
      return getCachedList(key)
    },
  )
  ipcMain.handle(
    IPC.MARKET_ACCOUNTS_CACHE_SET,
    async (
      _e,
      payload?: { key?: string; items?: MarketItem[]; total?: number },
    ): Promise<{ ok: boolean }> => {
      const key = typeof payload?.key === 'string' ? payload.key : ''
      const items = Array.isArray(payload?.items) ? payload!.items : []
      const total = typeof payload?.total === 'number' ? payload.total : items.length
      if (!key) return { ok: false }
      await setCachedList(key, items, total)
      return { ok: true }
    },
  )
  ipcMain.handle(IPC.MARKET_ACCOUNTS_CACHE_CLEAR, async (): Promise<{ ok: boolean }> => {
    await clearAccountsCache()
    return { ok: true }
  })

  ipcMain.handle(
    IPC.MARKET_PUBLISH_ITEM,
    async (
      _e,
      payload?: { input?: MarketPublishInput },
    ): Promise<MarketPublishResult> => {
      const input = payload?.input
      if (
        !input ||
        typeof input.categoryId !== 'number' ||
        typeof input.price !== 'number'
      ) {
        return { ok: false, reason: 'bad_response' }
      }
      return publishItem(input)
    },
  )

  ipcMain.handle(
    IPC.MARKET_FAST_SELL,
    async (
      _e,
      payload?: { itemId?: number; input?: MarketFastSellInput },
    ): Promise<MarketFastSellResult> => {
      const itemId = typeof payload?.itemId === 'number' ? payload.itemId : 0
      if (!itemId) return { ok: false, reason: 'bad_response' }
      return fastSellItem(itemId, payload?.input ?? {})
    },
  )

  ipcMain.handle(
    IPC.MARKET_EDIT_PRICE,
    async (
      _e,
      payload?: { input?: MarketEditPriceInput },
    ): Promise<MarketPriceEditResult> => {
      const input = payload?.input
      if (
        !input ||
        typeof input.itemId !== 'number' ||
        typeof input.price !== 'number'
      ) {
        return { ok: false, reason: 'bad_response' }
      }
      return editItemPrice(input)
    },
  )

  ipcMain.handle(
    IPC.MARKET_RATE_LIMIT_STATE,
    async (): Promise<MarketRateLimitState> => marketLimiter.snapshot(),
  )

  ipcMain.handle(
    IPC.MARKET_GET_PROXIES,
    async (): Promise<MarketProxyListResult> => getMarketProxyList(),
  )

  ipcMain.handle(
    IPC.MARKET_SELL_UPLOAD,
    async (
      _e,
      payload?: { input?: MarketSellUploadInput },
    ): Promise<MarketSellUploadResult> => {
      const input = payload?.input
      if (
        !input ||
        typeof input.categoryId !== 'number' ||
        typeof input.price !== 'number' ||
        typeof input.itemOrigin !== 'string' ||
        !input.itemOrigin
      ) {
        return { ok: false, reason: 'bad_response' }
      }
      return sellUpload(input)
    },
  )
}
