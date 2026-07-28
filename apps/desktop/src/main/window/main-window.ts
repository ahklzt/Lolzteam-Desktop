import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, shell } from "electron";
import { IPC } from "@lzt/shared";
import { MAIN_COLORS } from "../theme";
import { getCachedSettings } from "../settings/settings-store";
import { isInternalLztLink } from "../services/lzt-links";
import { getIconById } from "./app-icon";

const routeLink = (win: BrowserWindow, url: string): void => {
  if (!/^https?:/i.test(url)) return;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (/^https?:\/\/localhost(?::\d+)?(?:[/?#]|$)/i.test(url)) return;
  if (devUrl && url.startsWith(devUrl)) return;
  if (isInternalLztLink(url) && !win.isDestroyed()) {
    win.webContents.send(IPC.APP_OPEN_LZT_LINK, { url });
    return;
  }
  void shell.openExternal(url);
};

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;
let quitting = false;

export const setQuitting = (v: boolean): void => {
  quitting = v;
};

export const getMainWindow = (): BrowserWindow | null =>
  mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

export const showMainWindow = (): void => {
  const win = getMainWindow() ?? createMainWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
};

export const createMainWindow = (): BrowserWindow => {
  const existing = getMainWindow();
  if (existing) {
    existing.focus();
    return existing;
  }

  const s = getCachedSettings();
  const icon = getIconById(s?.appIconId ?? 1);
  const useSystemFrame = s?.systemWindowFrame ?? false;
  const spellcheck = s?.systemSpellcheck ?? false;
  const showTaskbar = s?.showTaskbarIcon ?? true;

  mainWindow = new BrowserWindow({
    width: 1270,
    height: 750,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: useSystemFrame,
    skipTaskbar: !showTaskbar,
    backgroundColor: MAIN_COLORS.bg,
    title: "Lolzteam Desktop",
    icon,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("maximize", () =>
    mainWindow?.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGED, true),
  );
  mainWindow.on("unmaximize", () =>
    mainWindow?.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGED, false),
  );

  mainWindow.on("close", (e) => {
    if (quitting) return;
    if (getCachedSettings()?.minimizeToTray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const win = getMainWindow();
    if (win) routeLink(win, url);
    return { action: "deny" };
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  mainWindow.webContents.on("will-navigate", (e, url) => {
    const internal = devUrl
      ? url.startsWith(devUrl)
      : url.startsWith("file://");
    if (!internal) {
      e.preventDefault();
      const win = getMainWindow();
      if (win) routeLink(win, url);
    }
  });

  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
};

export const isQuitting = (): boolean => quitting;
