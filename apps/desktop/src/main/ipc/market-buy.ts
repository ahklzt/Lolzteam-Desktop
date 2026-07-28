import {
  IPC,
  type MarketCartMutationResult,
  type MarketCartResult,
  type MarketFastBuyResult,
  type MarketPurchasePreviewResult,
} from "@lzt/shared";
import { ipcMain } from "electron";
import {
  addCartItem,
  clearCart,
  fastBuyAccount,
  getCartItems,
  getPurchasePreview,
  removeCartItem,
} from "../services/market-buy";

const itemIdOf = (payload?: { itemId?: number }): number =>
  typeof payload?.itemId === "number" && payload.itemId > 0 ? payload.itemId : 0;

export const registerMarketBuyIpc = (): void => {
  ipcMain.handle(
    IPC.MARKET_PURCHASE_PREVIEW,
    async (_e, payload?: { itemId?: number }): Promise<MarketPurchasePreviewResult> => {
      const itemId = itemIdOf(payload);
      if (!itemId) return { ok: false, reason: "bad_response" };
      return getPurchasePreview(itemId);
    },
  );

  ipcMain.handle(
    IPC.MARKET_FAST_BUY,
    async (
      _e,
      payload?: { itemId?: number; price?: number; balanceId?: number },
    ): Promise<MarketFastBuyResult> => {
      const itemId = itemIdOf(payload);
      const price = typeof payload?.price === "number" ? payload.price : 0;
      if (!itemId || price <= 0) {
        return { ok: false, attempts: 0, reason: "bad_response" };
      }
      const balanceId =
        typeof payload?.balanceId === "number" ? payload.balanceId : undefined;
      return fastBuyAccount(itemId, price, balanceId);
    },
  );

  ipcMain.handle(
    IPC.MARKET_CART_LIST,
    async (_e, payload?: { page?: number }): Promise<MarketCartResult> => {
      const page = typeof payload?.page === "number" && payload.page > 0 ? payload.page : 1;
      return getCartItems(page);
    },
  );

  ipcMain.handle(
    IPC.MARKET_CART_ADD,
    async (_e, payload?: { itemId?: number }): Promise<MarketCartMutationResult> => {
      const itemId = itemIdOf(payload);
      if (!itemId) return { ok: false, reason: "bad_response" };
      return addCartItem(itemId);
    },
  );

  ipcMain.handle(
    IPC.MARKET_CART_REMOVE,
    async (_e, payload?: { itemId?: number }): Promise<MarketCartMutationResult> => {
      const itemId = itemIdOf(payload);
      if (!itemId) return { ok: false, reason: "bad_response" };
      return removeCartItem(itemId);
    },
  );

  ipcMain.handle(
    IPC.MARKET_CART_CLEAR,
    async (): Promise<MarketCartMutationResult> => clearCart(),
  );
};
