import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import type { ChatMessage } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { RichUsername } from "~/features/profile/RichUsername";
import { useChatStore } from "./chat-store";
import { chatHtmlToText, renderChatHtml } from "./chat-html";
import styles from "./chat.module.scss";
import { useAvatarOverride } from "~/lib/avatar";
import { useHistoryStore } from "~/stores/history";
import { useSettingsStore } from "~/stores/settings";
import { cacheMediaUrls, extractImageUrls } from "~/lib/media-cache";

const GROUP_GAP_S = 300;

interface MessageGroup {
  key: number;
  user: ChatMessage["user"];
  items: ChatMessage[];
}

interface CtxMenuState {
  x: number;
  y: number;
  msg: ChatMessage;
}

export const ChatMessages = () => {
  const avatarOverride = useAvatarOverride();
  const { t, i18n } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const hasMore = useChatStore((s) => s.hasMore);
  const myUserId = useChatStore((s) => s.myUserId);
  const ignoredIds = useChatStore((s) => s.ignoredIds);
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const editedMarkers = useHistoryStore((s) => s.markers.edited);

  const [ctx, setCtx] = useState<CtxMenuState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const visible = useMemo(
    () =>
      messages.filter(
        (m) => !m.isDeleted && !ignoredIds.includes(m.user.userId),
      ),
    [messages, ignoredIds],
  );

  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  useEffect(() => {
    if (activeRoomId === null) return;
    const live = messages.filter((m) => !m.isDeleted);
    if (live.length === 0) return;
    const items = live.map((m) => ({
      id: m.messageId,
      bodyHtml: m.html,
      createDate: m.date,
      author: {
        userId: m.user.userId,
        username: m.user.username,
        usernameHtml: m.user.usernameHtml,
        avatarUrl: m.user.avatarUrl,
      },
      imageUrls: extractImageUrls(m.html),
    }));
    void window.moderator.history.observe({
      source: "chat",
      container: "messages",
      containerId: activeRoomId,
      items,
      complete: !hasMore,
    });
    if (useSettingsStore.getState().snapshot?.settings.cacheMedia) {
      cacheMediaUrls(items.flatMap((i) => i.imageUrls));
    }
  }, [messages, activeRoomId, hasMore]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctx]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const fmtTime = (unix: number) =>
    new Date(unix * 1000).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const blocks = useMemo(() => {
    const fmtDay = (unix: number) =>
      new Date(unix * 1000).toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    const out: Array<{ day?: string; group?: MessageGroup }> = [];
    let lastDay = "";
    let group: MessageGroup | null = null;
    for (const m of visible) {
      const day = fmtDay(m.date);
      if (day !== lastDay) {
        lastDay = day;
        group = null;
        out.push({ day });
      }
      const prev = group ? group.items[group.items.length - 1] : undefined;
      if (
        group &&
        prev &&
        group.user.userId === m.user.userId &&
        m.date - prev.date < GROUP_GAP_S
      ) {
        group.items.push(m);
      } else {
        group = { key: m.messageId, user: m.user, items: [m] };
        out.push({ group });
      }
    }
    return out;
  }, [visible, i18n.language]);

  const copyText = (msg: ChatMessage) => {
    const text = msg.raw || chatHtmlToText(msg.html);
    void navigator.clipboard.writeText(text).then(() => {
      pushToast({ kind: "success", title: t("chat.copied") });
    });
  };

  const ctxItem = (label: string, action: () => void, danger = false) => (
    <button
      type="button"
      className={danger ? `${styles.ctxItem} ${styles.ctxDanger}` : styles.ctxItem}
      onClick={() => {
        action();
        setCtx(null);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.messages} ref={listRef} onScroll={onScroll}>
      {hasMore && visible.length > 0 && (
        <button
          type="button"
          className={styles.loadOlder}
          disabled={loading}
          onClick={() => void useChatStore.getState().loadOlder()}
        >
          {t("chat.loadOlder")}
        </button>
      )}
      {visible.length === 0 && !loading && (
        <div className={styles.emptyText}>{t("chat.empty")}</div>
      )}

      {blocks.map((block, i) =>
        block.day ? (
          <div key={`day-${i}`} className={styles.daySep}>
            {block.day}
          </div>
        ) : block.group ? (
          <div key={block.group.key} className={styles.group}>
            {(avatarOverride ?? block.group.user.avatarUrl) ? (
              <img
                className={styles.avatar}
                src={avatarOverride ?? block.group.user.avatarUrl}
                alt=""
              />
            ) : (
              <div className={styles.avatar}>
                {block.group.user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className={styles.groupBody}>
              <div className={styles.msgHeader}>
                <RichUsername
                  html={block.group.user.usernameHtml}
                  fallback={block.group.user.username}
                  userId={block.group.user.userId}
                  className={styles.nick}
                />
              </div>
              {block.group.items.map((m) => (
                <div
                  key={m.messageId}
                  className={styles.msg}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtx({ x: e.clientX, y: e.clientY, msg: m });
                  }}
                >
                  {m.reply && (
                    <div className={styles.replyBlock}>
                      <RichUsername
                        html={m.reply.usernameHtml}
                        fallback={m.reply.username ?? ""}
                        className={styles.replyLabel}
                      />
                      <span className={styles.replyText}>{m.reply.text}</span>
                    </div>
                  )}
                  <div
                    className={styles.msgText}
                    dangerouslySetInnerHTML={{ __html: renderChatHtml(m.html) }}
                  />
                  <span
                    className={styles.time}
                    title={new Date(m.date * 1000).toLocaleString(i18n.language)}
                  >
                    {fmtTime(m.date)}
                    {editedMarkers[`m${m.messageId}`] ? (
                      <span
                        className={styles.editedMark}
                        title={t("forum.editedMark")}
                      >
                        <Pencil size={11} />
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}

      {ctx && (
        <div
          className={styles.ctxMenu}
          style={{ left: ctx.x, top: ctx.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ctxItem(t("chat.reply"), () => {
            const store = useChatStore.getState();
            store.setReply(ctx.msg);
            store.insertDraft(`@${ctx.msg.user.username}, `);
          })}
          {ctxItem(t("chat.mention"), () =>
            useChatStore.getState().insertDraft(`@${ctx.msg.user.username}, `),
          )}
          {ctxItem(t("chat.copyText"), () => copyText(ctx.msg))}
          {myUserId !== null && myUserId !== ctx.msg.user.userId &&
            ctxItem(t("chat.ignore"), () =>
              void useChatStore.getState().ignore(ctx.msg.user.userId),
            )}
          {myUserId !== null && myUserId === ctx.msg.user.userId && (
            <>
              {ctxItem(t("chat.edit"), () =>
                useChatStore.getState().setEditing(ctx.msg),
              )}
              {ctxItem(
                t("chat.delete"),
                () => void useChatStore.getState().remove(ctx.msg.messageId),
                true,
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
