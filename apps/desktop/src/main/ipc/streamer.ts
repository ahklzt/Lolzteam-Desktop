import { IPC, type StreamerSettings } from "@lzt/shared";
import { ipcMain } from "electron";
import {
  exportStreamerSettings,
  getStreamerSettings,
  importStreamerSettings,
  resetStreamerSettings,
  setStreamerSettings,
} from "../services/streamer";

export const registerStreamerIpc = (): void => {
  ipcMain.handle(IPC.STREAMER_GET, () => getStreamerSettings());

  ipcMain.handle(
    IPC.STREAMER_SET,
    (_e, patch: Partial<StreamerSettings>) =>
      setStreamerSettings(patch ?? {}),
  );

  ipcMain.handle(IPC.STREAMER_RESET, () => resetStreamerSettings());

  ipcMain.handle(IPC.STREAMER_EXPORT, () => exportStreamerSettings());

  ipcMain.handle(IPC.STREAMER_IMPORT, (_e, raw: string) =>
    importStreamerSettings(String(raw ?? "")),
  );
};
