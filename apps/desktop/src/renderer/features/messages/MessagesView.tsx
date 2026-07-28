import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Bookmark,
  Loader2,
  Search as SearchIcon,
  SendHorizontal,
} from "lucide-react";
import { type ConversationItem, type ConversationMessage } from "@lzt/shared";
import { EnrichedUsername } from "~/features/profile/EnrichedUsername";
import { conversationNickProps } from "./conversation-nick";
import { useConversationsInfinite } from "./messages-hooks";
import { bbcodeToHtml } from "~/lib/bbcode";
import { useSession } from "~/stores/session";
import { useMessagesRoute } from "~/stores/messagesRoute";
import { useUnread } from "~/stores/unread";
import styles from "./MessagesView.module.scss";

const EMPTY_IMAGE =
  "https://nztcdn.com/files/9adf8a4f-ee72-4791-ac2b-f93d66d08f6b.webp";

const MESSAGES_PER_PAGE = 20;

type MsgTab = "all" | "unread" | "chats" | "market";

const isMarketConversation = (c: ConversationItem): boolean =>
  /lzt\.market|market|\bзаказ|\bсделк|\bтовар|\bлот\b|purchase|order/i.test(
    `${c.title} ${c.lastMessagePreview ?? ""}`,
  );

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

const fullTime = (unixSec: number, locale: string): string => {
  if (!unixSec) return "";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSec * 1000));
};

export const MessagesView = () => {
  const { t, i18n } = useTranslation();
  const status = useSession((s) => s.status);
  const myUserId =
    status?.authenticated && !status.offline ? status.profile.userId : null;

  const selectedId = useMessagesRoute((s) => s.selectedId);
  const routeNonce = useMessagesRoute((s) => s.nonce);
  const select = useMessagesRoute((s) => s.select);
  const setUnread = useUnread((s) => s.setMessages);

  const {
    data: convData,
    isLoading: listLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationsInfinite();
  const [tab, setTab] = useState<MsgTab>("all");
  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<number | null>(selectedId);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const conversations = useMemo<ConversationItem[]>(() => {
    const seen = new Set<number>();
    const out: ConversationItem[] = [];
    for (const pg of convData?.pages ?? []) {
      if (!pg.ok) continue;
      for (const c of pg.conversations) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    }
    return out;
  }, [convData]);

  const firstPage = convData?.pages[0];
  const listError = firstPage && !firstPage.ok ? firstPage.reason : null;
  useEffect(() => {
    if (firstPage?.ok) setUnread(firstPage.unreadTotal);
  }, [firstPage, setUnread]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: listBodyRef.current, rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (selectedId != null) setActiveId(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNonce, selectedId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const loadMessages = async (conversationId: number) => {
    const conv = conversations.find((c) => c.id === conversationId);
    const lastPage = conv
      ? Math.max(1, Math.ceil(conv.messageCount / MESSAGES_PER_PAGE))
      : 1;
    setChatLoading(true);
    setMessages([]);
    const res = await window.moderator.profile.getConversationMessages(
      conversationId,
      lastPage,
    );
    if (res.ok) {
      setMessages(res.messages);
      setPage(lastPage);
      setHasEarlier(lastPage > 1);
    } else {
      setMessages([]);
      setHasEarlier(false);
    }
    setChatLoading(false);
    requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  useEffect(() => {
    if (activeId != null) void loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeConversation?.messageCount]);

  const loadEarlier = async () => {
    if (activeId == null || page <= 1) return;
    const prev = page - 1;
    const res = await window.moderator.profile.getConversationMessages(
      activeId,
      prev,
    );
    if (res.ok) {
      setMessages((old) => [...res.messages, ...old]);
      setPage(prev);
      setHasEarlier(prev > 1);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || activeId == null || sending) return;
    setSending(true);
    const res = await window.moderator.profile.sendConversationMessage(
      activeId,
      text,
    );
    setSending(false);
    if (res.ok) {
      setDraft("");
      await loadMessages(activeId);
    }
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (tab === "unread" && !c.isUnread) return false;
      if (tab === "market" && !isMarketConversation(c)) return false;
      if (tab === "chats" && isMarketConversation(c)) return false;
      if (q) {
        const hay = `${c.title} ${c.interlocutorUsername} ${
          c.lastMessagePreview ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [conversations, tab, search]);

  const TABS: Array<{ id: MsgTab; label: string }> = [
    { id: "all", label: t("messages.tabs.all") },
    { id: "unread", label: t("messages.tabs.unread") },
    { id: "chats", label: t("messages.tabs.chats") },
    { id: "market", label: t("messages.tabs.market") },
  ];

  return (
    <div className={styles.wrap}>
      {}
      <aside className={styles.list} data-streamer="hideConversationList">
        <div className={styles.listHead}>
          <h1 className={styles.listTitle}>{t("messages.title")}</h1>
          <div className={styles.searchBox}>
            <SearchIcon size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("messages.searchPlaceholder")}
            />
          </div>
          <div className={styles.tabs}>
            {TABS.map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`${styles.tab} ${
                  tab === tb.id ? styles.tabActive : ""
                }`}
                onClick={() => setTab(tb.id)}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.listBody} ref={listBodyRef}>
          {listLoading && (
            <div className={styles.loaderRow}>
              <Loader2 size={18} className={styles.spin} />
            </div>
          )}

          {!listLoading && listError === "rate_limited" && (
            <div className={styles.listEmpty}>{t("messages.rateLimited")}</div>
          )}

          {!listLoading && !listError && filtered.length === 0 && (
            <div className={styles.listEmpty}>{t("messages.listEmpty")}</div>
          )}

          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.row} ${
                c.id === activeId ? styles.rowActive : ""
              } ${c.isUnread ? styles.rowUnread : ""}`}
              onClick={() => select(c.id)}
            >
              {c.isSaved ? (
                <span className={styles.avatarFallback}>
                  <Bookmark size={18} />
                </span>
              ) : c.interlocutorAvatarUrl ? (
                <img
                  className={styles.avatar}
                  src={c.interlocutorAvatarUrl}
                  alt=""
                />
              ) : (
                <span className={styles.avatarFallback}>
                  {c.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className={styles.rowMeta}>
                <span className={styles.rowTop}>
                  <span className={styles.rowName}>
                    <EnrichedUsername
                      {...conversationNickProps(c, myUserId)}
                    />
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

          {isFetchingNextPage && (
            <div className={styles.loaderRow}>
              <Loader2 size={18} className={styles.spin} />
            </div>
          )}
          {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} />}
        </div>
      </aside>

      {}
      <section className={styles.chat}>
        {activeConversation ? (
          <>
            <header className={styles.chatHead}>
              {activeConversation.isSaved ? (
                <span className={styles.chatAvatarFallback}>
                  <Bookmark size={18} />
                </span>
              ) : activeConversation.interlocutorAvatarUrl ? (
                <img
                  className={styles.chatAvatar}
                  src={activeConversation.interlocutorAvatarUrl}
                  alt=""
                />
              ) : (
                <span className={styles.chatAvatarFallback}>
                  {activeConversation.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className={styles.chatTitle}>
                <EnrichedUsername
                  {...conversationNickProps(activeConversation, myUserId)}
                />
              </span>
            </header>

            <div className={styles.chatBody} ref={scrollRef}>
              {chatLoading && (
                <div className={styles.loaderRow}>
                  <Loader2 size={18} className={styles.spin} />
                </div>
              )}

              {!chatLoading && hasEarlier && (
                <button
                  type="button"
                  className={styles.loadEarlier}
                  onClick={() => void loadEarlier()}
                >
                  {t("messages.loadEarlier")}
                </button>
              )}

              {!chatLoading &&
                messages.map((m) => {
                  const mine = myUserId != null && m.creatorUserId === myUserId;
                  return (
                    <div
                      key={m.id}
                      className={`${styles.msgRow} ${
                        mine ? styles.msgMine : styles.msgTheirs
                      }`}
                    >
                      {!mine &&
                        (m.creatorAvatarUrl ? (
                          <img
                            className={styles.msgAvatar}
                            src={m.creatorAvatarUrl}
                            alt=""
                          />
                        ) : (
                          <span className={styles.msgAvatarFallback}>
                            {m.creatorUsername.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                      <div className={styles.bubbleWrap}>
                        {!mine && (
                          <span className={styles.bubbleName}>
                            <EnrichedUsername
                              username={m.creatorUsername}
                              html={m.creatorUsernameHtml}
                              color={m.creatorUsernameColor}
                            />
                          </span>
                        )}
                        <div className={styles.bubble}>
                          {
}
                          <div
                            className={styles.bubbleHtml}
                            dangerouslySetInnerHTML={{
                              __html: bbcodeToHtml(m.body, {
                                lang: i18n.language,
                              }),
                            }}
                          />
                        </div>
                        <span className={styles.bubbleTime}>
                          {fullTime(m.createDate, i18n.language)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {}
            <div className={styles.composer}>
              <textarea
                className={styles.composerInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                placeholder={t("messages.composerPlaceholder")}
                rows={1}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                title={t("messages.send")}
              >
                {sending ? (
                  <Loader2 size={18} className={styles.spin} />
                ) : (
                  <SendHorizontal size={18} />
                )}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <img className={styles.emptyImg} src={EMPTY_IMAGE} alt="" />
            <p className={styles.emptyText}>{t("messages.empty")}</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default MessagesView;
