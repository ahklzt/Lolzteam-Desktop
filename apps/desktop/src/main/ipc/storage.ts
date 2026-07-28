import { IPC, type StorageCategory } from "@lzt/shared";
import { ipcMain } from "electron";
import { clearStorage, getStorageUsage } from "../services/storage";

export const registerStorageIpc = (): void => {
  ipcMain.handle(IPC.STORAGE_GET_USAGE, () => getStorageUsage());

  ipcMain.handle(
    IPC.STORAGE_CLEAR,
    (_e, p: { category: StorageCategory | "all" }) =>
      clearStorage(p?.category ?? "all"),
  );
};
