import { LZT_CONFIG, type ModeratorSettings } from "@lzt/shared";
import { BrowserWindow, app, session } from "electron";
import log from "electron-log/main";
import { registerAuthFlow } from "./auth/protocol-handler";
import { registerInAppAuth } from "./auth/in-app-auth";
import { registerProtocol } from "./auth/protocol-register";
import { bootstrap } from "./bootstrap";
import { registerAppIpc } from "./ipc/app";
import { registerWindowIpc } from "./ipc/window";
import { registerAuthIpc } from "./ipc/auth";
import { registerChatIpc } from "./ipc/chat";
import { registerForumIpc } from "./ipc/forum";
import { registerPluginsIpc } from "./ipc/plugins";
import { registerAutoBumpIpc } from "./ipc/autobump";
import { registerAutoRepriceIpc } from "./ipc/auto-reprice";
import { registerMarketAutoBumpIpc } from "./ipc/market-autobump";
import { registerDiscordRpcIpc } from "./ipc/discord-rpc";
import { registerStreamerIpc } from "./ipc/streamer";
import { registerHistoryIpc } from "./ipc/history";
import { registerStorageIpc } from "./ipc/storage";
import { registerUpdaterIpc } from "./updater";
import { registerMailIpc } from "./ipc/mail";
import { registerMarketIpc } from "./ipc/market";
import { registerMarketBuyIpc } from "./ipc/market-buy";
import { registerLoginIpc } from "./ipc/login";
import { registerProfileIpc } from "./ipc/profile";
import { registerProxyIpc } from "./ipc/proxy";
import { registerSettingsIpc } from "./ipc/settings";
import { registerCheckerIpc } from "./ipc/checker";
import { registerTelegramIpc } from "./ipc/telegram";
import { getSettings, onSettingsChange } from "./settings/settings-store";
import {
  applyProxyToSession,
  clearProxyFromSession,
  registerProxyAuthHandler,
  syncProxyCreds,
} from "./services/proxy";
import { startAutoBump } from "./services/autobump";
import { startAutoReprice } from "./services/auto-reprice";
import { startMarketAutoBump } from "./services/market-autobump";
import { startHistory } from "./services/data-store";
import { startStorageAutoClean } from "./services/storage";
import { startDiscordRpc } from "./services/discord-rpc";
import { destroyTray, ensureTray, setTrayImage } from "./window/tray";
import { getIconById } from "./window/app-icon";
import {
  createMainWindow,
  getMainWindow,
  setQuitting,
  showMainWindow,
} from "./window/main-window";
import { closeChatWindow, showChatWindow } from "./window/chat-window";
import { setupAppIdentity } from "./paths";

setupAppIdentity();

log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "debug";

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let handleDeepLink: ((url: string) => void) | null = null;
const pendingLinks: string[] = [];

const dispatchLink = (url: string) => {
  if (handleDeepLink) handleDeepLink(url);
  else pendingLinks.push(url);
};

const consumeArgv = (argv: string[]) => {
  const prefix = `${LZT_CONFIG.protocolScheme}://`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) dispatchLink(arg);
  }
};

app.on("open-url", (event, url) => {
  event.preventDefault();
  dispatchLink(url);
});

app.on("second-instance", (_event, argv) => {
  showMainWindow();
  consumeArgv(argv);
});

app.whenReady().then(async () => {
  await bootstrap();
  await registerProtocol(LZT_CONFIG.protocolScheme);

  const settings = await getSettings();

  registerProxyAuthHandler();
  await applyAppProxy(settings);
  onSettingsChange((next) => void applyAppProxy(next));

  const win = createMainWindow();

  const applySystemSettings = (s: ModeratorSettings): void => {
    app.setLoginItemSettings({ openAtLogin: s.launchOnStartup });
    if (s.showTrayIcon) ensureTray();
    else destroyTray();
    getMainWindow()?.setSkipTaskbar(!s.showTaskbarIcon);
    session.defaultSession.setSpellCheckerEnabled(s.systemSpellcheck);
  };
  applySystemSettings(settings);
  onSettingsChange((next) => applySystemSettings(next));

  const applyAppIcon = (s: ModeratorSettings): void => {
    const img = getIconById(s.appIconId);
    getMainWindow()?.setIcon(img);
    setTrayImage(img);
  };
  applyAppIcon(settings);
  onSettingsChange((next) => applyAppIcon(next));

  handleDeepLink = registerAuthFlow(() => getMainWindow());
  registerInAppAuth(() => getMainWindow());
  const ipcModules: ReadonlyArray<readonly [string, () => void]> = [
    ["auth", registerAuthIpc],
    ["app", registerAppIpc],
    ["window", registerWindowIpc],
    ["settings", registerSettingsIpc],
    ["profile", registerProfileIpc],
    ["mail", registerMailIpc],
    ["market", registerMarketIpc],
    ["market-buy", registerMarketBuyIpc],
    ["checker", registerCheckerIpc],
    ["telegram", registerTelegramIpc],
    ["login", registerLoginIpc],
    ["proxy", registerProxyIpc],
    ["chat", registerChatIpc],
    ["forum", registerForumIpc],
    ["plugins", registerPluginsIpc],
    ["autobump", registerAutoBumpIpc],
    ["auto-reprice", registerAutoRepriceIpc],
    ["market-autobump", registerMarketAutoBumpIpc],
    ["discord-rpc", registerDiscordRpcIpc],
    ["streamer", registerStreamerIpc],
    ["history", registerHistoryIpc],
    ["updater", registerUpdaterIpc],
    ["storage", registerStorageIpc],
  ];
  for (const [name, register] of ipcModules) {
    try {
      register();
    } catch (err) {
      log.error(`[ipc] Не удалось зарегистрировать модуль «${name}»:`, err);
    }
  }

  void startAutoBump();

  void startAutoReprice();
  void startMarketAutoBump();

  void startHistory();

  void startStorageAutoClean();

  void startDiscordRpc();

  let chatWindowEnabled = settings.chatSeparateWindow;
  if (chatWindowEnabled) showChatWindow();
  onSettingsChange((next) => {
    if (next.chatSeparateWindow === chatWindowEnabled) return;
    chatWindowEnabled = next.chatSeparateWindow;
    if (chatWindowEnabled) showChatWindow();
    else closeChatWindow();
  });

  consumeArgv(process.argv);
  for (const url of pendingLinks.splice(0)) handleDeepLink(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  log.info(`[boot] window created (${win.id})`);
});

async function applyAppProxy(settings: ModeratorSettings): Promise<void> {
  syncProxyCreds(settings.proxies);
  const ses = session.defaultSession;
  try {
    const entry =
      settings.proxyEnabled && settings.appProxyId
        ? settings.proxies.find((p) => p.id === settings.appProxyId)
        : undefined;
    if (entry) await applyProxyToSession(ses, entry);
    else await clearProxyFromSession(ses);
  } catch (err) {
    log.warn("[proxy] apply to session failed", err);
  }
}

app.on("before-quit", () => setQuitting(true));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
