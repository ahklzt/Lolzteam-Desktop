import { IPC, type AppReadFileResult, type NetworkStatus } from "@lzt/shared";
import { app, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import { basename } from "node:path";
import log from "electron-log/main";
import { pingApi } from "../services/lzt-api";
import { getForumWebUrl } from "../services/forum-domain";
import { isInternalLztLink } from "../services/lzt-links";
import { getMainWindow } from "../window/main-window";

const ALLOWED_PREFIXES = ["https://", "http://"];

export const registerAppIpc = () => {
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.APP_PING_API, async (): Promise<NetworkStatus> => {
    const res = await pingApi();
    return res.online
      ? { online: true, ms: res.ms }
      : { online: false, message: "Нет связи с API" };
  });

  ipcMain.handle(
    IPC.APP_OPEN_EXTERNAL,
    async (_e, payload: { url: string; forceExternal?: boolean }) => {
      const url = payload?.url;
      if (
        typeof url !== "string" ||
        !ALLOWED_PREFIXES.some((p) => url.startsWith(p))
      ) {
        throw new Error("Разрешены только http(s)-ссылки");
      }
      if (!payload?.forceExternal && isInternalLztLink(url)) {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC.APP_OPEN_LZT_LINK, { url });
          return;
        }
      }
      await shell.openExternal(url);
    },
  );

  ipcMain.handle(IPC.APP_CLEAR_CACHE, async (): Promise<{ ok: boolean }> => {
    log.info("[app] clear-cache (макет)");
    return { ok: true };
  });

  ipcMain.handle(
    IPC.APP_EXPORT_LOG,
    async (): Promise<{ ok: boolean; path?: string }> => {
      try {
        const src = log.transports.file.getFile().path;
        const res = await dialog.showSaveDialog({
          title: "Сохранить лог",
      defaultPath: `lolzteam-desktop-${new Date().toISOString().slice(0, 10)}.log`,
          filters: [{ name: "Логи", extensions: ["log", "txt"] }],
        });
        if (res.canceled || !res.filePath) return { ok: false };
        await fs.copyFile(src, res.filePath);
        return { ok: true, path: res.filePath };
      } catch (err) {
        log.warn("[app] export-log failed", err);
        return { ok: false };
      }
    },
  );

  ipcMain.handle(IPC.APP_GET_FORUM_WEB_URL, () => getForumWebUrl());

  ipcMain.handle(
    IPC.APP_PICK_DIRECTORY,
    async (_e, payload?: { title?: string }): Promise<string | null> => {
      const res = await dialog.showOpenDialog({
        title: payload?.title,
        properties: ["openDirectory"],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return res.filePaths[0] ?? null;
    },
  );

  ipcMain.handle(
    IPC.APP_PICK_FILE,
    async (
      _e,
      payload?: { title?: string; extensions?: string[] },
    ): Promise<string | null> => {
      const extensions = (payload?.extensions ?? [])
        .map((ext) => ext.replace(/^\./, "").trim())
        .filter((ext) => ext.length > 0);
      const filters =
        extensions.length > 0
          ? [{ name: "Файлы", extensions }]
          : undefined;
      const res = await dialog.showOpenDialog({
        title: payload?.title,
        properties: ["openFile"],
        ...(filters ? { filters } : {}),
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return res.filePaths[0] ?? null;
    },
  );

  const MAX_READ_FILE_BYTES = 20 * 1024 * 1024;

  ipcMain.handle(
    IPC.APP_READ_FILE,
    async (_e, payload?: { path?: string }): Promise<AppReadFileResult> => {
      const filePath = payload?.path;
      if (typeof filePath !== "string" || !filePath) {
        return { ok: false, message: "Путь к файлу не указан" };
      }
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
          return { ok: false, message: "Выбранный путь не является файлом" };
        }
        if (stat.size > MAX_READ_FILE_BYTES) {
          return { ok: false, message: "Файл слишком большой (более 20 МБ)" };
        }
        const buffer = await fs.readFile(filePath);
        return {
          ok: true,
          name: basename(filePath),
          size: stat.size,
          text: buffer.toString("utf8"),
          base64: buffer.toString("base64"),
        };
      } catch (err) {
        log.warn("[app] read-file failed", err);
        return { ok: false, message: "Не удалось прочитать файл" };
      }
    },
  );
};
