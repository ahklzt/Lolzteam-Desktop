
import log from "electron-log";
import { LZT_CONFIG } from "@lzt/shared";
import type {
  ForumActionResult,
  ForumModerator,
  ForumSectionResult,
  ForumCreatePostResult,
  ForumCreateContestInput,
  ForumCreateContestResult,
  ForumCreateThreadInput,
  ForumCreateThreadResult,
  ForumPrefixesResult,
  ForumPrefixGroup,
  ForumPrefixOption,
  ForumNode,
  ForumPostItem,
  ForumPostsResult,
  ForumThreadDetailsResult,
  ForumThreadEditable,
  ForumEditThreadInput,
  ForumModeratorLogEntry,
  ForumModeratorLogResult,
  ForumPostBodyResult,
  ForumThreadItem,
  ForumThreadsQuery,
  ForumThreadsResult,
  ThreadPrefix,
  ForumPrefixCssResult,
  ForumTreeResult,
  ForumUser,
  ForumFeedOptions,
  ForumFeedOptionsResult,
  ForumPostComment,
  ForumPostCommentsResult,
  ProfileFetchReason,
} from "@lzt/shared";
import { getProfileToken } from "./profile-token";
import { appFetch } from "./app-fetch";
import { getSettings } from "../settings/settings-store";

const DEFAULT_TIMEOUT_MS = 15_000;

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

export const THREADS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 20;

type Raw = Record<string, unknown>;

const apiFetch = async (
  method: string,
  path: string,
  token: string,
  body?: Raw,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const spoofAndroid = (await getSettings()).spoofAndroid;
  try {
    return await appFetch(`${LZT_CONFIG.forumApiUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Api-Username-Inline-Style": "1",
        ...(spoofAndroid ? { "User-Agent": ANDROID_UA } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
  typeof v === "string" && v.length > 0 ? v : null;
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
};
const flag = (v: unknown): boolean => v === true || v === 1 || v === "1";
const obj = (v: unknown): Raw | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Raw) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const readJson = async (res: Response): Promise<Raw | null> => {
  try {
    return obj(await res.json());
  } catch {
    return null;
  }
};

const apiError = (data: Raw | null): string | undefined => {
  const first = data ? arr(data["errors"])[0] : undefined;
  return typeof first === "string" ? first : undefined;
};

const fail = (reason: ProfileFetchReason, message?: string) =>
  ({ ok: false, reason, message }) as const;

const WEB_BASE = LZT_CONFIG.webUrl.replace(/\/+$/, "");
const absUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return WEB_BASE + s;
  return null;
};


const stripTags = (v: unknown): string =>
  (str(v) ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

const colorFromHtml = (html: string | null): string | null => {
  if (!html) return null;
  const m =
    /(?:background(?:-color)?|color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/.exec(
      html,
    );
  return m ? m[1]! : null;
};

const PREFIX_CLASS_STYLES: Record<string, { bg: string | null; fg: string }> = {
  prefixPrimary: { bg: "rgb(48,48,48)", fg: "rgb(0,186,120)" },
  prefixSecondary: { bg: "#f9d9b0", fg: "#8f6c3f" },
  prefixRed: { bg: null, fg: "#f36464" },
  prefixGreen: { bg: "#5b1763", fg: "rgb(214,214,214)" },
  prefixOlive: { bg: "olive", fg: "black" },
  prefixLightGreen: { bg: null, fg: "#00FF16" },
  prefixBlue: { bg: null, fg: "#f82eba" },
  prefixRoyalBlue: { bg: "royalblue", fg: "white" },
  prefixSkyBlue: { bg: "skyblue", fg: "black" },
  prefixGray: { bg: "gray", fg: "black" },
  prefixSilver: { bg: null, fg: "#FCFCFC" },
  prefixYellow: { bg: "rgb(80,80,80)", fg: "#b3b309" },
  prefixOrange: { bg: "orange", fg: "black" },
};

const PREFIX_CLASS_NAMES = Object.keys(PREFIX_CLASS_STYLES).sort(
  (a, b) => b.length - a.length,
);

const prefixClass = (s: string | null): string | null => {
  if (!s) return null;
  for (const name of PREFIX_CLASS_NAMES) if (s.includes(name)) return name;
  return null;
};

const mapUser = (raw: Raw): ForumUser => {
  const rendered = obj(raw["rendered"]) ?? {};
  const avatars = obj(raw["avatars"]) ?? obj(rendered["avatars"]) ?? {};
  const links = obj(raw["links"]) ?? {};
  return {
    userId: num(raw["user_id"]) ?? 0,
    username: stripTags(raw["username"]),
    usernameHtml:
      str(rendered["username"]) ??
      str(raw["username_html"]) ??
      str(raw["creator_username_html"]) ??
      str(raw["poster_username_html"]),
    avatarUrl:
      absUrl(links["poster_avatar"]) ??
      absUrl(links["first_poster_avatar"]) ??
      absUrl(avatars["m"]) ??
      absUrl(avatars["s"]) ??
      absUrl(avatars["l"]) ??
      absUrl(avatars["o"]) ??
      absUrl(links["avatar"]) ??
      absUrl(links["avatar_big"]) ??
      absUrl(raw["avatar_big"]) ??
      absUrl(raw["avatar"]),
  };
};

const mapThread = (raw: Raw): ForumThreadItem => {
  const creator =
    obj(raw["creator"]) ??
    ({
      user_id: raw["creator_user_id"],
      username: raw["creator_username"],
      username_html: raw["creator_username_html"],
      rendered: raw["rendered"],
      avatars: raw["creator_avatars"],
      avatar: raw["creator_avatar"],
      links: raw["links"],
    } as Raw);
  const postCount = num(raw["thread_post_count"]);
  const prefixes: ThreadPrefix[] = [];
  for (const p of arr(raw["thread_prefixes"])) {
    const po = obj(p);
    const title = po ? (str(po["prefix_title"]) ?? str(po["title"])) : str(p);
    if (!title) continue;
    const cls = po
      ? (prefixClass(str(po["css_class"]) ?? str(po["class"])) ??
        prefixClass(str(po["html"]) ?? str(po["prefix_html"])))
      : null;
    const named = cls ? PREFIX_CLASS_STYLES[cls] : undefined;
    const rawColor = po
      ? (str(po["color"]) ??
        str(po["bc"]) ??
        str(po["prefix_color"]) ??
        colorFromHtml(str(po["html"]) ?? str(po["prefix_html"])))
      : null;
    prefixes.push({
      title,
      color: named ? named.bg : rawColor,
      textColor: named ? named.fg : null,
      cssClass: po ? (str(po["css_class"]) ?? str(po["class"]) ?? null) : null,
    });
  }
  const firstPost = obj(raw["first_post"]) ?? {};
  const lastPostRaw = obj(raw["last_post"]);
  const lastPost = lastPostRaw
    ? {
        postId: num(lastPostRaw["post_id"]) ?? 0,
        user: mapUser({
          user_id: lastPostRaw["poster_user_id"],
          username: lastPostRaw["poster_username"],
          username_html: lastPostRaw["poster_username_html"],
          links: lastPostRaw["links"],
        } as Raw),
        createDate: num(lastPostRaw["post_create_date"]) ?? 0,
        bodyHtml: str(lastPostRaw["post_body_html"]) ?? "",
      }
    : null;
  return {
    threadId: num(raw["thread_id"]) ?? 0,
    forumId: num(raw["forum_id"]) ?? 0,
    title: str(raw["thread_title"]) ?? str(raw["title"]) ?? "",
    prefixes,
    creator: mapUser(creator),
    createDate: num(raw["thread_create_date"]) ?? 0,
    replyCount:
      num(raw["thread_reply_count"]) ?? Math.max(0, (postCount ?? 1) - 1),
    viewCount: num(raw["thread_view_count"]) ?? 0,
    isSticky: flag(raw["thread_is_sticky"]) || flag(raw["sticky"]),
    isClosed:
      raw["thread_is_open"] !== undefined
        ? !flag(raw["thread_is_open"])
        : false,
    lastPostDate: num(raw["thread_update_date"]) ?? num(raw["last_post_date"]),
    firstPostId: num(firstPost["post_id"]) ?? num(raw["first_post_id"]) ?? null,
    likeCount:
      num(firstPost["post_like_count"]) ?? num(raw["thread_like_count"]) ?? 0,
    isLiked: flag(firstPost["post_is_liked"]) || flag(raw["thread_is_liked"]),
    isBookmarked: flag(
      raw["thread_is_bookmarked"] ??
        raw["is_bookmarked"] ??
        raw["thread_user_is_bookmarked"] ??
        raw["starred"],
    ),
    contentHtml: str(firstPost["post_body_html"]) ?? "",
    lastPost,
    tags: parseThreadTags(raw["thread_tags"] ?? raw["tags"]),
  };
};

const parseThreadTags = (v: unknown): string[] => {
  const out: string[] = [];
  const pick = (item: unknown): void => {
    const o = obj(item);
    const s = o
      ? (str(o["tag"]) ?? str(o["title"]) ?? str(o["text"]))
      : str(item);
    if (s) out.push(s);
  };
  if (Array.isArray(v)) {
    for (const item of v) pick(item);
  } else {
    const o = obj(v);
    if (o) for (const item of Object.values(o)) pick(item);
  }
  return out;
};

const mapComment = (raw: Raw): ForumPostComment => {
  const user =
    obj(raw["commenter"]) ??
    obj(raw["user"]) ??
    ({
      user_id: raw["poster_user_id"] ?? raw["user_id"],
      username: raw["poster_username"] ?? raw["username"],
      username_html: raw["poster_username_html"] ?? raw["username_html"],
      rendered: raw["rendered"],
      links: raw["links"],
      avatar: raw["poster_avatar"] ?? raw["avatar"],
    } as Raw);
  return {
    commentId: num(raw["post_comment_id"]) ?? num(raw["comment_id"]) ?? 0,
    user: mapUser(user),
    createDate:
      num(raw["post_comment_create_date"]) ??
      num(raw["comment_create_date"]) ??
      0,
    bodyHtml:
      str(raw["post_comment_body_html"]) ??
      str(raw["comment_body_html"]) ??
      str(raw["post_comment_body"]) ??
      str(raw["comment_body"]) ??
      "",
  };
};

const mapPost = (raw: Raw): ForumPostItem => {
  const poster =
    obj(raw["poster"]) ??
    obj(raw["user"]) ??
    ({
      user_id: raw["poster_user_id"],
      username: raw["poster_username"],
      username_html: raw["poster_username_html"],
      rendered: raw["rendered"],
      avatars: raw["poster_avatars"],
      avatar: raw["poster_avatar"],
      links: raw["links"],
    } as Raw);
  const comments: ForumPostComment[] = [];
  for (const c of arr(raw["post_comments"] ?? raw["comments"])) {
    const co = obj(c);
    if (co) comments.push(mapComment(co));
  }
  return {
    postId: num(raw["post_id"]) ?? 0,
    threadId: num(raw["thread_id"]) ?? 0,
    user: mapUser(poster),
    createDate: num(raw["post_create_date"]) ?? 0,
    bodyHtml: str(raw["post_body_html"]) ?? str(raw["post_body"]) ?? "",
    likeCount: num(raw["post_like_count"]) ?? 0,
    isLiked:
      raw["post_is_liked"] === undefined ? null : flag(raw["post_is_liked"]),
    isFirstPost: flag(raw["post_is_first_post"]),
    canEdit: flag(obj(raw["permissions"])?.["edit"]),
    comments,
  };
};

const decodeIcon = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const decoded = s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) =>
      String.fromCodePoint(Number.parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_m, d: string) =>
      String.fromCodePoint(Number.parseInt(d, 10)),
    )
    .trim();
  return decoded.length > 0 ? decoded : null;
};

const mapNode = (raw: Raw): ForumNode | null => {
  const forumId =
    num(raw["forum_id"]) ?? num(raw["node_id"]) ?? num(raw["category_id"]);
  const title =
    str(raw["forum_title"]) ?? str(raw["title"]) ?? str(raw["category_title"]);
  if (forumId === null || title === null) return null;
  const children: ForumNode[] = [];
  for (const key of ["sub_forums", "forums", "children", "child_nodes"]) {
    for (const c of arr(raw[key])) {
      const co = obj(c);
      const node = co ? mapNode(co) : null;
      if (node) children.push(node);
    }
  }
  const type = str(raw["node_type_id"]) ?? str(raw["forum_type"]);
  const isCategory =
    raw["category_id"] !== undefined ||
    (type !== null && type.toLowerCase() === "category") ||
    flag(raw["is_category"]);
  return {
    forumId,
    title,
    description: str(raw["forum_description"]) ?? str(raw["description"]),
    isCategory,
    threadCount: num(raw["thread_count"]),
    iconContent: decodeIcon(raw["icon_content"]),
    children,
  };
};

const buildTreeFromFlat = (cats: unknown[], forums: unknown[]): ForumNode[] => {
  const byId = new Map<number, ForumNode>();
  const parentById = new Map<number, number | null>();
  const order: number[] = [];

  for (const c of cats) {
    const co = obj(c);
    if (!co) continue;
    const id = num(co["category_id"]) ?? num(co["node_id"]);
    const title = str(co["category_title"]) ?? str(co["title"]);
    if (id === null || title === null || byId.has(id)) continue;
    byId.set(id, {
      forumId: id,
      title,
      description: str(co["category_description"]) ?? str(co["description"]),
      isCategory: true,
      threadCount: null,
      iconContent: decodeIcon(co["icon_content"]),
      children: [],
    });
    parentById.set(id, num(co["parent_node_id"]));
    order.push(id);
  }

  for (const f of forums) {
    const fo = obj(f);
    if (!fo) continue;
    const id = num(fo["forum_id"]) ?? num(fo["node_id"]);
    const title = str(fo["forum_title"]) ?? str(fo["title"]);
    if (id === null || title === null || byId.has(id)) continue;
    const type = (str(fo["node_type_id"]) ?? "").toLowerCase();
    byId.set(id, {
      forumId: id,
      title,
      description: str(fo["forum_description"]) ?? str(fo["description"]),
      isCategory: type === "category",
      threadCount: num(fo["forum_thread_count"]) ?? num(fo["thread_count"]),
      iconContent: decodeIcon(fo["icon_content"]),
      children: [],
    });
    parentById.set(id, num(fo["parent_node_id"]));
    order.push(id);
  }

  const roots: ForumNode[] = [];
  for (const id of order) {
    const node = byId.get(id)!;
    const parentId = parentById.get(id) ?? null;
    const parent = parentId !== null ? byId.get(parentId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.filter((node) => !node.isCategory || node.children.length > 0);
};


const fetchGroupedTree = async (token: string): Promise<ForumNode[]> => {
  const res = await apiFetch("GET", "/forums/grouped", token);
  const data = await readJson(res);
  if (!res.ok) return [];
  const flat: unknown[] = [];
  for (const group of arr(data?.["data"])) {
    for (const f of arr(group)) flat.push(f);
  }
  if (flat.length === 0) {
    for (const key of ["forums", "categories", "forums_grouped"]) {
      for (const f of arr(data?.[key])) flat.push(f);
    }
  }
  return buildTreeFromFlat([], flat);
};

export const fetchForumsTree = async (): Promise<ForumTreeResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const [catRes, forumRes] = await Promise.all([
      apiFetch("GET", "/categories/", token)
        .then(readJson)
        .catch(() => null),
      apiFetch("GET", "/forums/", token)
        .then(readJson)
        .catch(() => null),
    ]);
    const cats = arr(catRes?.["categories"]);
    const forums = arr(forumRes?.["forums"]).length
      ? arr(forumRes?.["forums"])
      : arr(forumRes?.["data"]);
    if (forums.length > 0) {
      return { ok: true, forums: buildTreeFromFlat(cats, forums) };
    }
    const grouped = await fetchGroupedTree(token);
    if (grouped.length > 0) return { ok: true, forums: grouped };
    return { ok: true, forums: [] };
  } catch (err) {
    log.warn("[forum] fetch forums tree failed", err);
    return fail("offline");
  }
};

export const fetchForumThreads = async (
  query: ForumThreadsQuery,
): Promise<ForumThreadsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");

  if (query.forumIds && query.forumIds.length > 0) {
    const forumIds = [...new Set(query.forumIds.filter((id) => id > 0))];
    if (forumIds.length === 0) return { ok: true, threads: [], total: 0 };

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, query.limit ?? THREADS_PER_PAGE);
    const targetCount = page * limit;
    const results = await Promise.all(
      forumIds.map((forumId) =>
        fetchForumThreads({
          ...query,
          forumId,
          forumIds: undefined,
          page: 1,
          limit: targetCount,
        }),
      ),
    );
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) return failed;

    const byId = new Map<number, ForumThreadItem>();
    let total = 0;
    let totalKnown = true;
    for (const result of results) {
      if (!result.ok) continue;
      for (const thread of result.threads) byId.set(thread.threadId, thread);
      if (result.total === null) totalKnown = false;
      else total += result.total;
    }

    const order = query.order ?? "last_post_date";
    const direction =
      query.direction === "asc" || order === "reply_count_asc" ? 1 : -1;
    const value = (thread: ForumThreadItem) => {
      if (order === "post_date") return thread.createDate;
      if (order === "reply_count" || order === "reply_count_asc") {
        return thread.replyCount;
      }
      if (order === "first_post_likes") return thread.likeCount;
      return thread.lastPost?.createDate ?? thread.createDate;
    };
    const merged = [...byId.values()].sort((left, right) => {
      const difference = value(left) - value(right);
      return difference === 0
        ? (left.threadId - right.threadId) * direction
        : difference * direction;
    });
    const offset = (page - 1) * limit;
    return {
      ok: true,
      threads: merged.slice(offset, offset + limit),
      total: totalKnown ? total : null,
      hasMore: totalKnown ? offset + limit < total : merged.length > offset + limit,
    };
  }

  if (query.source === "userPosts") {
    if (!query.posterUserId) return { ok: true, threads: [], total: 0 };
    try {
      const res = await apiFetch("POST", "/search/threads", token, {
        user_id: query.posterUserId,
        page: query.page ?? 1,
        limit: query.limit ?? THREADS_PER_PAGE,
      });
      const data = await readJson(res);
      if (!res.ok) return fail(statusToReason(res.status), apiError(data));
      const pageLimit = query.limit ?? THREADS_PER_PAGE;
      const rawRefs = arr(data?.["data"]);
      const ids: number[] = [];
      const seen = new Set<number>();
      for (const item of rawRefs) {
        const io = obj(item);
        if (!io) continue;
        const id = num(io["thread_id"]) ?? num(io["content_id"]);
        if (id === null || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      const CONCURRENCY = 4;
      const loaded: Array<ForumThreadItem | null> = [];
      for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const part = await Promise.all(
          ids.slice(i, i + CONCURRENCY).map(async (id) => {
            try {
              const tr = await apiFetch(
                "GET",
                `/threads/${id}?fields_include=*`,
                token,
              );
              if (!tr.ok) return null;
              const td = await readJson(tr);
              const rawThread = obj(td?.["thread"]);
              return rawThread ? mapThread(rawThread) : null;
            } catch {
              return null;
            }
          }),
        );
        loaded.push(...part);
      }
      const threads = loaded.filter((t): t is ForumThreadItem => t !== null);
      return {
        ok: true,
        threads,
        total: null,
        hasMore: rawRefs.length >= pageLimit,
      };
    } catch (err) {
      log.warn("[forum] search user threads failed", err);
      return fail("offline");
    }
  }

  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? THREADS_PER_PAGE));
  params.set("fields_include", "*");
  let path: string;
  if (query.source === "recent" || query.source === "new") {
    path = query.source === "recent" ? "/threads/recent" : "/threads/new";
    if (query.forumId) params.set("forum_id", String(query.forumId));
  } else {
    path = "/threads";
    if (query.forumId) params.set("forum_id", String(query.forumId));
    if (query.creatorUserId) {
      params.set("creator_user_id", String(query.creatorUserId));
    }
    if (query.tab) params.set("tab", query.tab);
    if (query.order) params.set("order", query.order);
    if (query.direction) params.set("direction", query.direction);
    if (query.state) params.set("state", query.state);
    if (query.period) params.set("period", query.period);
    if (query.title) params.set("title", query.title);
    if (query.titleOnly) params.set("title_only", "1");
    for (const id of query.prefixIds ?? []) {
      params.append("prefix_ids[]", String(id));
    }
    for (const id of query.prefixIdsNot ?? []) {
      params.append("prefix_ids_not[]", String(id));
    }
    if (query.postDateFrom) {
      const timestamp = Date.parse(`${query.postDateFrom}T00:00:00`);
      if (Number.isFinite(timestamp)) {
        params.set("thread_create_date", String(Math.floor(timestamp / 1000)));
      }
    }
    params.set("page", String(query.page ?? 1));
  }
  try {
    const res = await apiFetch("GET", `${path}?${params.toString()}`, token);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const threads: ForumThreadItem[] = [];
    const rawList =
      arr(data?.["data"]).length > 0
        ? arr(data?.["data"])
        : arr(data?.["threads"]);
    const flat: Raw[] = [];
    for (const t of rawList) {
      const to = obj(t);
      if (!to) continue;
      if (num(to["thread_id"]) === null) {
        const nested =
          arr(to["threads"]).length > 0 ? arr(to["threads"]) : arr(to["data"]);
        if (nested.length > 0) {
          for (const n of nested) {
            const no = obj(n);
            if (no) flat.push(no);
          }
          continue;
        }
      }
      flat.push(to);
    }
    for (const to of flat) {
      if (num(to["thread_id"]) !== null) threads.push(mapThread(to));
    }
    return { ok: true, threads, total: num(data?.["threads_total"]) };
  } catch (err) {
    log.warn("[forum] fetch threads failed", err);
    return fail("offline");
  }
};

export const fetchForumSection = async (
  forumId: number,
): Promise<ForumSectionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "GET",
      `/forums/${forumId}?fields_include=*,forum_rules_thread_id`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const forum = obj(data?.["forum"]);
    if (!forum) return fail("not_found");
    const links = obj(forum["links"]) ?? {};
    const perms = obj(forum["permissions"]) ?? {};
    const moderators: ForumModerator[] = [];
    for (const raw of arr(forum["forum_moderators"])) {
      const mo = obj(raw);
      if (!mo) continue;
      const user = mapUser(obj(mo["user"]) ?? mo);
      if (user.userId || user.username) moderators.push(user);
    }
    return {
      ok: true,
      section: {
        forumId: num(forum["forum_id"]) ?? forumId,
        title: stripTags(forum["forum_title"]) || String(forumId),
        description: str(forum["forum_description"]),
        threadCount: num(forum["forum_thread_count"]),
        postCount: num(forum["forum_post_count"]),
        rulesThreadId: num(forum["forum_rules_thread_id"]),
        isFollowed: flag(forum["forum_is_followed"]),
        canFollow: perms["follow"] === undefined ? true : flag(perms["follow"]),
        canCreateThread: flag(perms["create_thread"]),
        permalink: str(links["permalink"]),
        moderators,
      },
    };
  } catch (err) {
    log.warn("[forum] fetch forum section failed", err);
    return fail("offline");
  }
};

const toggleForumFollow = async (
  forumId: number,
  follow: boolean,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      follow ? "POST" : "DELETE",
      `/forums/${forumId}/followers`,
      token,
      follow ? {} : undefined,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] toggle forum follow failed", err);
    return fail("offline");
  }
};

export const followForum = (forumId: number): Promise<ForumActionResult> =>
  toggleForumFollow(forumId, true);

export const unfollowForum = (forumId: number): Promise<ForumActionResult> =>
  toggleForumFollow(forumId, false);

const parsePrefixIds = (rawThread: Raw): number[] => {
  const ids: number[] = [];
  for (const x of arr(rawThread["thread_prefix_ids"])) {
    const n = num(x);
    if (n && !ids.includes(n)) ids.push(n);
  }
  if (ids.length === 0) {
    for (const p of arr(rawThread["thread_prefixes"])) {
      const n = num(obj(p)?.["prefix_id"]);
      if (n && !ids.includes(n)) ids.push(n);
    }
  }
  const single = num(rawThread["prefix_id"]);
  if (ids.length === 0 && single) ids.push(single);
  return ids;
};

export const fetchForumThread = async (
  threadId: number,
): Promise<ForumThreadDetailsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "GET",
      `/threads/${threadId}?fields_include=*`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const rawThread = obj(data?.["thread"]);
    if (!rawThread) return fail("not_found");
    const firstPost = obj(rawThread["first_post"]);
    const bookmarkRaw = rawThread["thread_is_bookmarked"];
    const watchRaw =
      rawThread["thread_is_watched"] ??
      rawThread["is_watched"] ??
      rawThread["thread_user_is_watching"];
    const perms = obj(rawThread["permissions"]) ?? {};
    const thread = mapThread(rawThread);
    const discussionOpen =
      rawThread["thread_is_open"] !== undefined
        ? flag(rawThread["thread_is_open"])
        : !thread.isClosed;
    const editable: ForumThreadEditable = {
      title: thread.title,
      prefixIds: parsePrefixIds(rawThread),
      tags: thread.tags,
      discussionOpen,
      hideContacts: flag(rawThread["thread_hide_contacts"]),
      allowAskHiddenContent: flag(rawThread["allow_ask_hidden_content"]),
      replyGroup: num(rawThread["reply_group"]),
      commentIgnoreGroup: flag(rawThread["comment_ignore_group"]),
    };
    return {
      ok: true,
      thread,
      firstPost: firstPost ? mapPost(firstPost) : null,
      isBookmarked: bookmarkRaw === undefined ? null : flag(bookmarkRaw),
      isWatched: watchRaw === undefined ? null : flag(watchRaw),
      canEdit: flag(perms["edit"]),
      canDelete: flag(perms["delete"]),
      canReply:
        perms["reply"] !== undefined
          ? flag(perms["reply"])
          : perms["post"] !== undefined
            ? flag(perms["post"])
            : true,
      editable,
    };
  } catch (err) {
    log.warn("[forum] fetch thread failed", err);
    return fail("offline");
  }
};

export const fetchForumPosts = async (
  threadId: number,
  page: number,
  order?: string,
): Promise<ForumPostsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const orderParam = order ? `&order=${encodeURIComponent(order)}` : "";
    const res = await apiFetch(
      "GET",
      `/posts?thread_id=${threadId}&page=${page}&limit=${POSTS_PER_PAGE}&fields_include=*${orderParam}`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const posts: ForumPostItem[] = [];
    for (const p of arr(data?.["posts"])) {
      const po = obj(p);
      if (po) posts.push(mapPost(po));
    }
    return { ok: true, posts, total: num(data?.["posts_total"]) };
  } catch (err) {
    log.warn("[forum] fetch posts failed", err);
    return fail("offline");
  }
};

export const createForumPost = async (
  threadId: number,
  message: string,
): Promise<ForumCreatePostResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("POST", "/posts", token, {
      thread_id: threadId,
      post_body: message,
    });
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const post = obj(data?.["post"]);
    return { ok: true, post: post ? mapPost(post) : null };
  } catch (err) {
    log.warn("[forum] create post failed", err);
    return fail("offline");
  }
};


const sanitizePrefixCss = (css: string): string =>
  css
    .replace(/@charset[^;]*;/gi, "")
    .replace(/body[^}]*}/gi, "")
    .trim();

let prefixCssCache: string | null = null;

export const fetchThreadPrefixCss =
  async (): Promise<ForumPrefixCssResult> => {
    if (prefixCssCache !== null) return { ok: true, css: prefixCssCache };
    const token = getProfileToken();
    if (!token) return fail("no_token");
    try {
      const res = await apiFetch(
        "GET",
        "/css?css=public:thread_prefixes",
        token,
      );
      const data = await readJson(res);
      if (!res.ok) return fail(statusToReason(res.status), apiError(data));
      const css = sanitizePrefixCss(str(data?.["contents"]) ?? "");
      prefixCssCache = css;
      return { ok: true, css };
    } catch {
      return fail("offline");
    }
  };

const prefixOptionColor = (cssClass: string | null): string | null =>
  cssClass?.match(/#[0-9a-fA-F]{3,8}/)?.[0] ?? null;

export const fetchForumPrefixes = async (
  forumId: number,
): Promise<ForumPrefixesResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("GET", `/forums/${forumId}`, token);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const forum = obj(data?.["forum"]);
    const groups: ForumPrefixGroup[] = [];
    for (const g of arr(forum?.["forum_prefixes"])) {
      const go = obj(g);
      if (!go) continue;
      const prefixes: ForumPrefixOption[] = [];
      for (const p of arr(go["group_prefixes"])) {
        const po = obj(p);
        if (!po) continue;
        const id = num(po["prefix_id"]);
        const title = str(po["prefix_title"]);
        if (id === null || !title) continue;
        prefixes.push({
          prefixId: id,
          title,
          color: prefixOptionColor(str(po["css_class"])),
        });
      }
      if (prefixes.length > 0) {
        groups.push({ groupTitle: str(go["group_title"]), prefixes });
      }
    }
    return {
      ok: true,
      info: {
        groups,
        defaultPrefixId: num(forum?.["thread_default_prefix_id"]),
        required: forum?.["thread_prefix_is_required"] === true,
      },
    };
  } catch (err) {
    log.warn("[forum] fetch forum prefixes failed", err);
    return fail("offline");
  }
};

export const createForumThread = async (
  input: ForumCreateThreadInput,
): Promise<ForumCreateThreadResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  const body: Raw = {
    forum_id: input.forumId,
    title: input.title,
    post_body: input.body,
  };
  if (input.tags) {
    const tags = input.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.length > 0) body["tags"] = tags;
  }
  if (input.prefixIds && input.prefixIds.length > 0) {
    body["prefix_id"] = input.prefixIds;
  }
  if (typeof input.replyGroup === "number") {
    body["reply_group"] = input.replyGroup;
  }
  if (input.commentIgnoreGroup) body["comment_ignore_group"] = true;
  if (input.hideContacts) body["hide_contacts"] = true;
  if (input.dontAlertFollowers) body["dont_alert_followers"] = true;
  if (input.watchThread) body["watch_thread"] = true;
  if (input.watchThreadEmail) body["watch_thread_email"] = true;
  if (input.scheduleDate) body["schedule_date"] = input.scheduleDate;
  if (input.scheduleTime) body["schedule_time"] = input.scheduleTime;
  if (typeof input.maxReplyCount === "number") {
    body["max_reply_count_enabled"] = true;
    body["max_reply_count"] = input.maxReplyCount;
  }
  if (typeof input.replyDelay === "number") {
    body["thread_user_reply_delay_enabled"] = true;
    body["thread_user_reply_delay"] = input.replyDelay;
    body["thread_user_reply_delay_unit"] = "minutes";
  }
  try {
    const res = await apiFetch("POST", "/threads", token, body);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const thread = obj(data?.["thread"]);
    return { ok: true, threadId: thread ? num(thread["thread_id"]) : null };
  } catch (err) {
    log.warn("[forum] create thread failed", err);
    return fail("offline");
  }
};

export const createForumContest = async (
  input: ForumCreateContestInput,
): Promise<ForumCreateContestResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  const body: Raw = {
    forum_id: input.forumId,
    post_body: input.body,
    contest_type: input.contestType,
    prize_type: input.prizeType,
    require_like_count: input.requireLikeCount,
    require_total_like_count: input.requireTotalLikeCount,
  };
  if (input.title) body["title"] = input.title;
  if (typeof input.lengthValue === "number") {
    body["length_value"] = input.lengthValue;
  }
  if (input.lengthOption) body["length_option"] = input.lengthOption;
  if (typeof input.countWinners === "number") {
    body["count_winners"] = input.countWinners;
  }
  if (input.prizeType === "money") {
    if (typeof input.prizeMoney === "number") {
      body["prize_data_money"] = input.prizeMoney;
    }
    if (input.isMoneyPlaces) {
      body["is_money_places"] = true;
      if (input.prizePlaces && input.prizePlaces.length > 0) {
        body["prize_data_places"] = input.prizePlaces;
      }
    }
  } else if (input.prizeType === "upgrades") {
    if (typeof input.prizeUpgrade === "number") {
      body["prize_data_upgrade"] = input.prizeUpgrade;
    }
  }
  if (input.tags) {
    const tags = input.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.length > 0) body["tags"] = tags;
  }
  if (input.secretAnswer) body["secret_answer"] = input.secretAnswer;
  if (typeof input.replyGroup === "number") {
    body["reply_group"] = input.replyGroup;
  }
  if (input.commentIgnoreGroup) body["comment_ignore_group"] = true;
  if (input.dontAlertFollowers) body["dont_alert_followers"] = true;
  if (input.hideContacts) body["hide_contacts"] = true;
  if (input.allowAskHiddenContent) body["allow_ask_hidden_content"] = true;
  if (input.scheduleDate) body["schedule_date"] = input.scheduleDate;
  if (input.scheduleTime) body["schedule_time"] = input.scheduleTime;
  if (input.watchThread) body["watch_thread"] = true;
  if (input.watchThreadEmail) body["watch_thread_email"] = true;
  try {
    const res = await apiFetch("POST", "/contests", token, body);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const thread = obj(data?.["thread"]);
    return { ok: true, threadId: thread ? num(thread["thread_id"]) : null };
  } catch (err) {
    log.warn("[forum] create contest failed", err);
    return fail("offline");
  }
};

const toggleBookmark = async (
  threadId: number,
  add: boolean,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      add ? "POST" : "DELETE",
      `/threads/${threadId}/star`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] toggle bookmark failed", err);
    return fail("offline");
  }
};

export const bookmarkThread = (threadId: number): Promise<ForumActionResult> =>
  toggleBookmark(threadId, true);

export const unbookmarkThread = (
  threadId: number,
): Promise<ForumActionResult> => toggleBookmark(threadId, false);

const togglePostLike = async (
  postId: number,
  add: boolean,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      add ? "POST" : "DELETE",
      `/posts/${postId}/likes`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] toggle post like failed", err);
    return fail("offline");
  }
};

export const likePost = (postId: number): Promise<ForumActionResult> =>
  togglePostLike(postId, true);

export const unlikePost = (postId: number): Promise<ForumActionResult> =>
  togglePostLike(postId, false);

export const hideThread = async (
  threadId: number,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("POST", `/threads/${threadId}/hide`, token);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] hide thread failed", err);
    return fail("offline");
  }
};


export const watchThread = async (
  threadId: number,
  email = false,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "POST",
      `/threads/${threadId}/followers`,
      token,
      email ? { email: true } : undefined,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] watch thread failed", err);
    return fail("offline");
  }
};

export const unwatchThread = async (
  threadId: number,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "DELETE",
      `/threads/${threadId}/followers`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] unwatch thread failed", err);
    return fail("offline");
  }
};

export const editThread = async (
  input: ForumEditThreadInput,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  const body: Raw = {};
  if (input.title !== undefined) body["title"] = input.title;
  if (input.prefixIds !== undefined) body["prefix_id"] = input.prefixIds;
  if (input.tags !== undefined) body["tags"] = input.tags;
  if (input.discussionOpen !== undefined) {
    body["discussion_open"] = input.discussionOpen;
  }
  if (input.hideContacts !== undefined) {
    body["hide_contacts"] = input.hideContacts;
  }
  if (input.allowAskHiddenContent !== undefined) {
    body["allow_ask_hidden_content"] = input.allowAskHiddenContent;
  }
  if (typeof input.replyGroup === "number") {
    body["reply_group"] = input.replyGroup;
  }
  if (input.commentIgnoreGroup !== undefined) {
    body["comment_ignore_group"] = input.commentIgnoreGroup;
  }
  try {
    const res = await apiFetch(
      "PUT",
      `/threads/${input.threadId}`,
      token,
      body,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] edit thread failed", err);
    return fail("offline");
  }
};

export const deleteThread = async (
  threadId: number,
  reason?: string,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "DELETE",
      `/threads/${threadId}`,
      token,
      reason ? { reason } : undefined,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] delete thread failed", err);
    return fail("offline");
  }
};

export const bumpThread = async (
  threadId: number,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("POST", `/threads/${threadId}/bump`, token);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] bump thread failed", err);
    return fail("offline");
  }
};

export const fetchThreadModeratorLog = async (
  threadId: number,
): Promise<ForumModeratorLogResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "GET",
      `/threads/${threadId}?fields_include=*`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const rawThread = obj(data?.["thread"]) ?? {};
    const rawLog =
      rawThread["thread_moderator_logs"] ??
      rawThread["moderator_logs"] ??
      rawThread["moderator_actions"] ??
      rawThread["thread_log"] ??
      data?.["moderator_logs"];
    const entries: ForumModeratorLogEntry[] = [];
    const list = Array.isArray(rawLog)
      ? rawLog
      : obj(rawLog)
        ? Object.values(obj(rawLog) as Raw)
        : [];
    for (const item of list) {
      const o = obj(item);
      if (!o) continue;
      const moderator =
        stripTags(o["username"] ?? o["moderator"] ?? o["user"]) ||
        (str(o["moderator_username"]) ?? "");
      const action =
        str(o["action"]) ??
        str(o["action_title"]) ??
        str(o["description"]) ??
        str(o["text"]) ??
        "";
      const date =
        num(o["date"]) ??
        num(o["log_date"]) ??
        num(o["action_date"]) ??
        num(o["create_date"]);
      if (moderator || action) entries.push({ moderator, action, date });
    }
    return { ok: true, entries };
  } catch (err) {
    log.warn("[forum] moderator log failed", err);
    return fail("offline");
  }
};

export const fetchPostBody = async (
  postId: number,
): Promise<ForumPostBodyResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "GET",
      `/posts/${postId}?fields_include=post_body`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const post = obj(data?.["post"]) ?? {};
    return { ok: true, body: str(post["post_body"]) ?? "" };
  } catch (err) {
    log.warn("[forum] fetch post body failed", err);
    return fail("offline");
  }
};

export const editPost = async (
  postId: number,
  body: string,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("PUT", `/posts/${postId}`, token, {
      post_body: body,
    });
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] edit post failed", err);
    return fail("offline");
  }
};

const parseKeywords = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v.map((x) => str(x) ?? "").filter((x) => x.length > 0);
  }
  const raw = str(v);
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
};

export const fetchFeedOptions = async (): Promise<ForumFeedOptionsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("GET", "/forums/feed/options", token);
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const forums: ForumFeedOptions["forums"] = [];
    for (const f of arr(data?.["forums"])) {
      const fo = obj(f);
      if (!fo) continue;
      const forumId = num(fo["forum_id"]) ?? num(fo["node_id"]);
      const title = str(fo["forum_title"]) ?? str(fo["title"]);
      if (forumId !== null && title !== null) forums.push({ forumId, title });
    }
    const excludedForumIds: number[] = [];
    for (const id of arr(data?.["excluded_forums_ids"])) {
      const n = num(id);
      if (n !== null) excludedForumIds.push(n);
    }
    return {
      ok: true,
      options: {
        forums,
        excludedForumIds,
        keywords: parseKeywords(data?.["keywords"]),
      },
    };
  } catch (err) {
    log.warn("[forum] fetch feed options failed", err);
    return fail("offline");
  }
};

export const updateFeedOptions = async (
  nodeIds: number[],
  keywords: string[],
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("PUT", "/forums/feed/options", token, {
      node_ids: nodeIds,
      keywords,
    });
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] update feed options failed", err);
    return fail("offline");
  }
};

export const fetchPostComments = async (
  postId: number,
): Promise<ForumPostCommentsResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch(
      "GET",
      `/posts/comments?post_id=${postId}`,
      token,
    );
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    const comments: ForumPostComment[] = [];
    for (const c of arr(data?.["comments"])) {
      const co = obj(c);
      if (co) comments.push(mapComment(co));
    }
    return { ok: true, comments };
  } catch (err) {
    log.warn("[forum] fetch post comments failed", err);
    return fail("offline");
  }
};

export const commentPost = async (
  postId: number,
  body: string,
): Promise<ForumActionResult> => {
  const token = getProfileToken();
  if (!token) return fail("no_token");
  try {
    const res = await apiFetch("POST", "/posts/comments", token, {
      post_id: postId,
      comment_body: body,
    });
    const data = await readJson(res);
    if (!res.ok) return fail(statusToReason(res.status), apiError(data));
    return { ok: true };
  } catch (err) {
    log.warn("[forum] comment post failed", err);
    return fail("offline");
  }
};
