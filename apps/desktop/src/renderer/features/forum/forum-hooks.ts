
import { useMemo } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import type { ForumNode, ForumThreadsQuery } from "@lzt/shared";
import { i18n } from "~/i18n";
import type { ForumFilters, ForumOrder, ForumSection } from "./forum-store";

export const THREADS_PAGE_SIZE = 20;
export const POSTS_PAGE_SIZE = 20;

const RELATIVE_STEPS: Array<{
  limit: number;
  div: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { limit: 60, div: 1, unit: "second" },
  { limit: 3600, div: 60, unit: "minute" },
  { limit: 86400, div: 3600, unit: "hour" },
  { limit: 2592000, div: 86400, unit: "day" },
  { limit: 31536000, div: 2592000, unit: "month" },
  { limit: Infinity, div: 31536000, unit: "year" },
];

export const formatForumDate = (unix: number): string => {
  if (!unix) return "";
  const diffSec = Math.round(Date.now() / 1000 - unix);
  if (diffSec < 1) return i18n.t("forum.time.justNow");
  const rtf = new Intl.RelativeTimeFormat(i18n.language || "ru", {
    numeric: "auto",
  });
  for (const step of RELATIVE_STEPS) {
    if (Math.abs(diffSec) < step.limit) {
      const value = Math.round(diffSec / step.div);
      return rtf.format(-value, step.unit);
    }
  }
  return "";
};

export const formatAbsoluteDate = (unix: number): string =>
  unix
    ? new Date(unix * 1000).toLocaleString(i18n.language || [], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

export const useForumPrefixes = (forumId: number | null) =>
  useQuery({
    queryKey: ["forum", "prefixes", forumId],
    queryFn: () => window.moderator.forum.getPrefixes(forumId as number),
    enabled: typeof forumId === "number",
    staleTime: 5 * 60_000,
  });

export const useForumSection = (forumId: number | null) =>
  useQuery({
    queryKey: ["forum", "section", forumId],
    queryFn: () => window.moderator.forum.getSection(forumId as number),
    enabled: typeof forumId === "number" && forumId > 0,
    staleTime: 60_000,
  });

export const useForumTree = () =>
  useQuery({
    queryKey: ["forum", "tree"],
    queryFn: () => window.moderator.forum.getTree(),
    staleTime: 5 * 60_000,
  });

export const useForumTitleMap = (): Map<number, string> => {
  const tree = useForumTree();
  return useMemo(() => {
    const map = new Map<number, string>();
    const walk = (nodes: ForumNode[]) => {
      for (const node of nodes) {
        map.set(node.forumId, node.title);
        if (node.children.length > 0) walk(node.children);
      }
    };
    if (tree.data?.ok) walk(tree.data.forums);
    return map;
  }, [tree.data]);
};

export const useForumIconMap = (): Map<number, string | null> => {
  const tree = useForumTree();
  return useMemo(() => {
    const map = new Map<number, string | null>();
    const walk = (nodes: ForumNode[]) => {
      for (const node of nodes) {
        map.set(node.forumId, node.iconContent);
        if (node.children.length > 0) walk(node.children);
      }
    };
    if (tree.data?.ok) walk(tree.data.forums);
    return map;
  }, [tree.data]);
};

export const useMyUserId = () =>
  useQuery({
    queryKey: ["forum", "me"],
    queryFn: async () => {
      const res = await window.moderator.profile.getMe();
      return res.ok ? res.profile.userId : null;
    },
    staleTime: Infinity,
  });

export const useMyProfile = () =>
  useQuery({
    queryKey: ["forum", "me", "profile"],
    queryFn: async () => {
      const res = await window.moderator.profile.getMe();
      return res.ok ? res.profile : null;
    },
    staleTime: 5 * 60_000,
  });

const orderToApi = (order: ForumOrder): string => {
  switch (order) {
    case "thread_create_date":
      return "post_date";
    case "thread_post_count":
      return "reply_count";
    case "first_post_likes":
      return "first_post_likes";
    case "last_read_date":
      return "last_post_date";
    case "bookmark_date":
      return "last_post_date";
    case "noReply":
      return "reply_count_asc";
    default:
      return "last_post_date";
  }
};

const filtersToQuery = (filters: ForumFilters): Partial<ForumThreadsQuery> => {
  const query: Partial<ForumThreadsQuery> = {
    order: orderToApi(filters.order),
    direction: filters.direction,
  };
  if (filters.prefixId) query.prefixIds = [filters.prefixId];
  if (filters.excludePrefixId) query.prefixIdsNot = [filters.excludePrefixId];
  if (filters.period) query.period = filters.period;
  if (filters.state) query.state = filters.state;
  if (filters.dateFrom) query.postDateFrom = filters.dateFrom;
  if (filters.dateTo) query.postDateTo = filters.dateTo;
  const title = filters.title.trim();
  if (title) {
    query.title = title;
    query.titleOnly = filters.titleOnly;
  }
  return query;
};

const sectionQuery = (
  section: ForumSection,
  myUserId: number | null,
  page: number,
  order: ForumOrder,
  filters?: ForumFilters,
): ForumThreadsQuery => {
  const filterQuery = filters ? filtersToQuery(filters) : {};
  switch (section.type) {
    case "all":
      return { page, order: orderToApi(order), ...filterQuery };
    case "forum":
      return {
        forumId: section.forumId,
        page,
        ...(filters ? filterQuery : { order: orderToApi(order) }),
      };
    case "customTab":
      return {
        forumIds: section.forumIds,
        page,
        ...(filters ? filterQuery : { order: orderToApi(order) }),
      };
    case "my":
      return {
        tab: "userthreads",
        page,
        order: "thread_create_date",
        ...filterQuery,
      };
    case "userPosts":
      return { source: "userPosts", posterUserId: myUserId ?? undefined, page };
    case "userThreads":
      return {
        creatorUserId: section.userId,
        page,
        order: "thread_create_date",
        ...filterQuery,
      };
    case "bookmarks":
      return { tab: "fave", page, ...filterQuery };
    case "read":
      return { tab: "viewedthreads", page, ...filterQuery };
    case "scheduled":
      return { tab: "scheduledthreads", page, ...filterQuery };
  }
};

export const useForumThreads = (
  section: ForumSection,
  page: number,
  order: ForumOrder,
) => {
  const { data: myUserId } = useMyUserId();
  const enabled =
    section.type !== "userPosts" || typeof myUserId === "number";
  return useQuery({
    queryKey: ["forum", "threads", section, page, order, myUserId ?? null],
    queryFn: () =>
      window.moderator.forum.getThreads(
        sectionQuery(section, myUserId ?? null, page, order),
      ),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useForumThreadsInfinite = (
  section: ForumSection,
  order: ForumOrder,
  filters?: ForumFilters,
) => {
  const { data: myUserId } = useMyUserId();
  const enabled =
    section.type !== "userPosts" || typeof myUserId === "number";
  return useInfiniteQuery({
    queryKey: [
      "forum",
      "threadsInfinite",
      section,
      order,
      filters ?? null,
      myUserId ?? null,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      window.moderator.forum.getThreads(
        sectionQuery(
          section,
          myUserId ?? null,
          pageParam as number,
          order,
          filters,
        ),
      ),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.ok) return undefined;
      if (lastPage.threads.length === 0) return undefined;

      const previousThreadIds = new Set<number>();
      for (const page of allPages.slice(0, -1)) {
        if (!page.ok) continue;
        for (const thread of page.threads) {
          previousThreadIds.add(thread.threadId);
        }
      }

      const hasNewThreads = lastPage.threads.some(
        (thread) => !previousThreadIds.has(thread.threadId),
      );
      if (!hasNewThreads) return undefined;

      const loadedThreadIds = new Set(previousThreadIds);
      for (const thread of lastPage.threads) {
        loadedThreadIds.add(thread.threadId);
      }

      if (
        lastPage.total !== null &&
        loadedThreadIds.size >= lastPage.total
      ) {
        return undefined;
      }
      if (lastPage.threads.length < THREADS_PAGE_SIZE) return undefined;
      if (lastPage.hasMore === false) return undefined;
      return allPages.length + 1;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useForumThreadsPage = (
  section: ForumSection,
  page: number,
  order: ForumOrder,
  filters?: ForumFilters,
) => {
  const { data: myUserId } = useMyUserId();
  const enabled = section.type === "forum" || section.type === "customTab";
  return useQuery({
    queryKey: [
      "forum",
      "threadsPage",
      section,
      page,
      order,
      filters ?? null,
      myUserId ?? null,
    ],
    queryFn: () =>
      window.moderator.forum.getThreads(
        sectionQuery(section, myUserId ?? null, page, order, filters),
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useFeedOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ["forum", "feedOptions"],
    queryFn: () => window.moderator.forum.getFeedOptions(),
    enabled,
    staleTime: 60_000,
  });

export const useForumThread = (threadId: number) =>
  useQuery({
    queryKey: ["forum", "thread", threadId],
    queryFn: () => window.moderator.forum.getThread(threadId),
    refetchInterval: 60_000,
  });

export const useForumPosts = (
  threadId: number,
  page: number,
  order?: string,
) =>
  useQuery({
    queryKey: ["forum", "posts", threadId, page, order ?? null],
    queryFn: () => window.moderator.forum.getPosts(threadId, page, order),
    refetchInterval: 20_000,
  });

export const useForumModeratorLog = (threadId: number, enabled: boolean) =>
  useQuery({
    queryKey: ["forum", "moderatorLog", threadId],
    queryFn: () => window.moderator.forum.getModeratorLog(threadId),
    enabled,
  });

export const usePostComments = (postId: number) =>
  useQuery({
    queryKey: ["forum", "comments", postId],
    queryFn: () => window.moderator.forum.getComments(postId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

export const formatThreadDate = (unix: number): string => {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const now = new Date();
  const startOfDay = (x: Date): number =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = d.toLocaleTimeString(i18n.language || [], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const at = i18n.t("forum.at");
  if (dayDiff === 0) return `${i18n.t("forum.today")}, ${at} ${time}`;
  if (dayDiff === 1) return `${i18n.t("forum.yesterday")}, ${at} ${time}`;
  const date = d.toLocaleDateString(i18n.language || [], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${date}, ${at} ${time}`;
};

export const useForumBreadcrumb = (
  forumId: number | null,
): Array<{ forumId: number; title: string }> => {
  const tree = useForumTree();
  return useMemo(() => {
    if (typeof forumId !== "number") return [];
    const result: Array<{ forumId: number; title: string }> = [];
    const walk = (
      nodes: ForumNode[],
      trail: Array<{ forumId: number; title: string }>,
    ): boolean => {
      for (const node of nodes) {
        const next = [...trail, { forumId: node.forumId, title: node.title }];
        if (node.forumId === forumId) {
          result.push(...next);
          return true;
        }
        if (node.children.length > 0 && walk(node.children, next)) return true;
      }
      return false;
    };
    if (tree.data?.ok) walk(tree.data.forums, []);
    return result;
  }, [tree.data, forumId]);
};
