import {
  LZT_CONFIG,
  type ErrorReportPayload,
  type ErrorReportResult,
  type FollowOptions,
  type FollowersResult,
  type FullProfile,
  type ProfileActionResult,
  type ProfileCustomField,
  type ProfileFetchReason,
  type ProfileFetchResult,
  type ProfileFollower,
  type ProfileStat,
  type UserBan,
  type UserClaim,
  type UserClaimsResult,
  type UserThread,
  type UserThreadsResult,
  type PersonalDisplayGroup,
  type PersonalInfo,
  type PersonalInfoResult,
  type PersonalInfoUpdate,
  type ContactInfo,
  type ContactInfoResult,
  type ContactInfoUpdate,
  type ProfilePreferences,
  type PreferencesResult,
  type ProfilePreferencesUpdate,
  type PrivacySettings,
  type PrivacyResult,
  type PrivacySettingsUpdate,
  type PrivacyAudience,
  type IgnoredUser,
  type IgnoredUsersResult,
  type NotificationItem,
  type NotificationsResult,
  type SecretAnswerType,
  type SecretAnswerInfoResult,
  type SecretAnswerUpdate,
  type SecretResetResult,
  type ConversationItem,
  type ConversationMessage,
  type ConversationMessagesResult,
  type ConversationParticipant,
  type ConversationsResult,
  type ForumSearchUser,
  type ForumSearchUsersResult,
  type ProfilePost,
  type ProfilePostComment,
  type ProfileTrophy,
  type ProfilePostsResult,
  type ProfilePostCommentsResult,
  type ProfilePostMutationResult,
  type ProfilePostCommentMutationResult,
  type ProfileTrophiesResult,
} from "@lzt/shared";
import log from "electron-log/main";
import { getProfileToken } from "./profile-token";
import { appFetch } from "./app-fetch";
import { getForumWebUrl, rememberForumUrl } from "./forum-domain";
import { getCache, invalidateCache, setCache } from "./session-cache";
import { getSettings } from "../settings/settings-store";

type Raw = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15_000;
const SCHEME = "https" + "://";
const ERROR_REPORT_RECIPIENT_ID = 4_315_635;
const ERROR_REPORT_COOLDOWN_MS = 60_000;

let pendingErrorReportSignature = "";
let lastErrorReportSignature = "";
let lastErrorReportAt = 0;

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
  if (status === 429) return "rate_limited";
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

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");

const stripHtml = (s: string): string =>
  decodeEntities(s.replace(/<[^>]*>/g, "")).trim();

const extractColor = (html: unknown): string | null => {
  const s = str(html);
  if (!s) return null;
  const m = /color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))/.exec(s);
  return m?.[1] ?? null;
};

const pickAvatar = (user: Raw): string | null => {
  const rendered = user.rendered as Raw | undefined;
  const avatars = rendered?.avatars as Raw | undefined;
  const links = user.links as Raw | undefined;
  return (
    str(avatars?.l) ??
    str(avatars?.m) ??
    str(avatars?.s) ??
    str(links?.avatar_big) ??
    str(links?.avatar) ??
    str(user.avatar) ??
    str(user.avatar_url) ??
    null
  );
};

const pickBanner = (user: Raw, links: Raw | undefined): string | null => {
  const raw =
    str(links?.background_l) ??
    str(links?.background_m) ??
    str(links?.cover) ??
    null;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("//")) return "https:" + raw;
  const host = getForumWebUrl();
  return raw.startsWith("/") ? host + raw : host + "/" + raw;
};

const pickColor = (user: Raw): string | null => {
  const rendered = user.rendered as Raw | undefined;
  return extractColor(rendered?.username) ?? extractColor(user.username_html);
};

const buildBirthday = (user: Raw): string | null => {
  const d = num(user.user_dob_day);
  const m = num(user.user_dob_month);
  const y = num(user.user_dob_year);
  const parts: string[] = [];
  if (d) parts.push(String(d).padStart(2, "0"));
  if (m) parts.push(String(m).padStart(2, "0"));
  if (y) parts.push(String(y));
  return parts.length > 0 ? parts.join(".") : null;
};

const KNOWN_FIELD_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord",
  vk: "ВКонтакте",
  steam: "Steam",
  github: "GitHub",
  homepage: "Сайт",
  website: "Сайт",
  occupation: "Род занятий",
  location: "Адрес",
  interests: "Интересы",
  jabber: "Jabber",
  matrix: "Matrix",
  favoriteanime: "Любимое аниме",
  favoriteporn: "Любимое порно",
  favoritevape: "Любимая ашкудишка",
};

const fieldTitles = new Map<string, string>();
let fieldTitlesLoaded = false;

const ensureFieldTitles = async (token: string): Promise<void> => {
  if (fieldTitlesLoaded) return;
  fieldTitlesLoaded = true;
  try {
    const res = await apiFetch("/users/fields", token);
    if (!res.ok) {
      fieldTitlesLoaded = false;
      return;
    }
    const data = (await res.json()) as Raw;
    const list = data.fields;
    if (!Array.isArray(list)) return;
    for (const item of list as Raw[]) {
      const id = str(item.id);
      const title = str(item.title);
      if (id && title) fieldTitles.set(id.toLowerCase(), title);
    }
  } catch {
    fieldTitlesLoaded = false;
  }
};

const fieldValueToString = (v: unknown): string | null => {
  if (typeof v === "string") return str(v);
  if (v && typeof v === "object") {
    const o = v as Raw;
    return str(o.value) ?? str(o.text) ?? str(o.title) ?? null;
  }
  const n = num(v);
  return n !== null ? String(n) : null;
};

const buildFieldHref = (id: string, value: string): string | undefined => {
  const low = value.toLowerCase();
  if (low.startsWith("http://") || low.startsWith("https://")) return value;
  const handle = value.replace(/^@/, "").trim();
  switch (id) {
    case "telegram":
      return `${SCHEME}t.me/${handle}`;
    case "vk":
      return `${SCHEME}vk.com/${handle}`;
    case "steam":
      return `${SCHEME}steamcommunity.com/id/${handle}`;
    case "github":
      return `${SCHEME}github.com/${handle}`;
    case "homepage":
    case "website":
      return `${SCHEME}${value.replace(/^\/+/, "")}`;
    default:
      return undefined;
  }
};

const EXCLUDED_FIELD_IDS = new Set(["gender", "about"]);

const buildCustomFields = (user: Raw): ProfileCustomField[] => {
  const out: ProfileCustomField[] = [];
  const push = (
    id: string,
    title: string | null,
    value: string | null,
  ): void => {
    if (!id || !value || EXCLUDED_FIELD_IDS.has(id)) return;
    if (out.some((f) => f.key === id)) return;
    const label =
      title ??
      fieldTitles.get(id.toLowerCase()) ??
      KNOWN_FIELD_LABELS[id.toLowerCase()] ??
      id;
    const href = buildFieldHref(id.toLowerCase(), value);
    out.push(
      href ? { key: id, label, value, href } : { key: id, label, value },
    );
  };

  const raw = user.fields;
  if (Array.isArray(raw)) {
    const weight = (p: unknown): number => (str(p) === "contact" ? 0 : 1);
    const sorted = [...(raw as Raw[])].sort(
      (a, b) => weight(a.position) - weight(b.position),
    );
    for (const item of sorted) {
      push(str(item.id) ?? "", str(item.title), fieldValueToString(item.value));
    }
  }

  const sources = [raw, user.custom_fields].filter(
    (s): s is Raw =>
      Boolean(s) && typeof s === "object" && !Array.isArray(s),
  );
  for (const src of sources) {
    for (const [key, val] of Object.entries(src)) {
      push(
        key,
        fieldTitles.get(key.toLowerCase()) ??
          KNOWN_FIELD_LABELS[key.toLowerCase()] ??
          null,
        fieldValueToString(val),
      );
    }
  }
  return out;
};

const nestedCount = (v: unknown): number | null => {
  if (v && typeof v === "object") return num((v as Raw).count);
  return num(v);
};

const STAT_SOURCES: Array<{ key: string; get: (u: Raw) => number | null }> = [
  { key: "sympathies", get: (u) => num(u.user_like_count) },
  { key: "likes", get: (u) => num(u.user_like2_count) },
  { key: "messages", get: (u) => num(u.user_message_count) },
  { key: "trophies", get: (u) => num(u.trophy_count) },
  { key: "giveaways", get: (u) => num(u.contest_count) },
  { key: "followings", get: (u) => nestedCount(u.user_following) },
  { key: "followers", get: (u) => nestedCount(u.user_followers) },
];

const buildStats = (user: Raw): ProfileStat[] => {
  const out: ProfileStat[] = [];
  for (const { key, get } of STAT_SOURCES) {
    const value = get(user);
    if (value !== null) out.push({ key, value });
  }
  return out;
};

const buildDescription = (user: Raw): string | null => {
  const direct =
    str(user.user_about) ?? str(user.about) ?? str(user.description);
  if (direct) return direct;
  const raw = user.fields;
  if (Array.isArray(raw)) {
    const about = (raw as Raw[]).find(
      (f) => str(f.id)?.toLowerCase() === "about",
    );
    if (about) return fieldValueToString(about.value);
  } else if (raw && typeof raw === "object") {
    const val = (raw as Raw).about;
    if (val !== undefined) return fieldValueToString(val);
  }
  const cf = user.custom_fields;
  if (cf && typeof cf === "object") {
    const val = (cf as Raw).about;
    if (val !== undefined) return fieldValueToString(val);
  }
  return null;
};

const mapUser = (user: Raw): FullProfile => {
  const links = user.links as Raw | undefined;
  const rendered = user.rendered as Raw | undefined;
  const status = user.user_status as Raw | undefined;
  const gender = str(user.user_gender)?.toLowerCase();
  const banRaw = user.ban as Raw | undefined;
  const ban: UserBan | null =
    banRaw && typeof banRaw === "object"
      ? {
          date: num(banRaw.ban_date),
          endDate: num(banRaw.end_date),
          reasonHtml: str(banRaw.reason),
          reasonText: str(user.ban_reason),
          author: str(banRaw.author),
        }
      : flag(user.is_banned)
        ? {
            date: null,
            endDate: null,
            reasonHtml: null,
            reasonText: str(user.ban_reason),
            author: null,
          }
        : null;
  return {
    userId: num(user.user_id) ?? 0,
    username: str(user.username) ?? "—",
    usernameColor: pickColor(user),
    usernameHtml: str(rendered?.username) ?? str(user.username_html),
    avatarUrl: pickAvatar(user),
    bannerUrl: pickBanner(user, links),
    bannerHtml: str(user.banner),
    userTitle: str(user.user_title),
    description: buildDescription(user),
    statusMessage: str(user.user_message) ?? str(status?.message) ?? null,
    isOnline:
      "user_is_online" in user
        ? flag(user.user_is_online)
        : status && "is_online" in status
          ? flag(status.is_online)
          : null,
    registerDate: num(user.user_register_date),
    lastSeenDate: num(user.user_last_seen_date),
    gender: gender === "male" ? "male" : gender === "female" ? "female" : null,
    birthday: buildBirthday(user),
    profileUrl: str(user.view_url) ?? str(links?.permalink) ?? null,
    isVerified: flag(user.user_is_verified) || flag(user.is_verified),
    customFields: buildCustomFields(user),
    stats: buildStats(user),
    deposit: num(user.user_deposit),
    isFollowed: flag(user.user_is_followed),
    isIgnored: flag(user.user_is_ignored),
    isBanned: flag(user.is_banned),
    ban,
    following: nestedUsers(user.user_following),
    followers: nestedUsers(user.user_followers),
    threads: Array.isArray(user.profile_threads)
      ? (user.profile_threads as Raw[])
          .map(mapThread)
          .filter((t): t is UserThread => t !== null)
      : [],
  };
};

const mapFollower = (user: Raw): ProfileFollower | null => {
  const userId = num(user.user_id);
  const username = str(user.username);
  if (userId === null || !username) return null;
  return {
    userId,
    username,
    usernameColor: pickColor(user),
    usernameHtml:
      str(user.username_html) ??
      str((user.rendered as Raw | undefined)?.username),
    avatarUrl: pickAvatar(user),
    userTitle: str(user.user_title),
  };
};

const nestedUsers = (v: unknown): ProfileFollower[] => {
  if (!v || typeof v !== "object") return [];
  const users = (v as Raw).users;
  if (!Array.isArray(users)) return [];
  return (users as Raw[])
    .map(mapFollower)
    .filter((f): f is ProfileFollower => f !== null);
};

const prefixColorFromCss = (cssClass: string | null): string | null => {
  if (!cssClass) return null;
  const m = cssClass.match(/#[0-9a-fA-F]{3,8}/);
  return m ? m[0] : null;
};

const mapThread = (thread: Raw): UserThread | null => {
  const threadId = num(thread.thread_id);
  const title = str(thread.thread_title);
  if (threadId === null || !title) return null;
  const rawPrefixes = thread.thread_prefixes;
  const prefixes = Array.isArray(rawPrefixes)
    ? (rawPrefixes as Raw[])
        .map((p) => {
          const ptitle = str(p.prefix_title);
          const rawCls = str(p.css_class);
          const cssClass = rawCls
            ? rawCls
                .replace(/#[0-9a-fA-F]{3,8}/g, "")
                .replace(/ +/g, " ")
                .trim()
            : null;
          return ptitle
            ? {
                title: ptitle,
                color: prefixColorFromCss(str(p.css_class)),
                cssClass,
              }
            : null;
        })
        .filter(
          (
            p,
          ): p is {
            title: string;
            color: string | null;
            cssClass: string | null;
          } => p !== null,
        )
    : [];
  const firstPost = thread.first_post as Raw | undefined;
  const likeCount =
    num(firstPost?.post_like_count) ?? num(thread.first_post_likes);
  return {
    threadId,
    title,
    createDate: num(thread.thread_create_date),
    postCount: num(thread.thread_post_count),
    viewCount: num(thread.thread_view_count),
    likeCount,
    prefixes,
    creatorUserId: num(thread.creator_user_id),
    creatorUsername: str(thread.creator_username),
    creatorUsernameHtml: str(thread.creator_username_html),
    url:
      str(thread.permalink) ??
      str((thread.links as Raw | undefined)?.permalink) ??
      null,
  };
};

const parseUserResponse = async (
  res: Response,
): Promise<ProfileFetchResult> => {
  if (res.status === 401 || res.status === 403)
    return { ok: false, reason: "unauthorized" };
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok)
    return { ok: false, reason: "offline", message: `http_${res.status}` };
  const data = (await res.json()) as { user?: Raw };
  if (!data.user || num(data.user.user_id) === null)
    return { ok: false, reason: "not_found" };
  return { ok: true, profile: mapUser(data.user) };
};

export const validateAndFetchMe = async (
  token: string,
): Promise<ProfileFetchResult> => {
  try {
    await ensureFieldTitles(token);
    const res = await apiFetch("/users/me?fields_include=*", token);
    return await parseUserResponse(res);
  } catch (err) {
    log.warn("[profile] /users/me failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchMe = async (): Promise<ProfileFetchResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  return validateAndFetchMe(token);
};

type ParsedQuery =
  { kind: "id"; id: number } | { kind: "username"; username: string } | null;

export const parseProfileQuery = (input: string): ParsedQuery => {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { kind: "id", id: Number.parseInt(s, 10) };
  if (s.startsWith("@")) {
    const username = s.slice(1).trim();
    return username ? { kind: "username", username } : null;
  }

  let segment = s;
  const looksLikeUrl =
    /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s);
  if (looksLikeUrl) {
    const withScheme = /^https?:\/\//i.test(s) ? s : `${SCHEME}${s}`;
    try {
      const url = new URL(withScheme);
      const segments = url.pathname.split("/").filter(Boolean);
      const membersIdx = segments.indexOf("members");
      if (membersIdx >= 0 && segments[membersIdx + 1]) {
        segment = segments[membersIdx + 1] as string;
      } else if (segments.length > 0) {
        segment = segments[segments.length - 1] as string;
      } else {
        segment = "";
      }
    } catch {}
  }

  if (!segment) return null;
  const dotId = /\.(\d{2,})$/.exec(segment)?.[1];
  if (dotId) return { kind: "id", id: Number.parseInt(dotId, 10) };
  if (/^\d+$/.test(segment))
    return { kind: "id", id: Number.parseInt(segment, 10) };
  const username = segment.replace(/^@/, "").trim();
  return username ? { kind: "username", username } : null;
};

const fetchById = async (
  token: string,
  id: number,
): Promise<ProfileFetchResult> => {
  await ensureFieldTitles(token);
  const res = await apiFetch(`/users/${id}?fields_include=*`, token);
  return parseUserResponse(res);
};

export const fetchUser = async (query: string): Promise<ProfileFetchResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const parsed = parseProfileQuery(query);
  if (!parsed) return { ok: false, reason: "bad_query" };
  try {
    if (parsed.kind === "id") return await fetchById(token, parsed.id);
    const res = await apiFetch(
      `/users/find?username=${encodeURIComponent(parsed.username)}`,
      token,
    );
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: "unauthorized" };
    if (!res.ok)
      return { ok: false, reason: "offline", message: `http_${res.status}` };
    const data = (await res.json()) as { users?: Raw[] };
    const users = data.users ?? [];
    const wanted = parsed.username.toLowerCase();
    const exact = users.find((u) => str(u.username)?.toLowerCase() === wanted);
    const first = exact ?? users[0];
    const foundId = first ? num(first.user_id) : null;
    if (foundId === null) return { ok: false, reason: "not_found" };
    return await fetchById(token, foundId);
  } catch (err) {
    log.warn("[profile] fetchUser failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchFollowers = async (
  userId: number,
  limit = 30,
): Promise<FollowersResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch(
      `/users/${userId}/followers?limit=${limit}`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { users?: Raw[] };
    const followers = (data.users ?? [])
      .map(mapFollower)
      .filter((f): f is ProfileFollower => f !== null);
    return { ok: true, followers };
  } catch (err) {
    log.warn("[profile] fetchFollowers failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchUserThreads = async (
  userId: number,
  limit = 3,
): Promise<UserThreadsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch(
      `/threads?creator_user_id=${userId}&limit=${limit}&order=thread_create_date&direction=desc&fields_include=*`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { threads?: Raw[] };
    const threads = (data.threads ?? [])
      .map(mapThread)
      .filter((t): t is UserThread => t !== null)
      .slice(0, limit);
    return { ok: true, threads };
  } catch (err) {
    log.warn("[profile] fetchUserThreads failed", err);
    return { ok: false, reason: "offline" };
  }
};

const mapClaim = (
  claim: Raw,
  type: "market" | "nomarket",
): UserClaim | null => {
  const threadId = num(claim.thread_id);
  if (threadId === null) return null;
  const author = (claim.author as Raw | undefined) ?? {};
  return {
    threadId,
    claimDate: num(claim.claim_date),
    claimState: str(claim.claim_state),
    messageHtml: str(claim.message_body_html) ?? str(claim.message_body),
    messageText: str(claim.message_body_plain_text) ?? str(claim.message_body),
    amount: num(claim.amount),
    amountFormatted: str(claim.amount_formatted),
    authorUserId: num(author.user_id),
    authorUsername: str(author.username),
    authorUsernameHtml:
      str(author.username_html) ??
      str((author.rendered as Raw | undefined)?.username),
    type,
  };
};

const fetchClaimsByType = async (
  token: string,
  userId: number,
  type: "market" | "nomarket",
): Promise<UserClaim[]> => {
  const res = await apiFetch(`/users/${userId}/claims?type=${type}`, token);
  if (!res.ok) return [];
  const data = (await res.json()) as { claims?: Raw[] };
  return (data.claims ?? [])
    .map((c) => mapClaim(c, type))
    .filter((c): c is UserClaim => c !== null);
};

export const fetchUserClaims = async (
  userId: number,
): Promise<UserClaimsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const [market, nomarket] = await Promise.all([
      fetchClaimsByType(token, userId, "market"),
      fetchClaimsByType(token, userId, "nomarket"),
    ]);
    const claims = [...market, ...nomarket].filter(
      (c) => c.claimState === "active",
    );
    return { ok: true, claims };
  } catch (err) {
    log.warn("[profile] fetchUserClaims failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchThreadLikes = async (
  threadId: number,
): Promise<{ ok: boolean; likeCount: number | null }> => {
  const token = getProfileToken();
  if (!token) return { ok: false, likeCount: null };
  try {
    const res = await apiFetch(`/threads/${threadId}?fields_include=*`, token);
    if (!res.ok) return { ok: false, likeCount: null };
    const data = (await res.json()) as { thread?: Raw };
    const thread = data.thread;
    if (!thread) return { ok: false, likeCount: null };
    const firstPost = thread.first_post as Raw | undefined;
    const likeCount =
      num(firstPost?.post_like_count) ?? num(thread.first_post_likes);
    return { ok: true, likeCount };
  } catch (err) {
    log.warn("[profile] fetchThreadLikes failed", err);
    return { ok: false, likeCount: null };
  }
};

const runAction = async (
  path: string,
  method: HttpMethod,
  body?: Raw,
): Promise<ProfileActionResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch(path, token, { method, body });
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    return { ok: true };
  } catch (err) {
    log.warn(`[profile] action failed: ${method} ${path}`, err);
    return { ok: false, reason: "offline" };
  }
};

export const followUser = async (
  userId: number,
  options?: FollowOptions,
): Promise<ProfileActionResult> => {
  const body: Raw = {};
  if (options) {
    body.alert_on_thread = options.alertOnThread ? 1 : 0;
    body.alert_on_profile_post = options.alertOnProfilePost ? 1 : 0;
  }
  return runAction(`/users/${userId}/followers`, "POST", body);
};

export const unfollowUser = (userId: number): Promise<ProfileActionResult> =>
  runAction(`/users/${userId}/followers`, "DELETE");

export const ignoreUser = (userId: number): Promise<ProfileActionResult> =>
  runAction(`/users/${userId}/ignore`, "POST");

export const unignoreUser = (userId: number): Promise<ProfileActionResult> =>
  runAction(`/users/${userId}/ignore`, "DELETE");

export const sendMessage = async (
  userId: number,
  message: string,
): Promise<ProfileActionResult> => {
  const text = message.trim();
  if (!text) return { ok: false, reason: "bad_query" };
  return runAction("/conversations", "POST", {
    recipient_id: userId,
    message_body: text,
  });
};

const redactErrorDetails = (value: string): string =>
  value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [скрыто]")
    .replace(
      /(oauth_token|access_token|client_secret|authorization|token)(\s*[=:]\s*)[^\s&"']+/gi,
      "$1$2[скрыто]",
    )
    .replace(/[A-Za-z0-9_-]{48,}/g, "[скрыто]")
    .trim()
    .slice(0, 8_000);

const formatErrorReportDate = (timestamp: number): string => {
  const date = new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now());
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("day")}.${value("month")}.${value("year")} в ${value("hour")}:${value("minute")}`;
};

export const submitErrorReport = async (
  payload: ErrorReportPayload,
): Promise<ErrorReportResult> => {
  const view = payload.view.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);
  const details = redactErrorDetails(payload.error);
  if (!view || !details) return { ok: false, reason: "bad_query" };

  const signature = `${view}\n${details}`;
  const now = Date.now();
  if (
    pendingErrorReportSignature === signature ||
    (lastErrorReportSignature === signature && now - lastErrorReportAt < ERROR_REPORT_COOLDOWN_MS)
  ) {
    return { ok: true };
  }

  try {
    const settings = await getSettings();
    if (!settings.errorReports) return { ok: false, reason: "disabled" };

    const token = getProfileToken();
    if (!token) return { ok: false, reason: "no_token" };

    pendingErrorReportSignature = signature;
    const [sender, recipient] = await Promise.all([
      validateAndFetchMe(token),
      fetchById(token, ERROR_REPORT_RECIPIENT_ID),
    ]);
    if (!sender.ok) return sender;
    if (!recipient.ok) return recipient;

    const date = formatErrorReportDate(payload.occurredAt);
    const separator = String.fromCharCode(92);
    const title = `Отчет об ошибках пользователя: ${sender.profile.username} ${separator} ${date}`;
    const message = [
      "Отчет об ошибках",
      "",
      `Пользователь: ${sender.profile.username}`,
      `Время: ${date}`,
      `Вкладка в которой произошла ошибка: ${view}`,
      "",
      "Ошибка:",
      details,
    ].join("\n");
    const response = await apiFetch("/conversations", token, {
      method: "POST",
      body: {
        recipients: [recipient.profile.username],
        is_group: true,
        title,
        open_invite: false,
        allow_edit_messages: false,
        allow_sticky_messages: true,
        allow_delete_own_messages: false,
        message_body: message,
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: statusToReason(response.status),
        message: `http_${response.status}`,
      };
    }

    lastErrorReportSignature = signature;
    lastErrorReportAt = Date.now();
    return { ok: true };
  } catch (error) {
    log.warn("[error-report] submit failed", error);
    return { ok: false, reason: "offline" };
  } finally {
    if (pendingErrorReportSignature === signature) pendingErrorReportSignature = "";
  }
};

const posNum = (v: unknown): number | null => {
  const n = num(v);
  return n && n > 0 ? n : null;
};

const readField = (user: Raw, ids: string[]): string => {
  const raw = user.fields;
  if (Array.isArray(raw)) {
    for (const item of raw as Raw[]) {
      const id = str(item.id)?.toLowerCase();
      if (id && ids.includes(id)) {
        const v = fieldValueToString(item.value);
        if (v) return v;
      }
    }
  } else if (raw && typeof raw === "object") {
    const values = new Map(
      Object.entries(raw as Raw).map(([key, value]) => [key.toLowerCase(), value]),
    );
    for (const id of ids) {
      const v = fieldValueToString(values.get(id.toLowerCase()));
      if (v) return v;
    }
  }
  return "";
};

const buildDisplayGroups = (user: Raw): PersonalDisplayGroup[] => {
  const raw = user.user_groups;
  if (!Array.isArray(raw)) return [];
  const out: PersonalDisplayGroup[] = [];
  for (const g of raw as Raw[]) {
    const id = num(g.user_group_id);
    const title = str(g.user_group_title);
    if (id === null || !title) continue;
    if (!flag(g.display_group_selectable) && !flag(g.is_primary_group))
      continue;
    if (out.some((x) => x.id === id)) continue;
    out.push({ id, title });
  }
  return out;
};

const cleanUserTitle = (
  title: string | null,
  displayGroups: PersonalDisplayGroup[],
  user: Raw,
): string => {
  const t = (title ?? "").trim();
  if (!t) return "";
  const groupTitles = new Set<string>();
  for (const g of displayGroups) groupTitles.add(g.title.trim().toLowerCase());
  const raw = user.user_groups;
  if (Array.isArray(raw)) {
    for (const g of raw as Raw[]) {
      const gt = str((g as Raw).user_group_title);
      if (gt) groupTitles.add(gt.trim().toLowerCase());
    }
  }
  return groupTitles.has(t.toLowerCase()) ? "" : t;
};

const mapPersonal = (user: Raw): PersonalInfo => {
  const links = user.links as Raw | undefined;
  rememberForumUrl(str(user.view_url));
  const gender = str(user.user_gender)?.toLowerCase();
  const displayGroups = buildDisplayGroups(user);
  return {
    userId: num(user.user_id) ?? 0,
    username: stripHtml(str(user.username) ?? ""),
    userTitle: cleanUserTitle(str(user.user_title), displayGroups, user),
    shortLink: str(user.short_link) ?? "",
    profileUrl: str(user.view_url) ?? str(links?.permalink) ?? "",
    gender: gender === "male" ? "male" : gender === "female" ? "female" : "",
    dobDay: posNum(user.user_dob_day),
    dobMonth: posNum(user.user_dob_month),
    dobYear: posNum(user.user_dob_year),
    showDobDate: flag(user.show_dob_date),
    showDobYear: flag(user.show_dob_year),
    displayGroupId: num(user.user_group_id),
    displayGroups,
    location: readField(user, ["location"]),
    occupation: readField(user, ["occupation"]),
    homepage: readField(user, ["homepage", "website"]),
    interests: readField(user, ["_4", "interests"]),
    favoriteAnime: readField(user, ["favoriteanime"]),
    favoritePorn: readField(user, ["favoriteporn"]),
    favoriteAshkudishka: readField(user, ["favoritevape"]),
  };
};

const ME_CACHE_KEY = "users:me";
const ME_TTL_MS = 60_000;

const fetchMeRaw = async (
  force = false,
): Promise<
  { ok: true; user: Raw } | { ok: false; reason: ProfileFetchReason }
> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  if (!force) {
    const cached = await getCache<Raw>(ME_CACHE_KEY);
    if (cached) return { ok: true, user: cached };
  }
  try {
    const res = await apiFetch("/users/me?fields_include=*", token);
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "offline" };
    const data = (await res.json()) as { user?: Raw };
    if (!data.user || num(data.user.user_id) === null)
      return { ok: false, reason: "not_found" };
    await setCache(ME_CACHE_KEY, data.user, ME_TTL_MS);
    return { ok: true, user: data.user };
  } catch (err) {
    log.warn("[profile] fetchMeRaw failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchMePersonal = async (): Promise<PersonalInfoResult> => {
  const me = await fetchMeRaw();
  if (!me.ok) return { ok: false, reason: me.reason };
  return { ok: true, info: mapPersonal(me.user) };
};

const freshUserAfterPut = async (res: Response): Promise<Raw | null> => {
  await invalidateCache(ME_CACHE_KEY);
  let user: Raw | null = null;
  try {
    const data = (await res.json()) as { user?: Raw };
    if (data.user && num(data.user.user_id) !== null) user = data.user;
  } catch {}
  if (!user) {
    const me = await fetchMeRaw(true);
    if (me.ok) user = me.user;
  }
  if (user) await setCache(ME_CACHE_KEY, user, ME_TTL_MS);
  return user;
};

export const updateMePersonal = async (
  update: PersonalInfoUpdate,
): Promise<PersonalInfoResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const body: Raw = {};
  if (update.username !== undefined) body.username = update.username;
  if (update.userTitle !== undefined) body.user_title = update.userTitle;
  if (update.shortLink !== undefined) body.short_link = update.shortLink;
  if (update.displayGroupId !== undefined && update.displayGroupId !== null)
    body.display_group_id = update.displayGroupId;
  if (update.gender !== undefined) body.gender = update.gender;
  if (
    update.dobDay !== undefined ||
    update.dobMonth !== undefined ||
    update.dobYear !== undefined
  ) {
    body.user_dob_day = update.dobDay ?? 0;
    body.user_dob_month = update.dobMonth ?? 0;
    body.user_dob_year = update.dobYear ?? 0;
  }
  if (update.showDobDate !== undefined)
    body.show_dob_date = update.showDobDate ? 1 : 0;
  if (update.showDobYear !== undefined)
    body.show_dob_year = update.showDobYear ? 1 : 0;
  const fields: Raw = {};
  if (update.location !== undefined) fields.location = update.location;
  if (update.occupation !== undefined) fields.occupation = update.occupation;
  if (update.homepage !== undefined) fields.homepage = update.homepage;
  if (update.interests !== undefined) fields._4 = update.interests;
  if (update.favoriteAnime !== undefined) fields.favoriteAnime = update.favoriteAnime;
  if (update.favoritePorn !== undefined) fields.favoritePorn = update.favoritePorn;
  if (update.favoriteAshkudishka !== undefined)
    fields.favoriteVape = update.favoriteAshkudishka;
  if (Object.keys(fields).length > 0) body.fields = fields;
  try {
    const res = await apiFetch("/users/me", token, { method: "PUT", body });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      log.warn(
        "[profile] updateMePersonal PUT failed",
        res.status,
        bodyText.slice(0, 800),
      );
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    }
    const fresh = await freshUserAfterPut(res);
    log.info("[profile] updateMePersonal saved", { refreshed: Boolean(fresh) });
    return { ok: true, info: fresh ? mapPersonal(fresh) : null };
  } catch (err) {
    log.warn("[profile] updateMePersonal failed", err);
    return { ok: false, reason: "offline" };
  }
};

const mapContact = (user: Raw): ContactInfo => ({
  telegram: readField(user, ["telegram"]),
  vk: readField(user, ["vk"]),
  discord: readField(user, ["discord"]),
  steam: readField(user, ["steam"]),
  github: readField(user, ["github"]),
  jabber: readField(user, ["jabber"]),
  matrix: readField(user, ["matrix"]),
});

export const fetchMeContact = async (): Promise<ContactInfoResult> => {
  const me = await fetchMeRaw();
  if (!me.ok) return { ok: false, reason: me.reason };
  return { ok: true, info: mapContact(me.user) };
};

export const updateMeContact = async (
  update: ContactInfoUpdate,
): Promise<ContactInfoResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const fields: Raw = {};
  for (const key of Object.keys(update) as Array<keyof ContactInfo>) {
    const value = update[key];
    if (value !== undefined) fields[key] = value;
  }
  const body: Raw = {};
  if (Object.keys(fields).length > 0) body.fields = fields;
  try {
    const res = await apiFetch("/users/me", token, { method: "PUT", body });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      log.warn(
        "[profile] updateMeContact PUT failed",
        res.status,
        bodyText.slice(0, 800),
      );
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    }
    const fresh = await freshUserAfterPut(res);
    log.info("[profile] updateMeContact saved", { refreshed: Boolean(fresh) });
    return { ok: true, info: fresh ? mapContact(fresh) : null };
  } catch (err) {
    log.warn("[profile] updateMeContact failed", err);
    return { ok: false, reason: "offline" };
  }
};

const readBool = (user: Raw, keys: string[], def: boolean): boolean => {
  for (const k of keys) if (k in user) return flag(user[k]);
  return def;
};

const mapPreferences = (user: Raw): ProfilePreferences => ({
  contentLanguageId: num(user.user_language_id) ?? num(user.language_id),
  convWelcomeMessage:
    str(user.user_conv_welcome_message) ?? str(user.conv_welcome_message) ?? "",
  receiveAdminEmail: readBool(
    user,
    ["user_receive_admin_email", "receive_admin_email"],
    true,
  ),
  activityVisible: readBool(
    user,
    ["user_activity_visible", "activity_visible"],
    true,
  ),
  hideUsernameChangeLogs: readBool(
    user,
    ["user_hide_username_change_logs", "hide_username_change_logs"],
    false,
  ),
});

export const fetchMePreferences = async (): Promise<PreferencesResult> => {
  const me = await fetchMeRaw();
  if (!me.ok) return { ok: false, reason: me.reason };
  return { ok: true, preferences: mapPreferences(me.user) };
};

export const updateMePreferences = async (
  update: ProfilePreferencesUpdate,
): Promise<PreferencesResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const body: Raw = {};
  if (
    update.contentLanguageId !== undefined &&
    update.contentLanguageId !== null
  )
    body.language_id = update.contentLanguageId;
  if (update.convWelcomeMessage !== undefined)
    body.conv_welcome_message = update.convWelcomeMessage;
  if (update.receiveAdminEmail !== undefined)
    body.receive_admin_email = update.receiveAdminEmail ? 1 : 0;
  if (update.activityVisible !== undefined)
    body.activity_visible = update.activityVisible ? 1 : 0;
  if (update.hideUsernameChangeLogs !== undefined)
    body.hide_username_change_logs = update.hideUsernameChangeLogs ? 1 : 0;
  try {
    const res = await apiFetch("/users/me", token, { method: "PUT", body });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      log.warn(
        "[profile] updateMePreferences PUT failed",
        res.status,
        bodyText.slice(0, 800),
      );
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    }
    const fresh = await freshUserAfterPut(res);
    log.info("[profile] updateMePreferences saved", {
      refreshed: Boolean(fresh),
    });
    return { ok: true, preferences: fresh ? mapPreferences(fresh) : null };
  } catch (err) {
    log.warn("[profile] updateMePreferences failed", err);
    return { ok: false, reason: "offline" };
  }
};

const PRIVACY_AUDIENCES: PrivacyAudience[] = [
  "everyone",
  "members",
  "followed",
  "none",
];

const readAudience = (
  user: Raw,
  keys: string[],
  def: PrivacyAudience,
): PrivacyAudience => {
  const pick = (src: Raw): PrivacyAudience | null => {
    for (const k of keys) {
      const v = str(src[k])?.toLowerCase();
      if (v && (PRIVACY_AUDIENCES as string[]).includes(v))
        return v as PrivacyAudience;
    }
    return null;
  };
  const direct = pick(user);
  if (direct) return direct;
  const priv = (user.user_privacy ?? user.privacy) as Raw | undefined;
  if (priv && typeof priv === "object") {
    const nested = pick(priv);
    if (nested) return nested;
  }
  return def;
};

const mapPrivacy = (user: Raw): PrivacySettings => ({
  allowViewProfile: readAudience(
    user,
    ["allow_view_profile", "user_allow_view_profile"],
    "everyone",
  ),
  allowPostProfile: readAudience(
    user,
    ["allow_post_profile", "user_allow_post_profile"],
    "members",
  ),
  allowSendPersonalConversation: readAudience(
    user,
    [
      "allow_send_personal_conversation",
      "user_allow_send_personal_conversation",
    ],
    "members",
  ),
  allowReceiveNewsFeed: readAudience(
    user,
    ["allow_receive_news_feed", "user_allow_receive_news_feed"],
    "members",
  ),
  showDobDate: flag(user.show_dob_date),
  showDobYear: flag(user.show_dob_year),
});

export const fetchMePrivacy = async (): Promise<PrivacyResult> => {
  const me = await fetchMeRaw();
  if (!me.ok) return { ok: false, reason: me.reason };
  return { ok: true, privacy: mapPrivacy(me.user) };
};

export const updateMePrivacy = async (
  update: PrivacySettingsUpdate,
): Promise<PrivacyResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const body: Raw = {};
  if (update.allowViewProfile !== undefined)
    body.allow_view_profile = update.allowViewProfile;
  if (update.allowPostProfile !== undefined)
    body.allow_post_profile = update.allowPostProfile;
  if (update.allowSendPersonalConversation !== undefined)
    body.allow_send_personal_conversation =
      update.allowSendPersonalConversation;
  if (update.allowReceiveNewsFeed !== undefined)
    body.allow_receive_news_feed = update.allowReceiveNewsFeed;
  if (update.showDobDate !== undefined)
    body.show_dob_date = update.showDobDate ? 1 : 0;
  if (update.showDobYear !== undefined)
    body.show_dob_year = update.showDobYear ? 1 : 0;
  try {
    const res = await apiFetch("/users/me", token, { method: "PUT", body });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      log.warn(
        "[profile] updateMePrivacy PUT failed",
        res.status,
        bodyText.slice(0, 800),
      );
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    }
    const fresh = await freshUserAfterPut(res);
    log.info("[profile] updateMePrivacy saved", { refreshed: Boolean(fresh) });
    return { ok: true, privacy: fresh ? mapPrivacy(fresh) : null };
  } catch (err) {
    log.warn("[profile] updateMePrivacy failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchIgnoredUsers = async (): Promise<IgnoredUsersResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch("/users/ignored", token);
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as Raw;
    const arr = Array.isArray(data.users) ? (data.users as Raw[]) : [];
    const users: IgnoredUser[] = arr.map((u) => ({
      userId: num(u.user_id) ?? 0,
      username: stripHtml(str(u.username) ?? ""),
      userTitle: stripHtml(str(u.user_title) ?? ""),
      viewUrl: str(u.view_url) ?? "",
    }));
    return { ok: true, users };
  } catch (err) {
    log.warn("[profile] fetchIgnoredUsers failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const fetchNotifications = async (): Promise<NotificationsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch("/notifications", token);
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as Raw;
    const arr = Array.isArray(data.notifications)
      ? (data.notifications as Raw[])
      : [];
    const notifications: NotificationItem[] = arr.map((n) => {
      const html = str(n.notification_html) ?? "";
      const hrefMatch = /href="([^"]+)"/.exec(html);
      let link: string | null = hrefMatch?.[1]
        ? decodeEntities(hrefMatch[1])
        : null;
      if (link && link.startsWith("/")) link = `${getForumWebUrl()}${link}`;
      return {
        id: num(n.notification_id) ?? 0,
        createdAt: num(n.notification_create_date) ?? 0,
        text: stripHtml(html),
        isUnread: flag(n.notification_is_unread),
        creatorUserId: num(n.creator_user_id) ?? 0,
        creatorUsername: stripHtml(str(n.creator_username) ?? ""),
        link,
      };
    });
    const unreadTotal = notifications.filter((n) => n.isUnread).length;
    return { ok: true, notifications, unreadTotal };
  } catch (err) {
    log.warn("[profile] fetchNotifications failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const markNotificationsRead = (): Promise<ProfileActionResult> =>
  runAction("/notifications/read", "POST");

export const fetchSecretAnswerTypes =
  async (): Promise<SecretAnswerInfoResult> => {
    const token = getProfileToken();
    if (!token) return { ok: false, reason: "no_token" };
    try {
      const res = await apiFetch("/users/secret-answer/types", token);
      if (!res.ok)
        return {
          ok: false,
          reason: statusToReason(res.status),
          message: `http_${res.status}`,
        };
      const data = (await res.json()) as Raw;
      const arr = Array.isArray(data.data) ? (data.data as Raw[]) : [];
      const types: SecretAnswerType[] = arr.map((tp) => ({
        id: num(tp.sa_id) ?? 0,
        title: stripHtml(str(tp.renderedPhrase) ?? ""),
      }));
      return { ok: true, info: { types } };
    } catch (err) {
      log.warn("[profile] fetchSecretAnswerTypes failed", err);
      return { ok: false, reason: "offline" };
    }
  };

export const updateSecretAnswer = async (
  update: SecretAnswerUpdate,
): Promise<ProfileActionResult> => {
  const body: Raw = {
    secret_answer: update.answer,
    secret_answer_type: update.typeId,
  };
  const result = await runAction("/users/me", "PUT", body);
  if (result.ok) await invalidateCache(ME_CACHE_KEY);
  return result;
};

export const requestSecretReset = async (): Promise<SecretResetResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const res = await apiFetch("/account/secret-answer/reset", token, {
      method: "POST",
    });
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as Raw;
    return { ok: true, waitingTime: num(data.waiting_time) ?? undefined };
  } catch (err) {
    log.warn("[profile] requestSecretReset failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const cancelSecretReset = (): Promise<ProfileActionResult> =>
  runAction("/account/secret-answer/reset", "DELETE");

const pickConversationAvatar = (conv: Raw): string | null => {
  const last = conv.last_message as Raw | undefined;
  const first = conv.first_message as Raw | undefined;
  return (
    str(last?.creator_avatar) ??
    str(first?.creator_avatar) ??
    pickAvatar(conv) ??
    null
  );
};

const mapRecipient = (raw: unknown): ConversationParticipant | null => {
  if (!raw || typeof raw !== "object") return null;
  const user = raw as Raw;
  const nested =
    user.user && typeof user.user === "object" ? (user.user as Raw) : user;
  const userId = num(user.user_id) ?? num(nested.user_id);
  const username = str(user.username) ?? str(nested.username);
  if (userId === null || !username) return null;
  return {
    userId,
    username: stripHtml(username),
    usernameHtml:
      str(nested.username_html) ??
      str(user.username_html) ??
      str((nested.rendered as Raw | undefined)?.username),
    usernameColor: pickColor(nested),
    avatarUrl: pickAvatar(nested),
  };
};

const mapConversationRecipients = (conv: Raw): ConversationParticipant[] => {
  const out: ConversationParticipant[] = [];
  const seen = new Set<number>();
  const push = (participant: ConversationParticipant | null): void => {
    if (!participant || seen.has(participant.userId)) return;
    seen.add(participant.userId);
    out.push(participant);
  };
  push(mapRecipient(conv.recipient));
  const raw = conv.recipients ?? conv.conversation_recipients;
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  for (const entry of entries) push(mapRecipient(entry));
  return out;
};

const pickConversationPreview = (conv: Raw): string | null => {
  const last = conv.last_message as Raw | undefined;
  const first = conv.first_message as Raw | undefined;
  const raw =
    str(last?.message_body_plain_text) ??
    str(last?.message_body) ??
    str(first?.message_body_plain_text) ??
    str(first?.message_body) ??
    null;
  return raw ? stripHtml(raw) : null;
};

export const fetchConversations = async (
  page = 1,
  limit = 20,
): Promise<ConversationsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const safePage = page > 0 ? page : 1;
    const res = await apiFetch(
      `/conversations?limit=${limit}&page=${safePage}`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as {
      conversations?: Raw[];
      links?: Raw;
    };
    const host = getForumWebUrl();
    const conversations: ConversationItem[] = (data.conversations ?? []).map(
      (conv): ConversationItem => {
        const id = num(conv.conversation_id) ?? 0;
        const updateDate = num(conv.conversation_update_date) ?? 0;
        const lastRead = num(conv.conversation_last_read_date) ?? 0;
        const isUnread =
          "conversation_is_unread" in conv
            ? flag(conv.conversation_is_unread)
            : updateDate > lastRead;
        const creatorName = stripHtml(str(conv.creator_username) ?? "");
        const title =
          stripHtml(str(conv.conversation_title) ?? "") || creatorName;
        const savedFlag =
          "conversation_is_saved" in conv
            ? flag(conv.conversation_is_saved)
            : "is_saved_messages" in conv
              ? flag(conv.is_saved_messages)
              : false;
        const isSaved =
          savedFlag || /^(избранное|saved messages|saved)$/i.test(title.trim());
        const isGroup = flag(conv.is_group);
        const primary = isGroup ? null : mapRecipient(conv.recipient);
        return {
          id,
          title: title || "—",
          interlocutorUsername: primary?.username ?? (creatorName || title),
          interlocutorUsernameColor:
            primary?.usernameColor ?? extractColor(conv.creator_username_html),
          interlocutorUsernameHtml:
            primary?.usernameHtml ?? str(conv.creator_username_html) ?? null,
          interlocutorUserId:
            primary?.userId ?? num(conv.creator_user_id) ?? null,
          recipients: mapConversationRecipients(conv),
          interlocutorAvatarUrl:
            primary?.avatarUrl ?? pickConversationAvatar(conv),
          lastMessagePreview: pickConversationPreview(conv),
          updateDate,
          messageCount: num(conv.conversation_message_count) ?? 0,
          isUnread,
          isSaved,
          url: `${host}/conversations/${id}/`,
        };
      },
    );
    const unreadTotal = conversations.filter((c) => c.isUnread).length;
    const links = data.links;
    const hasMore =
      Boolean(links && typeof links.next === "string") ||
      conversations.length >= limit;
    return { ok: true, conversations, unreadTotal, hasMore };
  } catch (err) {
    log.warn("[profile] fetchConversations failed", err);
    return { ok: false, reason: "offline" };
  }
};

const mapConversationMessage = (m: Raw): ConversationMessage => ({
  id: num(m.message_id) ?? 0,
  body: str(m.message_body) ?? stripHtml(str(m.message_body_plain_text) ?? ""),
  bodyHtml: str(m.message_body_html) ?? null,
  createDate: num(m.message_create_date) ?? 0,
  creatorUserId: num(m.creator_user_id) ?? 0,
  creatorUsername: stripHtml(str(m.creator_username) ?? ""),
  creatorUsernameColor: extractColor(m.creator_username_html),
  creatorUsernameHtml: str(m.creator_username_html) ?? null,
  creatorAvatarUrl:
    str(m.creator_avatar) ??
    str((m.links as Raw | undefined)?.creator_avatar) ??
    null,
});

export const fetchConversationMessages = async (
  conversationId: number,
  page = 1,
): Promise<ConversationMessagesResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  if (!conversationId) return { ok: false, reason: "bad_query" };
  try {
    const safePage = page > 0 ? page : 1;
    const res = await apiFetch(
      `/conversations/${conversationId}/messages?page=${safePage}`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { messages?: Raw[]; links?: Raw };
    const messages = (data.messages ?? []).map(mapConversationMessage);
    const links = data.links as Raw | undefined;
    const hasMore = Boolean(links && typeof links.next === "string");
    return { ok: true, messages, hasMore };
  } catch (err) {
    log.warn("[profile] fetchConversationMessages failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const sendConversationMessage = async (
  conversationId: number,
  message: string,
): Promise<ProfileActionResult> => {
  const text = message.trim();
  if (!conversationId) return { ok: false, reason: "bad_query" };
  if (!text) return { ok: false, reason: "bad_query" };
  return runAction(`/conversations/${conversationId}/messages`, "POST", {
    message_body: text,
  });
};

export const searchForumUsers = async (
  query: string,
): Promise<ForumSearchUsersResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const q = query.trim();
  if (!q) return { ok: true, users: [] };
  try {
    const res = await apiFetch(
      `/users/find?username=${encodeURIComponent(q)}`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { users?: Raw[] };
    const users: ForumSearchUser[] = (data.users ?? [])
      .map(mapFollower)
      .filter((u): u is ProfileFollower => u !== null)
      .map((u) => ({
        userId: u.userId,
        username: u.username,
        usernameColor: u.usernameColor,
        usernameHtml: u.usernameHtml,
        avatarUrl: u.avatarUrl,
        userTitle: u.userTitle,
      }));
    return { ok: true, users };
  } catch (err) {
    log.warn("[profile] searchForumUsers failed", err);
    return { ok: false, reason: "offline" };
  }
};

const mapProfilePost = (raw: Raw): ProfilePost | null => {
  const id = num(raw.profile_post_id);
  if (id === null) return null;
  const links = (raw.links as Raw | undefined) ?? {};
  const perms = (raw.permissions as Raw | undefined) ?? {};
  return {
    id,
    timelineUserId: num(raw.timeline_user_id) ?? 0,
    posterUserId: num(raw.poster_user_id) ?? 0,
    posterUsername: stripHtml(str(raw.poster_username) ?? ""),
    posterUsernameHtml: str(raw.poster_username_html),
    posterUsernameColor: extractColor(raw.poster_username_html),
    posterAvatarUrl: str(links.poster_avatar),
    createDate: num(raw.post_create_date) ?? 0,
    body: str(raw.post_body) ?? stripHtml(str(raw.post_body_plain_text) ?? ""),
    bodyHtml: str(raw.post_body_html),
    likeCount: num(raw.post_like_count) ?? 0,
    commentCount: num(raw.post_comment_count) ?? 0,
    commentsDisabled: flag(raw.post_comments_is_disabled),
    isLiked: flag(raw.post_is_liked),
    isSticked: flag(raw.post_is_sticked),
    url: str(links.permalink),
    permissions: {
      edit: flag(perms.edit),
      delete: flag(perms.delete),
      like: flag(perms.like),
      comment: flag(perms.comment),
      report: flag(perms.report),
      stick: flag(perms.stick),
    },
  };
};

const mapProfilePostComment = (raw: Raw): ProfilePostComment | null => {
  const id = num(raw.comment_id);
  if (id === null) return null;
  const links = (raw.links as Raw | undefined) ?? {};
  const perms = (raw.permissions as Raw | undefined) ?? {};
  return {
    id,
    profilePostId: num(raw.profile_post_id) ?? 0,
    userId: num(raw.comment_user_id) ?? 0,
    username: stripHtml(str(raw.comment_username) ?? ""),
    usernameHtml: str(raw.comment_username_html),
    usernameColor: extractColor(raw.comment_username_html),
    avatarUrl: str(links.commenter_avatar) ?? str(links.avatar) ?? null,
    createDate: num(raw.comment_create_date) ?? 0,
    body:
      str(raw.comment_body) ??
      stripHtml(str(raw.comment_body_plain_text) ?? ""),
    bodyHtml: str(raw.comment_body_html),
    canEdit: flag(perms.edit),
    canDelete: flag(perms.delete),
  };
};

const mapTrophy = (raw: Raw): ProfileTrophy | null => {
  const id = num(raw.trophy_id);
  const title = str(raw.title);
  if (id === null || !title) return null;
  return {
    id,
    title,
    description: str(raw.description),
    iconUrl: str(raw.trophy_url),
    awardDate: num(raw.award_date),
    rarity: str(raw.rarity),
    rarityPhrase: str(raw.rarityPhrase),
  };
};

export const fetchProfilePosts = async (
  userId: number,
  page = 1,
  limit = 20,
): Promise<ProfilePostsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  if (!userId) return { ok: false, reason: "bad_query" };
  try {
    const safePage = page > 0 ? page : 1;
    const res = await apiFetch(
      `/users/${userId}/profile-posts?page=${safePage}&limit=${limit}`,
      token,
    );
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as {
      profile_posts?: Raw[];
      totalProfilePosts?: unknown;
      canPostOnProfile?: unknown;
      links?: Raw;
    };
    const posts = (data.profile_posts ?? [])
      .map(mapProfilePost)
      .filter((p): p is ProfilePost => p !== null);
    const linksRaw = (data.links as Raw | undefined) ?? {};
    const pages = num(linksRaw.pages) ?? 1;
    const cur = num(linksRaw.page) ?? safePage;
    const hasMore = typeof linksRaw.next === "string" || cur < pages;
    return {
      ok: true,
      posts,
      total: num(data.totalProfilePosts) ?? posts.length,
      canPost: flag(data.canPostOnProfile),
      hasMore,
      page: cur,
    };
  } catch (err) {
    log.warn("[profile] fetchProfilePosts failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const createProfilePost = async (
  userId: number,
  body: string,
): Promise<ProfilePostMutationResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const text = body.trim();
  if (!userId || !text) return { ok: false, reason: "bad_query" };
  try {
    const res = await apiFetch("/profile-posts", token, {
      method: "POST",
      body: { user_id: userId, post_body: text },
    });
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { profile_post?: Raw };
    const post = data.profile_post ? mapProfilePost(data.profile_post) : null;
    return { ok: true, post: post ?? undefined };
  } catch (err) {
    log.warn("[profile] createProfilePost failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const editProfilePost = (
  profilePostId: number,
  update: { body?: string; disableComments?: boolean },
): Promise<ProfileActionResult> => {
  const body: Raw = {};
  if (update.body !== undefined) body.post_body = update.body;
  if (update.disableComments !== undefined)
    body.disable_comments = update.disableComments ? 1 : 0;
  return runAction(`/profile-posts/${profilePostId}`, "PUT", body);
};

export const deleteProfilePost = (
  profilePostId: number,
): Promise<ProfileActionResult> =>
  runAction(`/profile-posts/${profilePostId}`, "DELETE");

export const likeProfilePost = (
  profilePostId: number,
): Promise<ProfileActionResult> =>
  runAction(`/profile-posts/${profilePostId}/likes`, "POST");
export const unlikeProfilePost = (
  profilePostId: number,
): Promise<ProfileActionResult> =>
  runAction(`/profile-posts/${profilePostId}/likes`, "DELETE");

export const stickProfilePost = (
  profilePostId: number,
): Promise<ProfileActionResult> =>
  runAction(`/profile-posts/${profilePostId}/stick`, "POST");
export const unstickProfilePost = (
  profilePostId: number,
): Promise<ProfileActionResult> =>
  runAction(`/profile-posts/${profilePostId}/stick`, "DELETE");

export const fetchProfilePostComments = async (
  profilePostId: number,
  before?: number,
  limit = 20,
): Promise<ProfilePostCommentsResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  if (!profilePostId) return { ok: false, reason: "bad_query" };
  try {
    let path = `/profile-posts/comments?profile_post_id=${profilePostId}&limit=${limit}`;
    if (before && before > 0) path += `&before=${before}`;
    const res = await apiFetch(path, token);
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as {
      comments?: Raw[];
      comments_total?: unknown;
    };
    const comments = (data.comments ?? [])
      .map(mapProfilePostComment)
      .filter((c): c is ProfilePostComment => c !== null);
    const total = num(data.comments_total) ?? comments.length;
    const hasMore = comments.length >= limit && comments.length < total;
    return { ok: true, comments, total, hasMore };
  } catch (err) {
    log.warn("[profile] fetchProfilePostComments failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const createProfilePostComment = async (
  profilePostId: number,
  body: string,
): Promise<ProfilePostCommentMutationResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  const text = body.trim();
  if (!profilePostId || !text) return { ok: false, reason: "bad_query" };
  try {
    const res = await apiFetch("/profile-posts/comments", token, {
      method: "POST",
      body: { profile_post_id: profilePostId, comment_body: text },
    });
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { comment?: Raw };
    const comment = data.comment ? mapProfilePostComment(data.comment) : null;
    return { ok: true, comment: comment ?? undefined };
  } catch (err) {
    log.warn("[profile] createProfilePostComment failed", err);
    return { ok: false, reason: "offline" };
  }
};

export const editProfilePostComment = (
  commentId: number,
  body: string,
): Promise<ProfileActionResult> =>
  runAction("/profile-posts/comments", "PUT", {
    comment_id: commentId,
    comment_body: body,
  });

export const deleteProfilePostComment = (
  commentId: number,
): Promise<ProfileActionResult> =>
  runAction("/profile-posts/comments", "DELETE", { comment_id: commentId });

export const fetchTrophies = async (
  userId: number,
): Promise<ProfileTrophiesResult> => {
  const token = getProfileToken();
  if (!token) return { ok: false, reason: "no_token" };
  if (!userId) return { ok: false, reason: "bad_query" };
  try {
    const res = await apiFetch(`/users/${userId}/trophies`, token);
    if (!res.ok)
      return {
        ok: false,
        reason: statusToReason(res.status),
        message: `http_${res.status}`,
      };
    const data = (await res.json()) as { trophies?: Raw[] };
    const trophies = (data.trophies ?? [])
      .map(mapTrophy)
      .filter((t): t is ProfileTrophy => t !== null);
    return { ok: true, trophies };
  } catch (err) {
    log.warn("[profile] fetchTrophies failed", err);
    return { ok: false, reason: "offline" };
  }
};
