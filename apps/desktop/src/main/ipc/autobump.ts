import {
  IPC,
  type AutoBumpGlobalPatch,
  type AutoBumpThread,
} from "@lzt/shared";
import { ipcMain } from "electron";
import {
  addAutoBumpThread,
  bumpAutoBumpNow,
  clearAutoBumpLog,
  getAutoBumpState,
  removeAutoBumpThread,
  setAutoBumpGlobal,
  updateAutoBumpThread,
} from "../services/autobump";

export const registerAutoBumpIpc = (): void => {
  ipcMain.handle(IPC.AUTOBUMP_GET, () => getAutoBumpState());

  ipcMain.handle(IPC.AUTOBUMP_SET_GLOBAL, (_e, patch: AutoBumpGlobalPatch) =>
    setAutoBumpGlobal(patch ?? {}),
  );

  ipcMain.handle(IPC.AUTOBUMP_ADD_THREAD, (_e, p: { ref: string }) =>
    addAutoBumpThread(p?.ref ?? ""),
  );

  ipcMain.handle(
    IPC.AUTOBUMP_UPDATE_THREAD,
    (_e, p: { threadId: number; patch: Partial<AutoBumpThread> }) =>
      updateAutoBumpThread(p.threadId, p.patch ?? {}),
  );

  ipcMain.handle(IPC.AUTOBUMP_REMOVE_THREAD, (_e, p: { threadId: number }) =>
    removeAutoBumpThread(p.threadId),
  );

  ipcMain.handle(IPC.AUTOBUMP_BUMP_NOW, (_e, p: { threadId: number }) =>
    bumpAutoBumpNow(p.threadId),
  );

  ipcMain.handle(IPC.AUTOBUMP_CLEAR_LOG, () => clearAutoBumpLog());
};
