import { ipcMain } from "electron";
import { IPC } from "@lzt/shared";
import { getMainWindow } from "../window/main-window";

export const registerWindowIpc = (): void => {
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle(IPC.WINDOW_TOGGLE_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  ipcMain.handle(IPC.WINDOW_CLOSE, () => {
    getMainWindow()?.close();
  });

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, (): boolean => {
    return getMainWindow()?.isMaximized() ?? false;
  });
};
