import { create } from 'zustand'

export type MarketPage =
  | 'rules'
  | 'statusUp'
  | 'rates'
  | 'myAccounts'
  | 'myPurchases'
  | 'favorites'
  | 'myOperations'
  | 'cart'

export interface SellerRoute {
  userId: number
  username: string
  usernameHtml: string | null
  usernameColor: string | null
}

export interface ItemRoute {
  itemId: number
}

interface MarketRouteState {
  page: MarketPage | null
  seller: SellerRoute | null
  item: ItemRoute | null
  open: (page: MarketPage) => void
  openSeller: (seller: SellerRoute) => void
  openItem: (itemId: number) => void
  back: () => void
}

export const useMarketRoute = create<MarketRouteState>((set) => ({
  page: null,
  seller: null,
  item: null,
  open: (page) => set({ page, seller: null, item: null }),
  openSeller: (seller) => set({ seller, page: null, item: null }),
  openItem: (itemId) => set({ item: { itemId }, page: null }),
  back: () => set({ page: null, seller: null, item: null }),
}))
