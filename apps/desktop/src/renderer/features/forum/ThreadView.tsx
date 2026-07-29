
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useSettingsStore } from "~/stores/settings";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import {
  ArrowUp,
  Bookmark,
  CornerUpLeft,
  ExternalLink,
  Heart,
  Lock,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Tag,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import type { ForumPostItem } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { labelColors } from "~/lib/labelColor";
import { RichUsername } from "~/features/profile/RichUsername";
import { Dropdown } from "~/widgets/Dropdown/Dropdown";
import { useForumStore } from "./forum-store";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { applySendDelay } from "~/lib/sendDelay";
import { ForumEditor } from "./ForumEditor";
import { ImageLightbox } from "./ImageLightbox";
import {
  EditThreadModal,
  DeleteThreadModal,
  ModeratorLogModal,
} from "./ThreadManageModals";
import {
  POSTS_PAGE_SIZE,
  formatThreadDate,
  useForumBreadcrumb,
  useForumPosts,
  useForumThread,
  useForumTitleMap,
  useMyProfile,
} from "./forum-hooks";
import styles from "./forum.module.scss";
import { cacheMediaUrls, extractImageUrls } from "~/lib/media-cache";

interface ThreadViewProps {
  threadId: number;
}

type PostSort = "date" | "likes";

export const ThreadView = ({ threadId }: ThreadViewProps) => {
  const { t } = useTranslation();
  const backToList = useForumStore((s) => s.backToList);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sort, setSort] = useState<PostSort>("date");
  const [bookmarked, setBookmarked] = useState<boolean | null>(null);
  const [watched, setWatched] = useState<boolean | null>(null);
  const [openState, setOpenState] = useState<boolean | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    postId: number;
    username: string;
    usernameHtml: string | null;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const thread = useForumThread(threadId);
  const order = sort === "likes" ? "post_like_count" : undefined;
  const posts = useForumPosts(threadId, page, order);
  const forumTitles = useForumTitleMap();
  const myProfile = useMyProfile();

  const details = thread.data?.ok ? thread.data : null;
  const forumId = details?.thread.forumId ?? null;
  const breadcrumb = useForumBreadcrumb(forumId);
  const categoryName =
    forumId !== null ? (forumTitles.get(forumId) ?? null) : null;
  const isBookmarked = bookmarked ?? details?.isBookmarked ?? false;
  const isWatched = watched ?? details?.isWatched ?? false;
  const firstPostId = details?.firstPost?.postId ?? null;
  const isLiked = liked ?? details?.firstPost?.isLiked ?? false;
  const canEdit = details?.canEdit ?? false;
  const canDelete = details?.canDelete ?? false;
  const editable = details?.editable ?? null;
  const isOpen = openState ?? editable?.discussionOpen ?? true;
  const prefixes = details?.thread.prefixes ?? [];
  const tags = details?.thread.tags ?? [];
  const authorUserId = details?.thread.creator.userId ?? 0;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const toggleWatch = async () => {
    const next = !isWatched;
    const res = next
      ? await window.moderator.forum.watchThread(threadId)
      : await window.moderator.forum.unwatchThread(threadId);
    if (res.ok) {
      setWatched(next);
      pushToast({
        kind: "success",
        title: next ? t("forum.manage.watched") : t("forum.manage.unwatched"),
      });
    } else {
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
    }
  };

  const toggleLike = async () => {
    setMenuOpen(false);
    if (!firstPostId) return;
    const next = !isLiked;
    const res = next
      ? await window.moderator.forum.likePost(firstPostId)
      : await window.moderator.forum.unlikePost(firstPostId);
    if (res.ok) {
      setLiked(next);
      if (next) pushToast({ kind: "success", title: t("forum.liked") });
      await queryClient.invalidateQueries({
        queryKey: ["forum", "posts", threadId],
      });
    } else {
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
    }
  };

  const toggleBookmark = async () => {
    setMenuOpen(false);
    const next = !isBookmarked;
    const res = next
      ? await window.moderator.forum.bookmark(threadId)
      : await window.moderator.forum.unbookmark(threadId);
    if (res.ok) {
      setBookmarked(next);
      pushToast({
        kind: "success",
        title: next ? t("forum.bookmarkAdded") : t("forum.bookmarkRemoved"),
      });
    } else {
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
    }
  };

  const openOnForum = () => {
    setMenuOpen(false);
    void window.moderator.app.openExternal(
      `${getForumWebBase()}/threads/${threadId}/`,
      { forceExternal: true },
    );
  };

  const bumpThread = async () => {
    setMenuOpen(false);
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await window.moderator.forum.bumpThread(threadId);
      pushToast(
        res.ok
          ? { kind: "success", title: t("forum.manage.bumped") }
          : { kind: "error", title: res.message ?? t("forum.loadError") },
      );
    } finally {
      setBusyAction(false);
    }
  };

  const toggleOpenClose = async () => {
    setMenuOpen(false);
    if (busyAction) return;
    setBusyAction(true);
    try {
      const next = !isOpen;
      const res = await window.moderator.forum.editThread({
        threadId,
        discussionOpen: next,
      });
      if (res.ok) {
        setOpenState(next);
        pushToast({
          kind: "success",
          title: next ? t("forum.manage.opened") : t("forum.manage.closed"),
        });
        await queryClient.invalidateQueries({
          queryKey: ["forum", "thread", threadId],
        });
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setBusyAction(false);
    }
  };

  const submitReply = async () => {
    const text = reply.trim();
    if (!text || sending) return;
    const warn = useSettingsStore.getState().snapshot?.settings.warnSendMessage;
    if (warn) {
      const confirmed = await askConfirm({
        message: "Вы точно хотите отправить данное сообщение?",
      });
      if (!confirmed) return;
    }
    setSending(true);
    try {
      await applySendDelay();
      const res = await window.moderator.forum.createPost(threadId, text);
      if (res.ok) {
        setReply("");
        setReplyTarget(null);
        pushToast({ kind: "success", title: t("forum.replySent") });
        await queryClient.invalidateQueries({
          queryKey: ["forum", "posts", threadId],
        });
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleReplyToMessage = (post: ForumPostItem) => {
    setReplyTarget({
      postId: post.postId,
      username: post.user.username,
      usernameHtml: post.user.usernameHtml,
    });
    setReply(`@${post.user.username}, `);
  };

  const postList = posts.data?.ok ? posts.data.posts : [];
  const total = posts.data?.ok ? posts.data.total : null;
  const hasNext =
    total !== null
      ? page * POSTS_PAGE_SIZE < total
      : postList.length >= POSTS_PAGE_SIZE;

  const myAvatar = myProfile.data?.avatarUrl ?? null;
  const myName = myProfile.data?.username ?? "";

  useEffect(() => {
    if (!posts.data?.ok) return;
    const list = posts.data.posts;
    if (list.length === 0) return;
    const items = list.map((p) => ({
      id: p.postId,
      bodyHtml: p.bodyHtml,
      createDate: p.createDate,
      author: {
        userId: p.user.userId,
        username: p.user.username,
        usernameHtml: p.user.usernameHtml,
        avatarUrl: p.user.avatarUrl,
      },
      imageUrls: extractImageUrls(p.bodyHtml),
    }));
    const full = total !== null && list.length >= total;
    void window.moderator.history.observe({
      source: "forum",
      container: "posts",
      containerId: threadId,
      threadTitle: details?.thread.title ?? null,
      items,
      complete: full,
    });
    if (useSettingsStore.getState().snapshot?.settings.cacheMedia) {
      cacheMediaUrls(items.flatMap((i) => i.imageUrls));
    }
  }, [posts.data, total, threadId, details?.thread.title]);

  return (
    <div className={styles.threadViewWrap}>
      <nav className={styles.breadcrumb}>
        <button type="button" className={styles.crumb} onClick={backToList}>
          {t("forum.breadcrumbRoot")}
        </button>
        {breadcrumb.map((seg, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <Fragment key={seg.forumId}>
              <span className={styles.crumbSep}>/</span>
              {isLast ? (
                <span className={styles.crumbCurrent} title={seg.title}>
                  {seg.title}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.crumb}
                  onClick={backToList}
                  title={seg.title}
                >
                  {seg.title}
                </button>
              )}
            </Fragment>
          );
        })}
      </nav>

      {thread.data && !thread.data.ok && (
        <div className={styles.hint}>
          {thread.data.message ?? t("forum.loadError")}
        </div>
      )}

      {details && (
        <section className={styles.threadInfoCard}>
          <h2 className={styles.threadInfoTitle}>
            {prefixes.map((prefix) => {
              const bg = prefix.color;
              const fg =
                prefix.textColor ?? (bg ? labelColors(bg).text : undefined);
              return (
                <span
                  key={prefix.title}
                  className={
                    prefix.cssClass
                      ? `${styles.threadInfoPrefix} ${prefix.cssClass}`
                      : styles.threadInfoPrefix
                  }
                  style={
                    prefix.cssClass
                      ? undefined
                      : bg || fg
                        ? { backgroundColor: bg ?? undefined, color: fg }
                        : undefined
                  }
                >
                  {prefix.title}
                </span>
              );
            })}
            <span>{details.thread.title}</span>
          </h2>
          <div className={styles.threadInfoMeta}>
            <span>{t("forum.threadInSection")}</span>
            {categoryName && (
              <span className={styles.threadInfoLink}>{categoryName}</span>
            )}
            <span>{t("forum.createdByUser")}</span>
            <RichUsername
              html={details.thread.creator.usernameHtml}
              fallback={details.thread.creator.username}
              userId={details.thread.creator.userId}
              className={styles.threadInfoAuthor}
            />
            <span>{formatThreadDate(details.thread.createDate)}.</span>
            <span className={styles.threadInfoDot} />
            <span>
              {t("forum.viewsCount", { count: details.thread.viewCount })}
            </span>
          </div>
          {tags.length > 0 ? (
            <div className={styles.threadInfoTags}>
              {tags.map((tag) => (
                <span key={tag} className={styles.threadInfoTag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            canEdit && (
              <button
                type="button"
                className={styles.addTagsBtn}
                onClick={() => setEditOpen(true)}
              >
                <Tag size={14} /> {t("forum.addTags")}
              </button>
            )
          )}
        </section>
      )}

      {details && (
        <div className={styles.threadActionsBar}>
          <div className={styles.threadActionMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={`${styles.threadActionBtn} ${
                menuOpen ? styles.threadActionBtnActive : ""
              }`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={18} /> {t("forum.manage.settings")}
            </button>
            {menuOpen && (
              <div className={styles.threadSettingsMenu}>
                {canEdit && editable && (
                  <button
                    type="button"
                    className={styles.threadSettingsItem}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil size={15} /> {t("forum.manage.edit")}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.threadSettingsItem}
                  onClick={() => void toggleBookmark()}
                >
                  <Bookmark size={15} />{" "}
                  {isBookmarked
                    ? t("forum.bookmarkRemove")
                    : t("forum.bookmarkAdd")}
                </button>
                <button
                  type="button"
                  className={styles.threadSettingsItem}
                  onClick={() => void toggleLike()}
                  disabled={!firstPostId}
                >
                  <Heart size={15} />{" "}
                  {isLiked ? t("forum.unlike") : t("forum.like")}
                </button>
                <button
                  type="button"
                  className={styles.threadSettingsItem}
                  onClick={openOnForum}
                >
                  <ExternalLink size={15} /> {t("forum.openOnForum")}
                </button>
                <button
                  type="button"
                  className={styles.threadSettingsItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setLogOpen(true);
                  }}
                >
                  <ShieldAlert size={15} /> {t("forum.manage.moderatorActions")}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className={styles.threadSettingsItem}
                    onClick={() => void bumpThread()}
                    disabled={busyAction}
                  >
                    <ArrowUp size={15} /> {t("forum.manage.bump")}
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className={styles.threadSettingsItem}
                    onClick={() => void toggleOpenClose()}
                    disabled={busyAction}
                  >
                    {isOpen ? <Lock size={15} /> : <Unlock size={15} />}{" "}
                    {isOpen ? t("forum.manage.close") : t("forum.manage.open")}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className={`${styles.threadSettingsItem} ${styles.threadSettingsItemDanger}`}
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 size={15} /> {t("forum.manage.delete")}
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className={`${styles.threadActionBtn} ${
              isWatched ? styles.threadActionBtnActive : ""
            }`}
            onClick={() => void toggleWatch()}
          >
            <Bookmark size={18} />{" "}
            {isWatched ? t("forum.manage.unwatch") : t("forum.manage.watch")}
          </button>
        </div>
      )}

      {details && (
        <div className={styles.postsSortBar}>
          <span className={styles.postsSortLabel}>
            {t("forum.manage.sortLabel")}
          </span>
          <Dropdown<PostSort>
            size="sm"
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: "date", label: t("forum.manage.sortByDate") },
              { value: "likes", label: t("forum.manage.sortByLikes") },
            ]}
          />
        </div>
      )}

      <div className={styles.posts}>
        {posts.isLoading && (
          <div className={styles.hint}>{t("forum.loading")}</div>
        )}
        {posts.data && !posts.data.ok && (
          <div className={styles.hint}>
            {posts.data.message ?? t("forum.loadError")}
          </div>
        )}
        {posts.data?.ok && postList.length === 0 && (
          <div className={styles.hint}>{t("forum.postsEmpty")}</div>
        )}
        {postList.map((post) => (
          <PostCard
            key={post.postId}
            post={post}
            threadId={threadId}
            authorUserId={authorUserId}
            onReplyToMessage={handleReplyToMessage}
          />
        ))}
      </div>

      {(page > 1 || hasNext) && (
        <div className={styles.pager}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t("forum.prevPage")}
          </button>
          <span>{t("forum.pageLabel", { page })}</span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setPage(page + 1)}
          >
            {t("forum.nextPage")}
          </button>
        </div>
      )}

      <div className={styles.replyCard}>
        <Avatar url={myAvatar} name={myName} className={styles.replyAvatar} />
        <div className={styles.replyMain}>
          {replyTarget && (
            <div className={styles.replyTargetBar}>
              <CornerUpLeft size={13} />
              <span className={styles.replyTargetText}>
                {t("forum.replyingToPrefix")}{" "}
                <RichUsername
                  html={replyTarget.usernameHtml}
                  fallback={replyTarget.username}
                  className={styles.replyTargetNick}
                />
              </span>
              <button
                type="button"
                className={styles.replyTargetClose}
                onClick={() => {
                  setReplyTarget(null);
                  setReply("");
                }}
                title={t("common.close")}
              >
                <X size={13} />
              </button>
            </div>
          )}
          <ForumEditor
            value={reply}
            onChange={setReply}
            onSubmit={() => void submitReply()}
            placeholder={t("forum.replyPlaceholder")}
            rows={3}
            sending={sending}
          />
        </div>
      </div>

      {details && editable && (
        <EditThreadModal
          threadId={threadId}
          forumId={details.thread.forumId}
          editable={editable}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      <DeleteThreadModal
        threadId={threadId}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={backToList}
      />
      <ModeratorLogModal
        threadId={threadId}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      />

      <ImageLightbox />
    </div>
  );
};
