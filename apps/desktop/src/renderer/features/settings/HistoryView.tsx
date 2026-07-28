import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { HistoryEntry, HistoryKind } from "@lzt/shared";
import { useHistoryStore } from "~/stores/history";
import { renderChatHtml } from "~/features/chat/chat-html";
import { loadCachedMedia } from "~/lib/media-cache";
import { pushToast } from "~/stores/toast";
import styles from "./HistoryView.module.scss";

interface HistoryViewProps {
  onBack: () => void;
}

type TabId = "deletedMessages" | "deletedThreads" | "edits";

const TABS: { id: TabId; label: string; kinds: HistoryKind[] }[] = [
  {
    id: "deletedMessages",
    label: "Удалённые сообщения",
    kinds: ["deletedPost", "deletedChatMessage"],
  },
  { id: "deletedThreads", label: "Удалённые темы", kinds: ["deletedThread"] },
  { id: "edits", label: "Правки", kinds: ["editedPost", "editedChatMessage"] },
];

const fmtDate = (ms: number): string =>
  ms > 0 ? new Date(ms).toLocaleString("ru-RU") : "—";

const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
};

const CachedMedia = ({ id }: { id: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCachedMedia(id).then((res) => {
      if (alive && res) setSrc(res.dataUrl);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (!src) return null;
  return <img className={styles.media} src={src} alt="" />;
};

const HistoryCard = ({
  entry,
  onDelete,
}: {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
}) => {
  const [showRevisions, setShowRevisions] = useState(false);
  const isEdit =
    entry.kind === "editedPost" || entry.kind === "editedChatMessage";
  const isThread = entry.kind === "deletedThread";

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardMeta}>
          <span className={styles.author}>
            {entry.author.username ?? "Неизвестно"}
          </span>
          {entry.threadTitle && (
            <span className={styles.threadTitle}>{entry.threadTitle}</span>
          )}
          <span className={styles.date}>{fmtDate(entry.recordedAt)}</span>
        </div>
        <div className={styles.cardActions}>
          {entry.url && (
            <a
              className={styles.linkBtn}
              href={entry.url}
              target="_blank"
              rel="noreferrer"
            >
              На форуме
            </a>
          )}
          <button
            type="button"
            className={styles.iconBtnDanger}
            title="Удалить из истории"
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {!isThread && (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: renderChatHtml(entry.bodyHtml) }}
        />
      )}

      {entry.mediaIds.length > 0 && (
        <div className={styles.mediaRow}>
          {entry.mediaIds.map((id) => (
            <CachedMedia key={id} id={id} />
          ))}
        </div>
      )}

      {isEdit && entry.revisions.length > 1 && (
        <div className={styles.revisions}>
          <button
            type="button"
            className={styles.revToggle}
            onClick={() => setShowRevisions((v) => !v)}
          >
            <Pencil size={13} />
            {showRevisions
              ? "Скрыть версии"
              : `Версии (${entry.revisions.length})`}
          </button>
          {showRevisions && (
            <div className={styles.revList}>
              {entry.revisions.map((rev, i) => (
                <div key={i} className={styles.revItem}>
                  <span className={styles.revDate}>{fmtDate(rev.at)}</span>
                  <div
                    className={styles.revBody}
                    dangerouslySetInnerHTML={{
                      __html: renderChatHtml(rev.bodyHtml),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const HistoryView = ({ onBack }: HistoryViewProps) => {
  const query = useHistoryStore((s) => s.query);
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const clear = useHistoryStore((s) => s.clear);
  const usage = useHistoryStore((s) => s.usage);
  const purge = useHistoryStore((s) => s.purge);
  const markers = useHistoryStore((s) => s.markers);

  const [tab, setTab] = useState<TabId>("deletedMessages");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [usageBytes, setUsageBytes] = useState<number | null>(null);

  const activeKinds = useMemo(
    () => TABS.find((t) => t.id === tab)?.kinds ?? [],
    [tab],
  );

  const reload = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await query({
          kinds: activeKinds,
          search: search.trim() || undefined,
          limit: 200,
        });
        setEntries(res.entries);
        setTotal(res.total);
      } finally {
        setLoading(false);
      }
    },
    [query, activeKinds, search],
  );

  useEffect(() => {
    void reload();
  }, [reload, markers]);

  useEffect(() => {
    void usage().then((u) => setUsageBytes(u.totalBytes));
  }, [usage, entries.length]);

  const onDelete = async (id: string) => {
    await deleteEntry(id);
    await reload();
  };

  const onClearTab = async () => {
    if (!window.confirm("Очистить все записи этой вкладки?")) return;
    await clear(activeKinds);
    await reload();
    pushToast({ kind: "success", title: "История очищена" });
  };

  const onPurge = async () => {
    const removed = await purge();
    await reload();
    await usage().then((u) => setUsageBytes(u.totalBytes));
    pushToast({
      kind: "success",
      title: `Кэш очищен${removed > 0 ? `, удалено ${removed}` : ""}`,
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headText}>
          <h2 className={styles.title}>История удаления и правок</h2>
          <span className={styles.subtitle}>
            Локальное хранилище
            {usageBytes != null ? ` · ${fmtBytes(usageBytes)}` : ""}
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Поиск по тексту, нику или теме…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={styles.ghostBtn}
          title="Обновить"
          onClick={() => void reload()}
        >
          <RefreshCw size={15} />
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onClearTab}>
          Очистить
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onPurge}>
          Очистить кэш
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>Загрузка…</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>Пока ничего не сохранено.</p>
      ) : (
        <>
          <span className={styles.count}>Всего: {total}</span>
          <div className={styles.list}>
            {entries.map((e) => (
              <HistoryCard key={e.id} entry={e} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
