import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Ban,
  ExternalLink,
  Menu,
  MoreVertical,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import { useChatStore } from "./chat-store";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import {
  ChatIgnoredModal,
  ChatOnlineModal,
  ChatRulesModal,
  ChatTopModal,
} from "./ChatModals";
import styles from "./chat.module.scss";

const POLL_MS = 5_000;
const ROOMS_POLL_MS = 60_000;

type ChatModalKind = "online" | "top" | "ignored" | "rules" | null;

interface ChatPanelProps {
  onClose?: () => void;
  onDragStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const ChatPanel = ({ onClose, onDragStart }: ChatPanelProps) => {
  const { t } = useTranslation();
  const rooms = useChatStore((s) => s.rooms);
  const totalOnline = useChatStore((s) => s.totalOnline);
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const errorReason = useChatStore((s) => s.errorReason);
  const errorMessage = useChatStore((s) => s.errorMessage);

  const [roomsOpen, setRoomsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ChatModalKind>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    void useChatStore.getState().bootstrap();
    const msgTimer = setInterval(
      () => void useChatStore.getState().refresh(),
      POLL_MS,
    );
    const roomsTimer = setInterval(
      () => void useChatStore.getState().loadRooms(),
      ROOMS_POLL_MS,
    );
    return () => {
      clearInterval(msgTimer);
      clearInterval(roomsTimer);
    };
  }, []);

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

  useEffect(() => {
    if (typeof activeRoomId !== "number") {
      setOnlineCount(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const res = await window.moderator.chat.getOnline(activeRoomId);
      if (!cancelled) setOnlineCount(res.ok ? res.users.length : null);
    };
    void load();
    const timer = setInterval(() => void load(), ROOMS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeRoomId]);

  const active = rooms.find((r) => r.roomId === activeRoomId);
  const errorText =
    errorReason === null
      ? null
      : errorReason === "no_token" || errorReason === "unauthorized"
        ? t("chat.needToken")
        : (errorMessage ?? t("chat.loadError"));

  const menuItem = (Icon: LucideIcon, label: string, action: () => void) => (
    <button
      type="button"
      className={styles.menuItem}
      onClick={() => {
        setMenuOpen(false);
        action();
      }}
    >
      <Icon size={17} className={styles.menuItemIcon} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className={styles.panel}>
      <div
        className={
          onDragStart
            ? `${styles.header} ${styles.draggableHeader}`
            : styles.header
        }
        onPointerDown={onDragStart}
      >
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setRoomsOpen(true)}
          aria-label={t("chat.rooms")}
        >
          <Menu size={18} />
        </button>
        <div className={styles.headTitle}>
          <div className={styles.roomHeading}>
            <span className={styles.roomTitle}>
              {active?.title ?? t("chat.title")}
            </span>
            <span className={styles.socketDot} aria-hidden="true" />
          </div>
          {active && (
            <button
              type="button"
              className={styles.online}
              onClick={() => setModal("online")}
            >
              {t("chat.online", {
                count: onlineCount ?? active.online ?? totalOnline ?? 0,
              })}
            </button>
          )}
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="…"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              {menuItem(ShieldCheck, t("chat.rules"), () => setModal("rules"))}
              {menuItem(Ban, t("chat.ignoreList"), () => setModal("ignored"))}
              {menuItem(ExternalLink, t("chat.fullVersion"), () =>
                void window.moderator.app.openExternal(
                  `${getForumWebBase()}/chatbox/`,
                ),
              )}
              {menuItem(Trophy, t("chat.top"), () => setModal("top"))}
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {errorText ? (
        <div className={styles.errorText}>{errorText}</div>
      ) : (
        <ChatMessages />
      )}
      <ChatComposer />

      {roomsOpen && (
        <>
          <div
            className={styles.sideBackdrop}
            onClick={() => setRoomsOpen(false)}
          />
          <div className={styles.sideMenu}>
            <div className={styles.sideTitle}>
              <span>{t("chat.rooms")}</span>
              {totalOnline !== null && (
                <span className={styles.sideOnline}>
                  <Users size={14} />
                  {totalOnline}
                </span>
              )}
            </div>
            {rooms.map((room) => (
              <button
                key={room.roomId}
                type="button"
                className={
                  room.roomId === activeRoomId
                    ? `${styles.roomRow} ${styles.roomRowActive}`
                    : styles.roomRow
                }
                onClick={() => {
                  void useChatStore.getState().selectRoom(room.roomId);
                  setRoomsOpen(false);
                }}
              >
                <span className={styles.roomName}>{room.title}</span>
                {room.online !== null && (
                  <span className={styles.roomOnline}>
                    <Users size={13} />
                    {t("chat.online", { count: room.online })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <ChatOnlineModal open={modal === "online"} onClose={() => setModal(null)} />
      <ChatTopModal open={modal === "top"} onClose={() => setModal(null)} />
      <ChatIgnoredModal
        open={modal === "ignored"}
        onClose={() => setModal(null)}
      />
      <ChatRulesModal open={modal === "rules"} onClose={() => setModal(null)} />
    </div>
  );
};
