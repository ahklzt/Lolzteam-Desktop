
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Clock,
  EyeOff,
  Eye,
  Flag,
  Hash,
  Heart,
  Lock,
  MessageCircle,
  MessageSquare,
  Pin,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { profileSiteLinks, type ForumThreadItem } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { useViewStore } from "~/stores/view";
import { useForumMiniProfile } from "~/stores/forumMiniProfile";
import { labelColors } from "~/lib/labelColor";
import { RichUsername } from "~/features/profile/RichUsername";
import { renderChatHtml } from "~/features/chat/chat-html";
import { Avatar } from "./Avatar";
import {
  CONTEST_HIDDEN_IDS,
  type ForumOrder,
  useForumStore,
} from "./forum-store";
import {
  formatAbsoluteDate,
  formatForumDate,
  useForumIconMap,
  useForumThreadsInfinite,
  useForumThreadsPage,
  useForumTitleMap,
} from "./forum-hooks";
import { LiveRelativeTime } from "~/lib/LiveRelativeTime";
import { FeedSettingsModal } from "./FeedSettingsModal";
import { ForumEditor } from "./ForumEditor";
import { ForumSectionHeader } from "./ForumSectionHeader";
import { ForumListHeader } from "./ForumListHeader";
import styles from "./forum.module.scss";

const ORDER_ITEMS: Array<{ value: ForumOrder; key: string }> = [
  { value: "last_post_date", key: "forum.filter.byLastReply" },
  { value: "thread_create_date", key: "forum.filter.byCreateDate" },
  { value: "thread_post_count", key: "forum.filter.byReplies" },
  { value: "first_post_likes", key: "forum.filter.byLikes" },
  { value: "noReply", key: "forum.filter.noReplies" },
];

export const ThreadList = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const section = useForumStore((s) => s.section);
  const order = useForumStore((s) => s.order);
  const setOrder = useForumStore((s) => s.setOrder);
  const search = useForumStore((s) => s.search);
  const filters = useForumStore((s) => s.filters);
  const openThread = useForumStore((s) => s.openThread);
  const hiddenThreadIds = useForumStore((s) => s.hiddenThreadIds);
  const hideThreadLocally = useForumStore((s) => s.hideThreadLocally);
  const setView = useViewStore((s) => s.setView);
  const openMini = useForumMiniProfile((s) => s.open);

  const isSection = section.type === "forum" || section.type === "customTab";
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useForumThreadsInfinite(section, order, filters);
  const [sectionPage, setSectionPage] = useState(1);
  const pageQ = useForumThreadsPage(
    section,
    sectionPage,
    order,
    isSection ? filters : undefined,
  );
  useEffect(() => {
    setSectionPage(1);
  }, [section, order, filters]);
  const titleMap = useForumTitleMap();
  const iconMap = useForumIconMap();
  const [likes, setLikes] = useState<
    Record<number, { liked: boolean; count: number }>
  >({});
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isSection) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isSection]);

  const showToolbar = section.type === "all";
  const showFeedSettings = section.type === "all";
  const compactLayout = section.type === "forum" || section.type === "userPosts";
  const specialSectionType =
    section.type === "my" ||
    section.type === "read" ||
    section.type === "bookmarks" ||
    section.type === "scheduled"
      ? section.type
      : null;

  const [feedOpen, setFeedOpen] = useState(false);

  const title =
    section.type === "forum" || section.type === "customTab"
      ? section.title
      : section.type === "userThreads"
        ? t("forum.userThreads", { name: section.username })
        : section.type === "all"
        ? t("forum.allDiscussions")
        : section.type === "my"
          ? t("forum.myThreads")
          : section.type === "userPosts"
            ? t("forum.myMessages")
            : section.type === "bookmarks"
              ? t("forum.bookmarks")
              : section.type === "scheduled"
                ? t("forum.scheduledThreads")
                : t("forum.readThreads");

  const firstPage = isSection ? pageQ.data : data?.pages[0];
  const listLoading = isSection ? pageQ.isLoading : isLoading;
  const listRefreshing = isSection && pageQ.isFetching && !pageQ.isLoading;
  const rawThreads = useMemo(() => {
    if (isSection) {
      return pageQ.data?.ok ? pageQ.data.threads : [];
    }
    const seen = new Set<number>();
    const out: ForumThreadItem[] = [];
    for (const p of data?.pages ?? []) {
      if (!p.ok) continue;
      for (const th of p.threads) {
        if (seen.has(th.threadId)) continue;
        seen.add(th.threadId);
        out.push(th);
      }
    }
    return out;
  }, [data, isSection, pageQ.data]);

  const threads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const noReplyActive = order === "noReply" || filters.order === "noReply";
    const fromTs =
      filters.dateFrom
        ? Math.floor(new Date(`${filters.dateFrom}T00:00:00`).getTime() / 1000)
        : null;
    const toTs =
      filters.dateTo
        ? Math.floor(new Date(`${filters.dateTo}T23:59:59`).getTime() / 1000)
        : null;
    return rawThreads.filter((thread) => {
      if (hiddenThreadIds.includes(thread.threadId)) return false;
      if (section.type === "bookmarks" && bookmarks[thread.threadId] === false) {
        return false;
      }
      if (!isSection && CONTEST_HIDDEN_IDS.has(thread.forumId)) return false;
      if (q && !thread.title.toLowerCase().includes(q)) return false;
      if (noReplyActive && thread.replyCount > 0) return false;
      if (fromTs !== null && thread.createDate < fromTs) return false;
      if (toTs !== null && thread.createDate > toTs) return false;
      return true;
    });
  }, [rawThreads, hiddenThreadIds, search, order, isSection, filters, bookmarks, section.type]);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["forum", "threadsInfinite"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["forum", "threadsPage"],
    });
    void queryClient.invalidateQueries({ queryKey: ["forum", "threads"] });
  };

  const goToPage = (target: number) => {
    setSectionPage(Math.max(1, target));
  };


  const toggleReply = (threadId: number) => {
    setReplyText("");
    setReplyFor((cur) => (cur === threadId ? null : threadId));
  };

  const submitReply = async (threadId: number) => {
    if (!replyText.trim() || replySending) return;
    setReplySending(true);
    const res = await window.moderator.forum.createPost(threadId, replyText);
    setReplySending(false);
    if (!res.ok) {
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
      return;
    }
    setReplyText("");
    setReplyFor(null);
    pushToast({ kind: "success", title: t("forum.replySent") });
    refresh();
  };

  const toggleBookmark = async (
    thread: ForumThreadItem,
    currentlyBookmarked: boolean,
  ) => {
    const next = !currentlyBookmarked;
    setBookmarks((current) => ({ ...current, [thread.threadId]: next }));
    const res = next
      ? await window.moderator.forum.bookmark(thread.threadId)
      : await window.moderator.forum.unbookmark(thread.threadId);
    if (!res.ok) {
      setBookmarks((current) => ({
        ...current,
        [thread.threadId]: currentlyBookmarked,
      }));
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
      return;
    }
    pushToast({
      kind: "success",
      title: t(next ? "forum.bookmarkAdded" : "forum.bookmarkRemoved"),
    });
    refresh();
    void queryClient.invalidateQueries({
      queryKey: ["forum", "thread", thread.threadId],
    });
  };

  const hide = async (threadId: number) => {
    const res = await window.moderator.forum.hideThread(threadId);
    hideThreadLocally(threadId);
    pushToast(
      res.ok
        ? { kind: "success", title: t("forum.threadHidden") }
        : { kind: "error", title: res.message ?? t("forum.loadError") },
    );
  };

  const complain = (userId: number, username: string) => {
    if (!userId) return;
    window.open(profileSiteLinks.complaint(userId, username), "_blank");
  };

  const toggleLike = async (thread: ForumThreadItem) => {
    if (!thread.firstPostId) return;
    const current = likes[thread.threadId] ?? {
      liked: thread.isLiked,
      count: thread.likeCount,
    };
    const optimistic = {
      liked: !current.liked,
      count: Math.max(0, current.count + (current.liked ? -1 : 1)),
    };
    setLikes((map) => ({ ...map, [thread.threadId]: optimistic }));
    const res = optimistic.liked
      ? await window.moderator.forum.likePost(thread.firstPostId)
      : await window.moderator.forum.unlikePost(thread.firstPostId);
    if (!res.ok) {
      setLikes((map) => ({ ...map, [thread.threadId]: current }));
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
    }
  };

  return (
    <div className={styles.listWrap}>
      {(section.type === "forum" || section.type === "customTab") && (
        <ForumSectionHeader
          forumId={section.forumId}
          displayTitle={title}
          loadedPages={sectionPage}
          total={pageQ.data?.ok ? pageQ.data.total : null}
          onGoToPage={goToPage}
          onRefresh={refresh}
        />
      )}

      {specialSectionType && (
        <ForumListHeader
          sectionType={specialSectionType}
          title={title}
          total={firstPage?.ok ? firstPage.total : null}
          loadedCount={threads.length}
          onRefresh={refresh}
        />
      )}

      <div
        className={styles.listHead}
        hidden={isSection || specialSectionType !== null}
      >
        <h2 className={styles.listTitle}>
          {showToolbar ? t("forum.feedSortHint") : title}
        </h2>

        {showToolbar && (
          <div className={styles.toolbar}>
            <label className={styles.orderControl}>
              <select
                className={styles.orderSelect}
                value={order}
                aria-label={t("forum.filter.label")}
                onChange={(event) => setOrder(event.target.value as ForumOrder)}
              >
                {ORDER_ITEMS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.key)}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.toolbarActions}>
              {showFeedSettings && (
                <button
                  type="button"
                  className={styles.toolBtn}
                  title={t("forum.feedSettings")}
                  aria-label={t("forum.feedSettings")}
                  onClick={() => setFeedOpen(true)}
                >
                  <SlidersHorizontal size={20} />
                </button>
              )}

              <button
                type="button"
                className={styles.toolBtn}
                title={t("forum.refreshFeed")}
                aria-label={t("forum.refreshFeed")}
                onClick={refresh}
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {listLoading && (
        <div className={styles.threadSkeleton} aria-label={t("forum.loading")}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={styles.threadSkeletonRow}>
              <span className={styles.threadSkeletonAvatar} />
              <span className={styles.threadSkeletonBody}>
                <span className={styles.threadSkeletonLine} />
                <span className={styles.threadSkeletonLineShort} />
              </span>
            </div>
          ))}
        </div>
      )}
      {listRefreshing && <div className={styles.threadLoadingBar} />}
      {firstPage && !firstPage.ok && (
        <div className={styles.hint}>
          {firstPage.message ?? t("forum.loadError")}
        </div>
      )}
      {firstPage?.ok && threads.length === 0 && (
        <div className={styles.hint}>{t("forum.empty")}</div>
      )}

      <div
        className={`${styles.threads} ${compactLayout ? styles.compactThreads : ""}`}
      >
        {threads.map((thread) => {
          const like = likes[thread.threadId] ?? {
            liked: thread.isLiked,
            count: thread.likeCount,
          };
          const bookmarked =
            bookmarks[thread.threadId] ??
            (thread.isBookmarked || section.type === "bookmarks");
          const category = titleMap.get(thread.forumId);
          const categoryIcon = iconMap.get(thread.forumId) ?? null;
          const lastPost = thread.lastPost;
          const showLast = Boolean(
            lastPost &&
              lastPost.postId !== thread.firstPostId &&
              lastPost.bodyHtml,
          );
          const replyOpen = replyFor === thread.threadId;
          const open = () => openThread(thread.threadId);
          if (compactLayout) {
            const lastUser = lastPost?.user ?? thread.creator;
            const lastDate = lastPost?.createDate ?? thread.createDate;
            return (
              <article key={thread.threadId} className={styles.compactThread}>
                <button
                  type="button"
                  className={styles.compactMain}
                  onClick={open}
                >
                  <div className={styles.compactBody}>
                    <div className={styles.compactTitleRow}>
                      {thread.isSticky && (
                        <Pin size={14} className={styles.compactFlag} />
                      )}
                      {thread.isClosed && (
                        <Lock size={14} className={styles.compactFlag} />
                      )}
                      {thread.prefixes.length > 0 && (
                        <span className={styles.compactPrefixes}>
                          {thread.prefixes.map((prefix) => {
                            const background = prefix.color;
                            const color =
                              prefix.textColor ??
                              (background
                                ? labelColors(background).text
                                : undefined);
                            return (
                              <span
                                key={prefix.title}
                                className={
                                  prefix.cssClass
                                    ? `${styles.prefix} ${prefix.cssClass}`
                                    : styles.prefix
                                }
                                style={
                                  prefix.cssClass
                                    ? undefined
                                    : background || color
                                      ? {
                                          backgroundColor: background ?? undefined,
                                          color,
                                        }
                                      : undefined
                                }
                              >
                                {prefix.title}
                              </span>
                            );
                          })}
                        </span>
                      )}
                      <span className={styles.compactTitle}>{thread.title}</span>
                    </div>
                    <div className={styles.compactMeta}>
                      <RichUsername
                        html={thread.creator.usernameHtml}
                        fallback={thread.creator.username}
                        userId={thread.creator.userId}
                        className={styles.compactCreator}
                      />
                      <span className={styles.compactMetaDivider} />
                      <LiveRelativeTime
                        unix={thread.createDate}
                        format={formatForumDate}
                        title={formatAbsoluteDate(thread.createDate)}
                      />
                      <span className={styles.compactStat}>
                        <MessageCircle size={14} />
                        {thread.replyCount}
                      </span>
                      <span className={styles.compactStat}>
                        <Heart size={14} />
                        {thread.likeCount}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.compactLastPost}
                  onClick={open}
                >
                  <Avatar
                    url={lastUser.avatarUrl}
                    name={lastUser.username}
                    className={styles.compactLastAvatar ?? ""}
                  />
                  <span className={styles.compactLastInfo}>
                    <RichUsername
                      html={lastUser.usernameHtml}
                      fallback={lastUser.username}
                      userId={lastUser.userId}
                      className={styles.compactLastName}
                    />
                    <LiveRelativeTime
                      className={styles.compactLastDate}
                      unix={lastDate}
                      format={formatForumDate}
                      title={formatAbsoluteDate(lastDate)}
                    />
                  </span>
                </button>

                <div className={styles.compactControls}>
                  <button
                    type="button"
                    className={`${styles.compactControl} ${
                      bookmarked ? styles.threadControlActive : ""
                    }`}
                    title={t(
                      bookmarked ? "forum.bookmarkRemove" : "forum.bookmarkAdd",
                    )}
                    onClick={() => void toggleBookmark(thread, bookmarked)}
                  >
                    <Bookmark
                      size={18}
                      fill={bookmarked ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    className={styles.compactControl}
                    title={t("forum.complaint")}
                    onClick={() =>
                      complain(thread.creator.userId, thread.creator.username)
                    }
                  >
                    <Flag size={18} />
                  </button>
                </div>
              </article>
            );
          }
          return (
            <article key={thread.threadId} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardAuthor}>
                  <button
                    type="button"
                    className={styles.threadAvatarBtn}
                    title={thread.creator.username}
                    onClick={() => {
                      if (thread.creator.userId)
                        openMini(thread.creator.userId);
                    }}
                  >
                    <Avatar
                      url={thread.creator.avatarUrl}
                      name={thread.creator.username}
                      className={styles.cardAvatar ?? ""}
                    />
                  </button>
                  <button
                    type="button"
                    className={styles.threadNickBtn}
                    onClick={() => {
                      if (thread.creator.userId)
                        openMini(thread.creator.userId);
                    }}
                  >
                    <RichUsername
                      html={thread.creator.usernameHtml}
                      fallback={thread.creator.username}
                      userId={thread.creator.userId}
                      className={styles.cardNick}
                    />
                  </button>
                  {category && (
                    <span className={styles.cardCategory}>
                      <span className={styles.cardCatIcon}>
                        {categoryIcon ? categoryIcon : <Hash size={13} />}
                      </span>
                      <span className={styles.cardCategoryText}>
                        {category}
                      </span>
                    </span>
                  )}
                  {thread.prefixes.length > 0 && (
                    <span className={styles.cardPrefixes}>
                      {thread.prefixes.map((prefix) => {
                        const bg = prefix.color;
                        const fg =
                          prefix.textColor ??
                          (bg ? labelColors(bg).text : undefined);
                        return (
                          <span
                            key={prefix.title}
                            className={
                              prefix.cssClass
                                ? `${styles.prefix} ${prefix.cssClass}`
                                : styles.prefix
                            }
                            style={
                              prefix.cssClass
                                ? undefined
                                : bg || fg
                                  ? {
                                      backgroundColor: bg ?? undefined,
                                      color: fg,
                                    }
                                  : undefined
                            }
                          >
                            {prefix.title}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
                <span className={styles.cardTime}>
                  <Clock size={13} className={styles.cardTimeIcon} />
                  <LiveRelativeTime
                    className={styles.cardDate}
                    unix={thread.createDate}
                    format={formatForumDate}
                    title={formatAbsoluteDate(thread.createDate)}
                  />
                </span>
              </div>

              <h3
                className={styles.cardTitle}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === "Enter") open();
                }}
              >
                {thread.isSticky && (
                  <Pin size={14} className={styles.threadFlag} />
                )}
                {thread.isClosed && (
                  <Lock size={14} className={styles.threadFlag} />
                )}
                <span className={styles.cardTitleText}>{thread.title}</span>
              </h3>

              {thread.contentHtml && (
                <div
                  className={styles.cardContent}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") open();
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderChatHtml(thread.contentHtml),
                  }}
                />
              )}

              <div className={styles.cardSep} />

              <div className={styles.cardActions}>
                <div className={styles.cardCounters}>
                  <button
                    type="button"
                    className={`${styles.counter} ${like.liked ? styles.counterLikeOn : ""}`}
                    title={t("forum.like")}
                    disabled={!thread.firstPostId}
                    onClick={() => void toggleLike(thread)}
                  >
                    <Heart
                      size={16}
                      fill={like.liked ? "currentColor" : "none"}
                    />
                    <span>{like.count}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.counter} ${replyOpen ? styles.counterOn : ""}`}
                    title={t("forum.commentAction")}
                    onClick={() => toggleReply(thread.threadId)}
                  >
                    <MessageSquare size={16} />
                    <span>{thread.replyCount}</span>
                  </button>
                  <span className={styles.counterMuted}>
                    <Eye size={16} />
                    <span>{thread.viewCount}</span>
                  </span>
                </div>
                <div className={styles.cardControls}>
                  <button
                    type="button"
                    className={`${styles.threadControl} ${
                      bookmarked ? styles.threadControlActive : ""
                    }`}
                    title={t(
                      bookmarked ? "forum.bookmarkRemove" : "forum.bookmarkAdd",
                    )}
                    onClick={() => void toggleBookmark(thread, bookmarked)}
                  >
                    <Bookmark
                      size={18}
                      fill={bookmarked ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    className={styles.threadControl}
                    title={t("forum.hideThread")}
                    onClick={() => void hide(thread.threadId)}
                  >
                    <EyeOff size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.threadControl}
                    title={t("forum.complaint")}
                    onClick={() =>
                      complain(thread.creator.userId, thread.creator.username)
                    }
                  >
                    <Flag size={18} />
                  </button>
                </div>
              </div>

              {replyOpen && (
                <div className={styles.cardReply}>
                  <ForumEditor
                    compact
                    value={replyText}
                    onChange={setReplyText}
                    onSubmit={() => void submitReply(thread.threadId)}
                    placeholder={t("forum.replyPlaceholder")}
                    rows={2}
                    autoFocus
                    sending={replySending}
                  />
                </div>
              )}

              {showLast && lastPost && (
                <>
                  <div className={styles.cardSep} />
                  <div
                    className={styles.lastPost}
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") open();
                    }}
                  >
                    <Avatar
                      url={lastPost.user.avatarUrl}
                      name={lastPost.user.username}
                      className={styles.lastPostAvatar ?? ""}
                    />
                    <div className={styles.lastPostMain}>
                      <div className={styles.lastPostTop}>
                        <RichUsername
                          html={lastPost.user.usernameHtml}
                          fallback={lastPost.user.username}
                          userId={lastPost.user.userId}
                          className={styles.cardNick}
                        />
                        <span className={styles.cardDot} />
                        <LiveRelativeTime
                          className={styles.lastPostDate}
                          unix={lastPost.createDate}
                          format={formatForumDate}
                          title={formatAbsoluteDate(lastPost.createDate)}
                        />
                      </div>
                      <div
                        className={styles.lastPostText}
                        dangerouslySetInnerHTML={{
                          __html: renderChatHtml(lastPost.bodyHtml),
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {isFetchingNextPage && (
        <div className={styles.loadingMore} aria-label={t("forum.loading")}>
          <span />
          <span />
          <span />
        </div>
      )}
      {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}

      <FeedSettingsModal open={feedOpen} onClose={() => setFeedOpen(false)} />
    </div>
  );
};
