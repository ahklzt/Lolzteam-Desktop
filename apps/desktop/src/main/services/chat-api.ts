import {
  LZT_CONFIG,
  type ChatActionResult,
  type ChatIgnoredResult,
  type ChatLeaderboardDuration,
  type ChatLeaderboardEntry,
  type ChatLeaderboardResult,
  type ChatMessage,
  type ChatMessagesResult,
  type ChatOnlineResult,
  type ChatReplyPreview,
  type ChatRoom,
  type ChatRoomsResult,
  type ChatRulesResult,
  type ChatSendResult,
  type ChatUser,
  type ChatUserStats,
  type ProfileFetchReason,
} from "@lzt/shared";
import log from "electron-log/main";
import { getProfileToken } from "./profile-token";
import { appFetch } from "./app-fetch";

type Raw = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15_000;

export const CHAT_RULES_THREAD_ID = 43694;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const apiFetch = async (
  path: string,
  token: string,
  init?: { method?: HttpMethod; body?: Raw },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Api-Username-Inline-Style": "1",
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  try {
    return await appFetch(`${LZT_CONFIG.forumApiUrl}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const statusToReason = (status: number): ProfileFetchReason => {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  return "offline";
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const flag = (v: unknown): boolean => {
  const n = num(v);
  if (n !== null) return n !== 0;
  return v === true;
};

const obj = (v: unknown): Raw | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null;

const apiError = async (res: Response): Promise<string | undefined> => {
  try {
    const data = (await res.json()) as Raw;
    const errors = data["errors"];
    if (Array.isArray(errors) && typeof errors[0] === "string") {
      return errors[0];
    }
  } catch {
  }
  return undefined;
};

const fail = (reason: ProfileFetchReason, message?: string) =>
  ({ ok: false, reason, message }) as const;

const mapChatUser = (raw: Raw): ChatUser => {
  const rendered = obj(raw["rendered"]) ?? {};
  const avatars = obj(rendered["avatars"]) ?? {};
  return {
    userId: num(raw["user_id"]) ?? 0,
    username: str(raw["username"]) ?? "",
    usernameHtml: str(rendered["username"]),
    avatarUrl: str(avatars["m"]) ?? str(avatars["s"]) ?? str(avatars["l"]),
  };
};

const mapUserStats = (raw: Raw): ChatUserStats => ({
  likeCount: num(raw["like_count"]) ?? 0,
  sympathyCount: num(raw["like2_count"]) ?? 0,
  messageCount: num(raw["message_count"]) ?? 0,
  trophyPoints: num(raw["trophy_points"]) ?? 0,
  contestCount: num(raw["contest_count"]) ?? 0,
});

const replyFromRaw = (r: Raw): ChatReplyPreview => {
  const user = obj(r["user"]) ?? r;
  const rendered = obj(user["rendered"]) ?? {};
  return {
    username: str(user["username"]),
    usernameHtml: str(rendered["username"]),
    text: str(r["messageRaw"]) ?? str(r["message"]) ?? str(r["text"]),
  };
};

const extractReply = (raw: Raw): ChatReplyPreview | null => {
  const direct = obj(raw["reply_message"]);
  if (direct) return replyFromRaw(direct);
  const source = str(raw["messageJson"]);
  if (!source) return null;
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return null;
  }
  const j = obj(data);
  if (!j) return null;
  for (const key of ["reply", "reply_message", "quote", "quoted_message"]) {
    const r = obj(j[key]);
    if (r) return replyFromRaw(r);
  }
  return null;
};

const mapMessage = (raw: Raw): ChatMessage => ({
  messageId: num(raw["message_id"]) ?? 0,
  date: num(raw["date"]) ?? 0,
  html: str(raw["message"]) ?? "",
  raw: str(raw["messageRaw"]) ?? "",
  isDeleted: flag(raw["is_deleted"]),
  reply: extractReply(raw),
  user: mapChatUser(obj(raw["user"]) ?? {}),
});


export const fetchChatRooms = async (): Promise<ChatRoomsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("/chatbox", token);
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;

    let totalOnline: number | null = null;
    const onlineByRoom = new Map<number, number>();
    const rawOnline = data["roomsOnline"];
    if (typeof rawOnline === "number") {
      totalOnline = rawOnline;
    } else if (obj(rawOnline)) {
      for (const [key, value] of Object.entries(rawOnline as Raw)) {
        const count = num(value);
        if (count === null) continue;
        if (key === "total") {
          totalOnline = count;
          continue;
        }
        const id = num(key);
        if (id !== null) onlineByRoom.set(id, count);
      }
      if (totalOnline === null && onlineByRoom.size > 0) {
        totalOnline = [...onlineByRoom.values()].reduce((a, b) => a + b, 0);
      }
    }

    const rows = Array.isArray(data["rooms"]) ? (data["rooms"] as Raw[]) : [];
    const rooms: ChatRoom[] = rows.map((row) => {
      const id = num(row["room_id"]) ?? 0;
      return {
        roomId: id,
        title: str(row["title"]) ?? `#${id}`,
        isEnglish: flag(row["eng"]),
        isMarket: flag(row["market"]),
        online: onlineByRoom.get(id) ?? null,
      };
    });
    return { ok: true, rooms, totalOnline };
  } catch (err) {
    log.warn("[chat] rooms failed", err);
    return fail("offline");
  }
};

export const fetchChatMessages = async (
  roomId: number,
  beforeMessageId?: number,
): Promise<ChatMessagesResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const older = beforeMessageId ? `&before_message_id=${beforeMessageId}` : "";
    const res = await apiFetch(`/chatbox/messages?room_id=${roomId}${older}`, token);
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const rows = Array.isArray(data["messages"]) ? (data["messages"] as Raw[]) : [];
    return { ok: true, messages: rows.map(mapMessage) };
  } catch (err) {
    log.warn("[chat] messages failed", err);
    return fail("offline");
  }
};

export const sendChatMessage = async (
  roomId: number,
  message: string,
  replyMessageId?: number,
): Promise<ChatSendResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const body: Raw = { room_id: roomId, message };
    if (replyMessageId) body["reply_message_id"] = replyMessageId;
    const res = await apiFetch("/chatbox/messages", token, { method: "POST", body });
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const msg = obj(data["message"]);
    return { ok: true, message: msg ? mapMessage(msg) : null };
  } catch (err) {
    log.warn("[chat] send failed", err);
    return fail("offline");
  }
};

export const editChatMessage = async (
  messageId: number,
  message: string,
): Promise<ChatSendResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("/chatbox/messages", token, {
      method: "PUT",
      body: { message_id: messageId, message },
    });
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const msg = obj(data["message"]);
    return { ok: true, message: msg ? mapMessage(msg) : null };
  } catch (err) {
    log.warn("[chat] edit failed", err);
    return fail("offline");
  }
};

export const deleteChatMessage = async (
  messageId: number,
): Promise<ChatActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("/chatbox/messages", token, {
      method: "DELETE",
      body: { message_id: messageId },
    });
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    return { ok: true };
  } catch (err) {
    log.warn("[chat] delete failed", err);
    return fail("offline");
  }
};

export const fetchChatOnline = async (
  roomId: number,
): Promise<ChatOnlineResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(`/chatbox/messages/online?room_id=${roomId}`, token);
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const rows = Array.isArray(data["users"]) ? (data["users"] as Raw[]) : [];
    return {
      ok: true,
      users: rows.map((u) => ({ ...mapChatUser(u), ...mapUserStats(u) })),
    };
  } catch (err) {
    log.warn("[chat] online failed", err);
    return fail("offline");
  }
};

export const fetchChatLeaderboard = async (
  duration: ChatLeaderboardDuration,
): Promise<ChatLeaderboardResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(`/chatbox/messages/leaderboard?duration=${duration}`, token);
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const rows = Array.isArray(data["leaderboard"])
      ? (data["leaderboard"] as Raw[])
      : [];
    const entries: ChatLeaderboardEntry[] = rows.map((row) => {
      const user = obj(row["user"]) ?? row;
      return {
        ...mapChatUser(user),
        ...mapUserStats(user),
        count: num(row["count"]) ?? 0,
      };
    });
    return { ok: true, entries };
  } catch (err) {
    log.warn("[chat] leaderboard failed", err);
    return fail("offline");
  }
};

export const fetchChatIgnored = async (): Promise<ChatIgnoredResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("/chatbox/ignore", token);
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    const data = (await res.json()) as Raw;
    const rows = Array.isArray(data["ignored"]) ? (data["ignored"] as Raw[]) : [];
    return { ok: true, users: rows.map(mapChatUser) };
  } catch (err) {
    log.warn("[chat] ignored failed", err);
    return fail("offline");
  }
};

const toggleIgnore = async (
  userId: number,
  method: "POST" | "DELETE",
): Promise<ChatActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("/chatbox/ignore", token, {
      method,
      body: { user_id: userId },
    });
    if (!res.ok) return fail(statusToReason(res.status), await apiError(res));
    return { ok: true };
  } catch (err) {
    log.warn("[chat] ignore toggle failed", err);
    return fail("offline");
  }
};

export const ignoreChatUser = (userId: number): Promise<ChatActionResult> =>
  toggleIgnore(userId, "POST");

export const unignoreChatUser = (userId: number): Promise<ChatActionResult> =>
  toggleIgnore(userId, "DELETE");

export const fetchChatRules = async (): Promise<ChatRulesResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(`/threads/${CHAT_RULES_THREAD_ID}`, token);
    if (res.ok) {
      const data = (await res.json()) as Raw;
      const thread = obj(data["thread"]) ?? data;
      const post = obj(thread["first_post"]);
      const html = post ? (str(post["post_body_html"]) ?? str(post["post_body"])) : null;
      if (html) return { ok: true, html };
    }
    const fallback = await apiFetch(
      `/posts?thread_id=${CHAT_RULES_THREAD_ID}&limit=1`,
      token,
    );
    if (!fallback.ok) {
      return fail(statusToReason(fallback.status), await apiError(fallback));
    }
    const data = (await fallback.json()) as Raw;
    const posts = Array.isArray(data["posts"]) ? (data["posts"] as Raw[]) : [];
    const first = posts[0];
    const html = first
      ? (str(first["post_body_html"]) ?? str(first["post_body"]))
      : null;
    if (html) return { ok: true, html };
    return fail("not_found");
  } catch (err) {
    log.warn("[chat] rules failed", err);
    return fail("offline");
  }
};
