import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Loader2, Bookmark } from "lucide-react";
import { type ConversationItem } from "@lzt/shared";
import { Popover } from "./Popover";
import { EnrichedUsername } from "~/features/profile/EnrichedUsername";
import { conversationNickProps } from "~/features/messages/conversation-nick";
import { useViewStore } from "~/stores/view";
import { useMessagesRoute } from "~/stores/messagesRoute";
import { useUnread } from "~/stores/unread";
import styles from "./navBar.module.scss";

const shortDate = (unixSec: number, locale: string): string => {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const sameDay = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    hour: sameDay ? "2-digit" : undefined,
    minute: sameDay ? "2-digit" : undefined,
    day: sameDay ? undefined : "2-digit",
    month: sameDay ? undefined : "short",
  }).format(d);
};

export const MessagesMenu = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const setView = useViewStore((s) => s.setView);
  const selectConversation = useMessagesRoute((s) => s.select);
  const unread = useUnread((s) => s.messages);
  const setUnread = useUnread((s) => s.setMessages);

  const load = async () => {
    setLoading(true);
    const res = await window.moderator.profile.getConversations();
    if (res.ok) {
      setItems(res.conversations);
      setUnread(res.unreadTotal);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const openMessagesPage = (conversationId: number | null) => {
    selectConversation(conversationId);
    setView("messages");
  };

  return (
    <Popover
      align="right"
      panelClassName={styles.listPanel}
      onOpen={load}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          className={`${styles.iconBtn} ${open ? styles.iconBtnActive : ""}`}
          onClick={toggle}
          title={t("topbar.messages.tooltip")}
        >
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className={styles.badge} data-streamer="hideMessageBadge">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className={styles.listHeader}>
            <span className={styles.listHeaderTitle}>
              {t("topbar.messages.title")}
            </span>
            <button
              type="button"
              className={styles.listHeaderBtn}
              onClick={() => {
                openMessagesPage(null);
                close();
              }}
            >
              {t("topbar.messages.showAll")}
            </button>
          </div>

          <div className={styles.listBody}>
            {loading && (
              <div className={styles.loaderRow}>
                <Loader2 size={16} className={styles.spin} />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className={styles.empty}>{t("topbar.messages.empty")}</div>
            )}

            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.rowItem} ${c.isUnread ? styles.rowUnread : ""}`}
                onClick={() => {
                  openMessagesPage(c.id);
                  close();
                }}
              >
                {c.isSaved ? (
                  <span className={styles.rowAvatarFallback}>
                    <Bookmark size={16} />
                  </span>
                ) : c.interlocutorAvatarUrl ? (
                  <img className={styles.rowAvatar} src={c.interlocutorAvatarUrl} alt="" />
                ) : (
                  <span className={styles.rowAvatarFallback}>
                    {c.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className={styles.rowMeta}>
                  <span className={styles.rowTop}>
                    <span className={styles.rowName}>
                      <EnrichedUsername {...conversationNickProps(c)} />
                    </span>
                    <span className={styles.rowDate}>
                      {shortDate(c.updateDate, i18n.language)}
                    </span>
                  </span>
                  {c.lastMessagePreview && (
                    <span className={styles.rowText}>{c.lastMessagePreview}</span>
                  )}
                </span>
                {c.isUnread && <span className={styles.unreadDot} />}
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
};
