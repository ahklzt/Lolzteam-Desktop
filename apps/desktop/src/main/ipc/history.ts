import {
  IPC,
  type HistoryKind,
  type HistoryObservePayload,
  type HistoryQuery,
} from "@lzt/shared";
import { ipcMain } from "electron";
import {
  cacheHistoryMedia,
  clearHistory,
  deleteHistoryEntry,
  getDataUsage,
  getHistoryEntry,
  getHistoryMarkers,
  getHistoryMedia,
  observeHistory,
  purgeHistory,
  queryHistory,
} from "../services/data-store";

export const registerHistoryIpc = (): void => {
  ipcMain.handle(IPC.HISTORY_QUERY, (_e, q: HistoryQuery) =>
    queryHistory(q ?? {}),
  );

  ipcMain.handle(IPC.HISTORY_GET_ENTRY, (_e, p: { id: string }) =>
    getHistoryEntry(p?.id ?? ""),
  );

  ipcMain.handle(IPC.HISTORY_OBSERVE, (_e, payload: HistoryObservePayload) =>
    observeHistory(payload),
  );

  ipcMain.handle(IPC.HISTORY_DELETE_ENTRY, (_e, p: { id: string }) =>
    deleteHistoryEntry(p?.id ?? ""),
  );

  ipcMain.handle(IPC.HISTORY_CLEAR, (_e, p: { kinds?: HistoryKind[] }) =>
    clearHistory(p?.kinds),
  );

  ipcMain.handle(IPC.HISTORY_MARKERS, () => getHistoryMarkers());

  ipcMain.handle(
    IPC.HISTORY_CACHE_MEDIA,
    (_e, p: { url: string; webpBase64: string }) =>
      cacheHistoryMedia(p?.url ?? "", p?.webpBase64 ?? ""),
  );

  ipcMain.handle(IPC.HISTORY_GET_MEDIA, (_e, p: { id: string }) =>
    getHistoryMedia(p?.id ?? ""),
  );

  ipcMain.handle(IPC.HISTORY_GET_USAGE, () => getDataUsage());

  ipcMain.handle(IPC.HISTORY_PURGE, () => purgeHistory());
};
