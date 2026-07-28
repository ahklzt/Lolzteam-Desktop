import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, shell } from "electron";
import { IPC } from "@lzt/shared";
import { MAIN_COLORS } from "../theme";
import { isInternalLztLink } from "../services/lzt-links";
import { getMainWindow } from "./main-window";
import { getBundledIcon } from "./app-icon";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const CHAT_HASH = "/chat-window";

let chatWindow: BrowserWindow | null = null;

export const getChatWindow = (): BrowserWindow | null =>
  chatWindow && !chatWindow.isDestroyed() ? chatWindow : null;

export const closeChatWindow = (): void => {
  getChatWindow()?.close();
  chatWindow = null;
};

export const showChatWindow = (): void => {
  const existing = getChatWindow();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }

  chatWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 480,
    useContentSize: true,
    backgroundColor: MAIN_COLORS.bg,
    title: "Чат",
    icon: getBundledIcon(),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  chatWindow.setMenu(null);
  chatWindow.on("ready-to-show", () => chatWindow?.show());
  chatWindow.on("closed", () => {
    chatWindow = null;
  });

  chatWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      const main = getMainWindow();
      if (main && isInternalLztLink(url)) {
        main.show();
        main.focus();
        main.webContents.send(IPC.APP_OPEN_LZT_LINK, { url });
      } else {
        void shell.openExternal(url);
      }
    }
    return { action: "deny" };
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    void chatWindow.loadURL(`${devUrl}#${CHAT_HASH}`);
  } else {
    void chatWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: CHAT_HASH,
    });
  }
};
