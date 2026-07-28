import { useViewStore } from "~/stores/view";
import { useMarketRoute } from "~/stores/marketRoute";
import { useForumMiniProfile } from "~/stores/forumMiniProfile";
import { useForumStore } from "~/features/forum/forum-store";


const parseForumUserId = (url: string): number | null => {
  const m = url.match(/lolz\.(?:team|live)\/members\/(?:[^/]*?\.)?(\d+)/i);
  if (m && m[1]) return Number(m[1]);
  return null;
};

const parseForumUserSlug = (url: string): string | null => {
  const m = url.match(/lolz\.(?:team|live)\/members\/([^/?#]+)/i);
  if (!m || !m[1]) return null;
  const slug = decodeURIComponent(m[1]).replace(/\.\d+$/, "");
  return slug || null;
};

const parseMarketItemId = (url: string): number | null => {
  const m = url.match(/lzt\.market\/(\d+)(?:[/?#]|$)/i);
  if (m && m[1]) return Number(m[1]);
  return null;
};

const parseThreadId = (url: string): number | null => {
  const m = url.match(/lolz\.(?:team|live)\/threads\/(?:[^/?#]*?\.)?(\d+)/i);
  if (m && m[1]) return Number(m[1]);
  return null;
};

const parseForum = (url: string): { id: number; name: string } | null => {
  const m = url.match(/lolz\.(?:team|live)\/forums\/(?:([^/?#]*?)\.)?(\d+)/i);
  if (!m || !m[2]) return null;
  const slug = m[1] ? decodeURIComponent(m[1]).replace(/-/g, " ").trim() : "";
  return { id: Number(m[2]), name: slug };
};

const isForumHome = (url: string): boolean =>
  /^https?:\/\/lolz\.(?:team|live)\/?(?:[?#]|$)/i.test(url);

const RESERVED_SEGMENTS = new Set([
  "account", "members", "threads", "forums", "posts", "chat",
  "conversations", "search", "whats-new", "find-new", "online", "help",
  "misc", "pages", "tags", "categories", "articles", "login", "logout",
  "register", "lost-password", "market", "goto", "attachments", "watched",
  "notifications", "new-features",
]);
const parseUserlinkSlug = (url: string): string | null => {
  const m = url.match(/^https?:\/\/lolz\.(?:team|live)\/([^/?#]+)\/?(?:[?#]|$)/i);
  if (!m || !m[1]) return null;
  const seg = decodeURIComponent(m[1]);
  if (RESERVED_SEGMENTS.has(seg.toLowerCase())) return null;
  if (!/^[a-zA-Z0-9][\w.-]*$/.test(seg)) return null;
  return seg;
};

export const openLztLink = (url: string): boolean => {
  if (!url) return false;

  if (/lzt\.market\//i.test(url)) {
    const itemId = parseMarketItemId(url);
    if (itemId) {
      useViewStore.getState().setView("market");
      useMarketRoute.getState().openItem(itemId);
      return true;
    }
    return false;
  }

  if (/lolz\.(?:team|live)\/members\//i.test(url)) {
    const userId = parseForumUserId(url);
    const target = userId ?? parseForumUserSlug(url);
    if (target != null) {
      useViewStore.getState().setView("forum");
      useForumMiniProfile.getState().open(target);
      return true;
    }
    return false;
  }

  if (/lolz\.(?:team|live)\/threads\//i.test(url)) {
    const threadId = parseThreadId(url);
    if (threadId) {
      useViewStore.getState().setView("forum");
      useForumStore.getState().openThread(threadId);
      return true;
    }
    return false;
  }

  if (/lolz\.(?:team|live)\/forums\//i.test(url)) {
    const forum = parseForum(url);
    if (forum) {
      useForumStore.getState().selectSection({
        type: "forum",
        forumId: forum.id,
        title: forum.name || `#${forum.id}`,
      });
      useViewStore.getState().setView("forum");
      return true;
    }
    return false;
  }

  if (isForumHome(url)) {
    useForumStore.getState().selectSection({ type: "all" });
    useViewStore.getState().setView("forum");
    return true;
  }

  const slug = parseUserlinkSlug(url);
  if (slug) {
    useViewStore.getState().setView("forum");
    useForumMiniProfile.getState().open(slug);
    return true;
  }

  return false;
};

export const openLztLinkOrExternal = (url: string): void => {
  if (!openLztLink(url)) void window.moderator.app.openExternal(url);
};
