import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { LZT_CONFIG, type NotificationItem } from "@lzt/shared";
import { Popover } from "./Popover";
import { useUnread } from "~/stores/unread";
import styles from "./navBar.module.scss";

const WEB = LZT_CONFIG.webUrl;

const absLink = (link: string): string => {
  if (!link) return `${WEB}/`;
  if (link.startsWith("http")) return link;
  return `${WEB}/${link.replace(/^\//, "")}`;
};

const shortDate = (unixSec: number, locale: string): string => {
  if (!unixSec) return "";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSec * 1000));
};

// Поповер «Уведомления»: бэкенд уже готов (Get Notifications / Mark Read).
export const NotificationsMenu = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Бейдж — из глобального счётчика (обновляется автоматически по таймеру).
  const unread = useUnread((s) => s.notifications);
  const setUnread = useUnread((s) => s.setNotifications);

  const openExternal = (url: string) =>
    void window.moderator.app.openExternal(url);

  const load = async () => {
    setLoading(true);
    const res = await window.moderator.profile.getNotifications();
    if (res.ok) {
      setItems(res.notifications);
      setUnread(res.unreadTotal);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const readAll = async () => {
    await window.moderator.profile.markNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isUnread: false })));
    setUnread(0);
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
          title={t("topbar.notifications.tooltip")}
          data-streamer="hideNotifications"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className={styles.badge} data-notif-badge>
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
              {t("topbar.notifications.title")}
            </span>
            {items.some((n) => n.isUnread) && (
              <button
                type="button"
                className={styles.listHeaderBtn}
                onClick={() => void readAll()}
              >
                <CheckCheck size={14} /> {t("topbar.notifications.readAll")}
              </button>
            )}
          </div>

          <div className={styles.listBody}>
            {loading && (
              <div className={styles.loaderRow}>
                <Loader2 size={16} className={styles.spin} />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className={styles.empty}>
                {t("topbar.notifications.empty")}
              </div>
            )}

            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`${styles.rowItem} ${n.isUnread ? styles.rowUnread : ""}`}
                onClick={() => {
                  openExternal(absLink(n.link));
                  close();
                }}
              >
                <span className={styles.rowMeta}>
                  <span className={styles.rowText}>{n.text}</span>
                  <span className={styles.rowDate}>
                    {shortDate(n.createdAt, i18n.language)}
                  </span>
                </span>
                {n.isUnread && <span className={styles.unreadDot} />}
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
};
