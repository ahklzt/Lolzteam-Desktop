import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, MessageSquare, ThumbsUp, Trophy } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import type {
  ChatLeaderboardDuration,
  ChatLeaderboardEntry,
  ChatOnlineUser,
  ChatUser,
} from "@lzt/shared";
import { Modal } from "~/widgets/Modal/Modal";
import { RichUsername } from "~/features/profile/RichUsername";
import { useChatStore } from "./chat-store";
import { renderChatHtml } from "./chat-html";
import styles from "./chat.module.scss";
import { useAvatarOverride } from "~/lib/avatar";

const CHAT_RULES_THREAD_ID = 43694;

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

const DURATIONS: ChatLeaderboardDuration[] = ["day", "week", "month", "year"];

const UserAvatar = ({ user }: { user: ChatUser }) => {
  const override = useAvatarOverride();
  const src = override ?? user.avatarUrl;
  return src ? (
    <img className={styles.rowAvatar} src={src} alt="" />
  ) : (
    <div className={styles.rowAvatar}>
      {user.username.slice(0, 1).toUpperCase()}
    </div>
  );
};

const UserStats = ({ user }: { user: ChatOnlineUser }) => {
  const { t } = useTranslation();
  return (
    <span className={styles.statRow}>
      <span title={t("chat.stats.sympathies")}>
        <Heart size={12} /> {user.sympathyCount}
      </span>
      <span title={t("chat.stats.likes")}>
        <ThumbsUp size={12} /> {user.likeCount}
      </span>
      <span title={t("chat.stats.messages")}>
        <MessageSquare size={12} /> {user.messageCount}
      </span>
      <span title={t("chat.stats.trophies")}>
        <Trophy size={12} /> {user.trophyPoints}
      </span>
    </span>
  );
};

export const ChatOnlineModal = ({ open, onClose }: ModalProps) => {
  const { t } = useTranslation();
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const [users, setUsers] = useState<ChatOnlineUser[] | null>(null);

  useEffect(() => {
    if (!open || activeRoomId === null) return;
    setUsers(null);
    void window.moderator.chat.getOnline(activeRoomId).then((res) => {
      setUsers(res.ok ? res.users : []);
    });
  }, [open, activeRoomId]);

  return (
    <Modal title={t("chat.onlineTitle")} open={open} onClose={onClose}>
      {users === null ? (
        <div className={styles.modalHint}>{t("chat.loading")}</div>
      ) : (
        <div className={styles.userList}>
          {users.map((user) => (
            <div key={user.userId} className={styles.userRow}>
              <UserAvatar user={user} />
              <div className={styles.userInfo}>
                <RichUsername
                  html={user.usernameHtml}
                  fallback={user.username}
                  userId={user.userId}
                />
                <UserStats user={user} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export const ChatTopModal = ({ open, onClose }: ModalProps) => {
  const { t } = useTranslation();
  const [duration, setDuration] = useState<ChatLeaderboardDuration>("day");
  const [entries, setEntries] = useState<ChatLeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    void window.moderator.chat.getLeaderboard(duration).then((res) => {
      setEntries(res.ok ? res.entries : []);
    });
  }, [open, duration]);

  return (
    <Modal title={t("chat.top")} open={open} onClose={onClose}>
      <div className={styles.durTabs}>
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            className={
              d === duration
                ? `${styles.durTab} ${styles.durTabActive}`
                : styles.durTab
            }
            onClick={() => setDuration(d)}
          >
            {t(`chat.durations.${d}`)}
          </button>
        ))}
      </div>
      {entries === null ? (
        <div className={styles.modalHint}>{t("chat.loading")}</div>
      ) : (
        <div className={styles.userList}>
          {entries.map((entry) => (
            <div key={entry.userId} className={styles.userRow}>
              <UserAvatar user={entry} />
              <div className={styles.userInfo}>
                <RichUsername
                  html={entry.usernameHtml}
                  fallback={entry.username}
                  userId={entry.userId}
                />
                <UserStats user={entry} />
              </div>
              <span className={styles.rowCount}>
                {t("chat.messagesCount", { count: entry.count })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export const ChatIgnoredModal = ({ open, onClose }: ModalProps) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ChatUser[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsers(null);
    void window.moderator.chat.getIgnored().then((res) => {
      setUsers(res.ok ? res.users : []);
    });
  }, [open]);

  const unignore = (userId: number) => {
    void useChatStore
      .getState()
      .unignore(userId)
      .then(() => {
        setUsers((prev) =>
          prev ? prev.filter((u) => u.userId !== userId) : prev,
        );
      });
  };

  return (
    <Modal title={t("chat.ignoreList")} open={open} onClose={onClose}>
      {users === null ? (
        <div className={styles.modalHint}>{t("chat.loading")}</div>
      ) : users.length === 0 ? (
        <div className={styles.modalHint}>{t("chat.ignoredEmpty")}</div>
      ) : (
        <div className={styles.userList}>
          {users.map((user) => (
            <div key={user.userId} className={styles.userRow}>
              <UserAvatar user={user} />
              <div className={styles.userInfo}>
                <RichUsername
                  html={user.usernameHtml}
                  fallback={user.username}
                  userId={user.userId}
                />
              </div>
              <button
                type="button"
                className={styles.rowAction}
                onClick={() => unignore(user.userId)}
              >
                {t("chat.unignore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export const ChatRulesModal = ({ open, onClose }: ModalProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<
    { html: string } | { failed: true } | null
  >(null);

  useEffect(() => {
    if (!open) return;
    setState(null);
    void window.moderator.chat.getRules().then((res) => {
      setState(res.ok ? { html: renderChatHtml(res.html) } : { failed: true });
    });
  }, [open]);

  return (
    <Modal title={t("chat.rules")} open={open} onClose={onClose}>
      {state === null ? (
        <div className={styles.modalHint}>{t("chat.loading")}</div>
      ) : "html" in state ? (
        <div
          className={styles.rulesBody}
          dangerouslySetInnerHTML={{ __html: state.html }}
        />
      ) : (
        <div className={styles.modalHint}>
          <p>{t("chat.rulesFailed")}</p>
          <button
            type="button"
            className={styles.rowAction}
            onClick={() =>
              void window.moderator.app.openExternal(
                `${getForumWebBase()}/threads/${CHAT_RULES_THREAD_ID}/`,
                { forceExternal: true },
              )
            }
          >
            {t("chat.openOnForum")}
          </button>
        </div>
      )}
    </Modal>
  );
};
