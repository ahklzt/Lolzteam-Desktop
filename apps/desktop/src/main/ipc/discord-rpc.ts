import {
  IPC,
  type DiscordPresenceActivity,
  type DiscordRpcSettings,
} from "@lzt/shared";
import { ipcMain } from "electron";
import {
  getDiscordRpcSnapshot,
  reconnectDiscordRpc,
  setDiscordRpcActivity,
  setDiscordRpcSettings,
} from "../services/discord-rpc";

export const registerDiscordRpcIpc = (): void => {
  ipcMain.handle(IPC.DISCORD_RPC_GET, () => getDiscordRpcSnapshot());

  ipcMain.handle(
    IPC.DISCORD_RPC_SET,
    (_e, patch: Partial<DiscordRpcSettings>) => setDiscordRpcSettings(patch),
  );

  ipcMain.handle(IPC.DISCORD_RPC_RECONNECT, () => reconnectDiscordRpc());

  ipcMain.on(
    IPC.DISCORD_RPC_SET_ACTIVITY,
    (_e, activity: DiscordPresenceActivity) => {
      void setDiscordRpcActivity(activity);
    },
  );
};
