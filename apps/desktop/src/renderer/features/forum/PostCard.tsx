import { filterBanwordsHtml } from "~/lib/streamer-mask";
import { useStreamerStore } from "~/stores/streamer";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  CornerUpLeft,
  Copy,
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share2,
  Star,
} from "lucide-react";
import { getForumWebBase, profileSiteLinks } from "@lzt/shared";
import type { ForumPostItem } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { useForumMiniProfile } from "~/stores/forumMiniProfile";
import { RichUsername } from "~/features/profile/RichUsername";
import { renderChatHtml, chatHtmlToText } from "~/features/chat/chat-html";
import { handleBbInteraction } from "./bb-interactions";
import { Avatar } from "./Avatar";
import { formatThreadDate, usePostComments } from "./forum-hooks";
import { ForumEditor } from "./ForumEditor";
import styles from "./forum.module.scss";
import { useSettingsStore } from "~/stores/settings";
import { useHistoryStore } from "~/stores/history";

const COMMENTS_STEP = 3;

interface PostCardProps {
  post: ForumPostItem;
  threadId: number;
  authorUserId: number;
  onReplyToMessage: (post: ForumPostItem) => void;
}

export const PostCard = ({
  post,
  threadId,
  authorUserId,
  onReplyToMessage,
}: PostCardProps) => {
  const streamerSettings = useStreamerStore((s) => s.settings);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const openMini = useForumMiniProfile((s) => s.open);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [busyLike, setBusyLike] = useState(false);
  const hideCommentButton = useSettingsStore(
    (s) => s.snapshot?.settings.hideCommentButton ?? false,
  );
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSending, setEditSending] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const commentsQuery = usePostComments(post.postId);
  const wasEdited = useHistoryStore((s) => s.hasEdited("post", post.postId));
  const comments = commentsQuery.data?.ok ? commentsQuery.data.comments : [];
  const [visibleComments, setVisibleComments] = useState(COMMENTS_STEP);
  const hiddenCount = Math.max(0, comments.length - visibleComments);
  const shownComments =
    hiddenCount > 0 ? comments.slice(hiddenCount) : comments;
  const hiddenAvatars = comments.slice(0, hiddenCount).slice(0, 4);

  const isLiked = liked ?? post.isLiked ?? false;
  const isThreadAuthor = authorUserId > 0 && post.user.userId === authorUserId;

  const handleReport = () => {
    setMenuOpen(false);
    if (!post.user.userId) return;
    window.open(
      profileSiteLinks.complaint(post.user.userId, post.user.username),
      "_blank",
    );
  };

  const handleFavorite = async () => {
    setMenuOpen(false);
    const res = await window.moderator.forum.bookmark(threadId);
    pushToast(
      res.ok
        ? { kind: "success", title: t("forum.bookmarkAdded") }
        : { kind: "error", title: res.message ?? t("forum.loadError") },
    );
  };

  const handleShare = () => {
    setMenuOpen(false);
    const url = `${getForumWebBase()}/posts/${post.postId}/`;
    void navigator.clipboard.writeText(url).then(() => {
      pushToast({ kind: "success", title: t("forum.linkCopied") });
    });
  };

  const handleCopyBbcode = () => {
    setMenuOpen(false);
    const bb = `[QUOTE="${post.user.username}, post: ${post.postId}, member: ${
      post.user.userId ?? 0
    }"]\n${chatHtmlToText(post.bodyHtml)}\n[/QUOTE]`;
    void navigator.clipboard.writeText(bb).then(() => {
      pushToast({ kind: "success", title: t("forum.bbcodeCopied") });
    });
  };

  const toggleLike = async () => {
    if (busyLike) return;
    setBusyLike(true);
    try {
      const next = !isLiked;
      const res = next
        ? await window.moderator.forum.likePost(post.postId)
        : await window.moderator.forum.unlikePost(post.postId);
      if (res.ok) {
        setLiked(next);
        setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
        if (next) pushToast({ kind: "success", title: t("forum.liked") });
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setBusyLike(false);
    }
  };

  const openEdit = async () => {
    setMenuOpen(false);
    if (editLoading) return;
    setEditLoading(true);
    try {
      const res = await window.moderator.forum.getPostBody(post.postId);
      if (res.ok) {
        setEditBody(res.body);
        setEditOpen(true);
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setEditLoading(false);
    }
  };

  const submitEdit = async () => {
    const body = editBody.trim();
    if (!body || editSending) return;
    setEditSending(true);
    try {
      const res = await window.moderator.forum.editPost(post.postId, body);
      if (res.ok) {
        setEditOpen(false);
        pushToast({
          kind: "success",
          title: t("forum.manage.editMessageSaved"),
        });
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
      setEditSending(false);
    }
  };

  const submitComment = async () => {
    const text = comment.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await window.moderator.forum.commentPost(post.postId, text);
      if (res.ok) {
        setComment("");
        setCommentOpen(false);
        pushToast({ kind: "success", title: t("forum.commentSent") });
        await queryClient.invalidateQueries({
          queryKey: ["forum", "comments", post.postId],
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

  const replyToComment = (target: {
    user: { userId: number | null; username: string };
  }) => {
    const nick = target.user.username;
    const mention = target.user.userId
      ? `[USER=${target.user.userId}]${nick}[/USER], `
      : `${nick}, `;
    setComment((current) =>
      current.includes(mention) ? current : `${mention}${current}`,
    );
    setCommentOpen(true);
  };

  return (
    <article className={styles.post}>
      <button
        type="button"
        className={styles.postAvatarBtn}
        title={post.user.username}
        onClick={() => {
          if (post.user.userId) openMini(post.user.userId);
        }}
      >
        <Avatar
          url={post.user.avatarUrl}
          name={post.user.username}
          className={styles.postAvatar ?? ""}
        />
      </button>

      <div className={styles.postMain}>
        <div className={styles.postTop}>
          <div className={styles.postIdentity}>
            <button
              type="button"
              className={styles.postNickBtn}
              onClick={() => {
                if (post.user.userId) openMini(post.user.userId);
              }}
            >
              <RichUsername
                html={post.user.usernameHtml}
                fallback={post.user.username}
                userId={post.user.userId}
                className={styles.postNick}
              />
            </button>
            {"isOnline" in post.user && post.user.isOnline === true ? (
              <span className={styles.onlineDot} title="online" />
            ) : null}
            {isThreadAuthor && (
              <span className={styles.authorBadge}>{t("forum.author")}</span>
            )}
          </div>

          <div className={styles.postMoreWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.postMoreBtn}
              onClick={() => setMenuOpen((v) => !v)}
              title={t("forum.postMenu")}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className={styles.postMenu}>
                {post.canEdit && (
                  <button
                    type="button"
                    className={styles.postMenuItem}
                    onClick={() => void openEdit()}
                    disabled={editLoading}
                  >
                    <Pencil size={15} /> {t("forum.manage.editMessage")}
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.postMenuItem} ${styles.postMenuItemDanger}`}
                  onClick={handleReport}
                >
                  <Flag size={15} /> {t("forum.complaint")}
                </button>
                <button
                  type="button"
                  className={styles.postMenuItem}
                  onClick={() => void handleFavorite()}
                >
                  <Star size={15} /> {t("forum.favorite")}
                </button>
                <button
                  type="button"
                  className={styles.postMenuItem}
                  onClick={handleShare}
                >
                  <Share2 size={15} /> {t("forum.share")}
                </button>
                <button
                  type="button"
                  className={styles.postMenuItem}
                  onClick={handleCopyBbcode}
                >
                  <Copy size={15} /> {t("forum.copyBbcode")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className={styles.postBody}
          onClick={handleBbInteraction}
          dangerouslySetInnerHTML={{
            __html: filterBanwordsHtml(
              renderChatHtml(post.bodyHtml),
              streamerSettings,
            ),
          }}
        />

        {editOpen && (
          <div className={styles.postEditForm}>
            <div className={styles.postEditTitle}>
              {t("forum.manage.editMessageTitle")}
            </div>
            <ForumEditor
              value={editBody}
              onChange={setEditBody}
              onSubmit={() => void submitEdit()}
              placeholder={t("forum.manage.editMessagePlaceholder")}
              rows={4}
              autoFocus
              sending={editSending}
            />
            <div className={styles.postEditActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditOpen(false)}
                disabled={editSending}
              >
                {t("forum.manage.deleteNo")}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void submitEdit()}
                disabled={editSending || editBody.trim().length === 0}
              >
                {t("forum.manage.editMessageSave")}
              </button>
            </div>
          </div>
        )}

        <div className={styles.postFooter}>
          <span className={styles.postDate}>
            {formatThreadDate(post.createDate)}
            {wasEdited ? (
              <span
                className={styles.editedMark}
                title={t("forum.editedMark")}
              >
                <Pencil size={12} />
              </span>
            ) : null}
          </span>
          <div className={styles.postFooterActions}>
            <button
              type="button"
              className={`${styles.postFooterBtn} ${
                isLiked ? styles.postFooterBtnLiked : ""
              }`}
              onClick={() => void toggleLike()}
              disabled={busyLike}
              title={isLiked ? t("forum.unlike") : t("forum.likePost")}
            >
              <Heart size={15} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            {post.canEdit && (
              <button
                type="button"
                className={styles.postFooterBtn}
                onClick={() => void openEdit()}
                disabled={editLoading}
                title={t("forum.manage.editMessage")}
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              type="button"
              className={styles.postFooterBtn}
              onClick={() => onReplyToMessage(post)}
              title={t("forum.replyToMessage")}
            >
              <CornerUpLeft size={15} />
            </button>
            {!hideCommentButton && (
              <button
                type="button"
                className={`${styles.postFooterBtn} ${
                  commentOpen ? styles.postFooterBtnLiked : ""
                }`}
                onClick={() => setCommentOpen((v) => !v)}
                title={t("forum.commentAction")}
              >
                <MessageSquare size={15} />
              </button>
            )}
          </div>
        </div>

        {comments.length > 0 && (
          <div className={styles.comments}>
            {hiddenCount > 0 && (
              <button
                type="button"
                className={styles.commentsMore}
                onClick={() => setVisibleComments((v) => v + COMMENTS_STEP)}
              >
                <span className={styles.commentsMoreAvatars}>
                  {hiddenAvatars.map((c) => (
                    <Avatar
                      key={c.commentId}
                      url={c.user.avatarUrl}
                      name={c.user.username}
                      className={styles.commentsMoreAvatar ?? ""}
                    />
                  ))}
                </span>
                <span className={styles.commentsMoreText}>
                  {t("forum.commentsMore", { count: hiddenCount })}
                </span>
                <ChevronDown size={14} />
              </button>
            )}
            {shownComments.map((c) => {
              const commentAuthor =
                authorUserId > 0 && c.user.userId === authorUserId;
              return (
                <div key={c.commentId} className={styles.comment}>
                  <button
                    type="button"
                    className={styles.postAvatarBtn}
                    title={c.user.username}
                    onClick={() => {
                      if (c.user.userId) openMini(c.user.userId);
                    }}
                  >
                    <Avatar
                      url={c.user.avatarUrl}
                      name={c.user.username}
                      className={styles.commentAvatar ?? ""}
                    />
                  </button>
                  <div className={styles.commentBody}>
                    <div className={styles.commentTop}>
                      <RichUsername
                        html={c.user.usernameHtml}
                        fallback={c.user.username}
                        userId={c.user.userId}
                        className={styles.commentNick}
                      />
                      {"isOnline" in c.user && c.user.isOnline === true ? (
                        <span className={styles.onlineDot} title="online" />
                      ) : null}
                      {commentAuthor && (
                        <span className={styles.authorBadge}>
                          {t("forum.author")}
                        </span>
                      )}
                      <span className={styles.commentDate}>
                        {formatThreadDate(c.createDate)}
                      </span>
                    </div>
                    <div
                      className={styles.commentText}
                      onClick={handleBbInteraction}
                      dangerouslySetInnerHTML={{
                        __html: filterBanwordsHtml(
                          renderChatHtml(c.bodyHtml),
                          streamerSettings,
                        ),
                      }}
                    />
                    <button
                      type="button"
                      className={styles.commentReplyBtn}
                      onClick={() => replyToComment(c)}
                    >
                      {t("forum.commentReply")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {commentOpen && (
          <div className={styles.commentForm}>
            <ForumEditor
              compact
              value={comment}
              onChange={setComment}
              onSubmit={() => void submitComment()}
              placeholder={t("forum.commentPlaceholder")}
              rows={2}
              autoFocus
              sending={sending}
            />
          </div>
        )}
      </div>
    </article>
  );
};
