import { ipcMain } from "electron";
import { IPC, type ChatLeaderboardDuration } from "@lzt/shared";
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatIgnored,
  fetchChatLeaderboard,
  fetchChatMessages,
  fetchChatOnline,
  fetchChatRooms,
  fetchChatRules,
  ignoreChatUser,
  sendChatMessage,
  unignoreChatUser,
} from "../services/chat-api";
import { showChatWindow } from "../window/chat-window";

export const registerChatIpc = (): void => {
  ipcMain.handle(IPC.CHAT_GET_ROOMS, () => fetchChatRooms());

  ipcMain.handle(
    IPC.CHAT_GET_MESSAGES,
    (_e, p: { roomId: number; beforeMessageId?: number }) =>
      fetchChatMessages(p.roomId, p.beforeMessageId),
  );

  ipcMain.handle(
    IPC.CHAT_SEND_MESSAGE,
    (_e, p: { roomId: number; message: string; replyMessageId?: number }) =>
      sendChatMessage(p.roomId, p.message, p.replyMessageId),
  );

  ipcMain.handle(
    IPC.CHAT_EDIT_MESSAGE,
    (_e, p: { messageId: number; message: string }) =>
      editChatMessage(p.messageId, p.message),
  );

  ipcMain.handle(IPC.CHAT_DELETE_MESSAGE, (_e, p: { messageId: number }) =>
    deleteChatMessage(p.messageId),
  );

  ipcMain.handle(IPC.CHAT_GET_ONLINE, (_e, p: { roomId: number }) =>
    fetchChatOnline(p.roomId),
  );

  ipcMain.handle(
    IPC.CHAT_GET_LEADERBOARD,
    (_e, p: { duration: ChatLeaderboardDuration }) =>
      fetchChatLeaderboard(p.duration),
  );

  ipcMain.handle(IPC.CHAT_GET_IGNORED, () => fetchChatIgnored());

  ipcMain.handle(IPC.CHAT_IGNORE, (_e, p: { userId: number }) =>
    ignoreChatUser(p.userId),
  );

  ipcMain.handle(IPC.CHAT_UNIGNORE, (_e, p: { userId: number }) =>
    unignoreChatUser(p.userId),
  );

  ipcMain.handle(IPC.CHAT_GET_RULES, () => fetchChatRules());

  ipcMain.handle(IPC.CHAT_OPEN_WINDOW, () => {
    showChatWindow();
  });
};
