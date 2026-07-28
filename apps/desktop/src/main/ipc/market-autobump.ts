import { IPC, type MarketAutoBumpGlobalPatch } from "@lzt/shared";
import { ipcMain } from "electron";
import {
  bumpMarketAutoBumpItem,
  clearMarketAutoBumpLog,
  getMarketAutoBumpState,
  refreshMarketAutoBumpItems,
  resetMarketAutoBumpCycle,
  runMarketAutoBumpNow,
  setMarketAutoBumpGlobal,
} from "../services/market-autobump";

export const registerMarketAutoBumpIpc = (): void => {
  ipcMain.handle(IPC.MARKET_AUTOBUMP_GET, () => getMarketAutoBumpState());

  ipcMain.handle(
    IPC.MARKET_AUTOBUMP_SET_GLOBAL,
    (_e, patch: MarketAutoBumpGlobalPatch) =>
      setMarketAutoBumpGlobal(patch ?? {}),
  );

  ipcMain.handle(IPC.MARKET_AUTOBUMP_RUN_NOW, () => runMarketAutoBumpNow());

  ipcMain.handle(IPC.MARKET_AUTOBUMP_RESET_CYCLE, () =>
    resetMarketAutoBumpCycle(),
  );

  ipcMain.handle(IPC.MARKET_AUTOBUMP_CLEAR_LOG, () => clearMarketAutoBumpLog());

  ipcMain.handle(IPC.MARKET_AUTOBUMP_REFRESH_ITEMS, () =>
    refreshMarketAutoBumpItems(),
  );

  ipcMain.handle(IPC.MARKET_AUTOBUMP_BUMP_ITEM, (_e, itemId: number) =>
    bumpMarketAutoBumpItem(typeof itemId === "number" ? itemId : 0),
  );
};
