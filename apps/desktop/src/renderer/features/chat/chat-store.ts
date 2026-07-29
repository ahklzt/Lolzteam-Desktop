import { create } from "zustand";
import type { ChatMessage, ChatRoom, ProfileFetchReason } from "@lzt/shared";


const merge = (a: ChatMessage[], b: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<number, ChatMessage>();
  for (const m of a) byId.set(m.messageId, m);
  for (const m of b) byId.set(m.messageId, m);
  return [...byId.values()].sort((x, y) => x.messageId - y.messageId);
};

const sameMessages = (a: ChatMessage[], b: ChatMessage[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.messageId !== right.messageId ||
      left.date !== right.date ||
      left.html !== right.html ||
      left.raw !== right.raw ||
      left.isDeleted !== right.isDeleted ||
      left.user.userId !== right.user.userId ||
      left.user.username !== right.user.username ||
      left.user.usernameHtml !== right.user.usernameHtml ||
      left.user.avatarUrl !== right.user.avatarUrl ||
      left.reply?.username !== right.reply?.username ||
      left.reply?.usernameHtml !== right.reply?.usernameHtml ||
      left.reply?.text !== right.reply?.text
    ) {
      return false;
    }
  }
  return true;
};

const sameRooms = (a: ChatRoom[], b: ChatRoom[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.roomId !== right.roomId ||
      left.title !== right.title ||
      left.isEnglish !== right.isEnglish ||
      left.isMarket !== right.isMarket ||
      left.online !== right.online
    ) {
      return false;
    }
  }
  return true;
};

interface ChatState {
  open: boolean;
  rooms: ChatRoom[];
  totalOnline: number | null;
  activeRoomId: number | null;
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
  errorReason: ProfileFetchReason | null;
  errorMessage: string | null;
  myUserId: number | null;
  ignoredIds: number[];
  reply: ChatMessage | null;
  editing: ChatMessage | null;
  draft: string;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setDraft: (draft: string) => void;
  insertDraft: (text: string) => void;
  setReply: (reply: ChatMessage | null) => void;
  setEditing: (editing: ChatMessage | null) => void;
  bootstrap: () => Promise<void>;
  loadRooms: () => Promise<void>;
  selectRoom: (roomId: number) => Promise<void>;
  refresh: () => Promise<void>;
  loadOlder: () => Promise<void>;
  send: (text: string) => Promise<boolean>;
  remove: (messageId: number) => Promise<void>;
  loadIgnored: () => Promise<void>;
  ignore: (userId: number) => Promise<void>;
  unignore: (userId: number) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  rooms: [],
  totalOnline: null,
  activeRoomId: null,
  messages: [],
  hasMore: true,
  loading: false,
  errorReason: null,
  errorMessage: null,
  myUserId: null,
  ignoredIds: [],
  reply: null,
  editing: null,
  draft: "",

  setOpen: (open) => set({ open }),
  toggleOpen: () => set((s) => ({ open: !s.open })),
  setDraft: (draft) => set({ draft }),
  insertDraft: (text) => set((s) => ({ draft: s.draft + text })),
  setReply: (reply) => set({ reply, editing: null }),
  setEditing: (editing) =>
    set({ editing, reply: null, draft: editing ? editing.raw : "" }),

  bootstrap: async () => {
    const s = get();
    if (s.myUserId === null) {
      void window.moderator.profile.getMe().then((res) => {
        if (res.ok) set({ myUserId: res.profile.userId });
      });
    }
    void s.loadIgnored();
    await s.loadRooms();
    const { rooms, activeRoomId } = get();
    const first = rooms[0];
    if (activeRoomId === null && first) await get().selectRoom(first.roomId);
  },

  loadRooms: async () => {
    const res = await window.moderator.chat.getRooms();
    if (res.ok) {
      set((state) => {
        if (
          sameRooms(state.rooms, res.rooms) &&
          state.totalOnline === res.totalOnline &&
          state.errorReason === null &&
          state.errorMessage === null
        ) {
          return state;
        }
        return {
          rooms: res.rooms,
          totalOnline: res.totalOnline,
          errorReason: null,
          errorMessage: null,
        };
      });
    } else {
      set({ errorReason: res.reason, errorMessage: res.message ?? null });
    }
  },

  selectRoom: async (roomId) => {
    set({
      activeRoomId: roomId,
      messages: [],
      hasMore: true,
      loading: true,
      reply: null,
      editing: null,
    });
    const res = await window.moderator.chat.getMessages(roomId);
    if (get().activeRoomId !== roomId) return;
    if (res.ok) {
      set({
        messages: merge([], res.messages),
        loading: false,
        errorReason: null,
        errorMessage: null,
      });
    } else {
      set({
        loading: false,
        errorReason: res.reason,
        errorMessage: res.message ?? null,
      });
    }
  },

  refresh: async () => {
    const roomId = get().activeRoomId;
    if (roomId === null) return;
    const res = await window.moderator.chat.getMessages(roomId);
    if (get().activeRoomId !== roomId) return;
    if (res.ok) {
      set((state) => {
        const nextMessages = merge(state.messages, res.messages);
        if (
          sameMessages(state.messages, nextMessages) &&
          state.errorReason === null &&
          state.errorMessage === null
        ) {
          return state;
        }
        return {
          messages: nextMessages,
          errorReason: null,
          errorMessage: null,
        };
      });
    } else {
      set({ errorReason: res.reason, errorMessage: res.message ?? null });
    }
  },

  loadOlder: async () => {
    const { activeRoomId, messages, loading } = get();
    const oldest = messages[0];
    if (activeRoomId === null || !oldest || loading) return;
    set({ loading: true });
    const res = await window.moderator.chat.getMessages(
      activeRoomId,
      oldest.messageId,
    );
    if (get().activeRoomId !== activeRoomId) return;
    if (res.ok) {
      set((s) => ({
        loading: false,
        hasMore: res.messages.length > 0,
        messages: merge(s.messages, res.messages),
      }));
    } else {
      set({
        loading: false,
        errorReason: res.reason,
        errorMessage: res.message ?? null,
      });
    }
  },

  send: async (text) => {
    const { activeRoomId, editing, reply } = get();
    if (activeRoomId === null) return false;
    const res = editing
      ? await window.moderator.chat.editMessage(editing.messageId, text)
      : await window.moderator.chat.sendMessage(
          activeRoomId,
          text,
          reply?.messageId,
        );
    if (!res.ok) {
      set({ errorReason: res.reason, errorMessage: res.message ?? null });
      return false;
    }
    set({ reply: null, editing: null, draft: "" });
    void get().refresh();
    return true;
  },

  remove: async (messageId) => {
    const res = await window.moderator.chat.deleteMessage(messageId);
    if (res.ok) {
      set((s) => ({
        messages: s.messages.filter((m) => m.messageId !== messageId),
      }));
    } else {
      set({ errorReason: res.reason, errorMessage: res.message ?? null });
    }
  },

  loadIgnored: async () => {
    const res = await window.moderator.chat.getIgnored();
    if (res.ok) set({ ignoredIds: res.users.map((u) => u.userId) });
  },

  ignore: async (userId) => {
    const res = await window.moderator.chat.ignore(userId);
    if (res.ok) set((s) => ({ ignoredIds: [...s.ignoredIds, userId] }));
  },

  unignore: async (userId) => {
    const res = await window.moderator.chat.unignore(userId);
    if (res.ok) {
      set((s) => ({ ignoredIds: s.ignoredIds.filter((id) => id !== userId) }));
    }
  },
}));
