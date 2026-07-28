import {
  IPC,
  type PluginInput,
  type PluginSaveResult,
  type PluginSimpleResult,
  type PluginsListResult,
} from "@lzt/shared";
import { ipcMain } from "electron";
import log from "electron-log/main";
import {
  deletePlugin,
  listPlugins,
  savePlugin,
  togglePlugin,
} from "../services/plugins-store";

export const registerPluginsIpc = () => {
  ipcMain.handle(
    IPC.PLUGINS_LIST,
    async (): Promise<PluginsListResult> => ({ plugins: await listPlugins() }),
  );

  ipcMain.handle(
    IPC.PLUGINS_SAVE,
    async (
      _e,
      payload: { input: PluginInput; id?: string },
    ): Promise<PluginSaveResult> => {
      try {
        const plugin = await savePlugin(payload?.input ?? ({} as PluginInput), payload?.id);
        return { ok: true, plugin };
      } catch (err) {
        log.warn("[plugins] save failed", err);
        return {
          ok: false,
          message: err instanceof Error ? err.message : "Не удалось сохранить",
        };
      }
    },
  );

  ipcMain.handle(
    IPC.PLUGINS_DELETE,
    async (_e, payload: { id: string }): Promise<PluginSimpleResult> => {
      await deletePlugin(payload?.id);
      return { ok: true };
    },
  );

  ipcMain.handle(
    IPC.PLUGINS_TOGGLE,
    async (
      _e,
      payload: { id: string; enabled: boolean },
    ): Promise<PluginSimpleResult> => {
      await togglePlugin(payload?.id, payload?.enabled);
      return { ok: true };
    },
  );
};
