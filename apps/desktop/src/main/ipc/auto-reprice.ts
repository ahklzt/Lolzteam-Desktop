import { IPC, type AutoRepriceGlobalPatch } from "@lzt/shared";
import { ipcMain } from "electron";
import {
  clearAutoRepriceLog,
  getAutoRepriceState,
  runAutoRepriceNow,
  setAutoRepriceGlobal,
} from "../services/auto-reprice";

export const registerAutoRepriceIpc = (): void => {
  ipcMain.handle(IPC.AUTOREPRICE_GET, () => getAutoRepriceState());

  ipcMain.handle(IPC.AUTOREPRICE_SET_GLOBAL, (_e, patch: AutoRepriceGlobalPatch) =>
    setAutoRepriceGlobal(patch ?? {}),
  );

  ipcMain.handle(IPC.AUTOREPRICE_RUN_NOW, () => runAutoRepriceNow());

  ipcMain.handle(IPC.AUTOREPRICE_CLEAR_LOG, () => clearAutoRepriceLog());
};
