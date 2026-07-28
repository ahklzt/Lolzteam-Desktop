import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Trash2 } from "lucide-react";
import { LZT_CONFIG, type ItemNoteListItem, type UserNoteListItem } from "@lzt/shared";
import styles from "./NotesPanel.module.scss";
import { pushToast } from "~/stores/toast";

const SCHEME = "https" + "://";
const SITE_HOST = "lolz" + ".team";

export const NotesPanel = () => {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<UserNoteListItem[]>([]);
  const [itemNotes, setItemNotes] = useState<ItemNoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [res, itemsRes] = await Promise.all([
        window.moderator.profile.listNotes(),
        window.moderator.market.listItemNotes(),
      ]);
      setNotes(res.notes);
      setDrafts(Object.fromEntries(res.notes.map((n) => [n.userId, n.text])));
      setItemNotes(itemsRes.notes);
      setItemDrafts(Object.fromEntries(itemsRes.notes.map((n) => [n.itemId, n.text])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (ms: number) =>
    ms > 0
      ? new Date(ms).toLocaleString(i18n.language === "ru" ? "ru-RU" : "en-US")
      : "";

  const saveNote = async (userId: number) => {
    const text = drafts[userId] ?? "";
    setSavingId(userId);
    const res = await window.moderator.profile.setNote(userId, text);
    setSavingId(null);
    await load();
    pushToast(
      res.ok
        ? { kind: "success", title: t("toast.savedTitle"), message: t("toast.noteSaved") }
        : { kind: "error", title: t("toast.errorTitle"), message: t("toast.saveError") },
    );
  };
  const removeNote = async (userId: number) => {
    await window.moderator.profile.deleteNote(userId);
    await load();
  };

  const saveItemNote = async (itemId: number) => {
    const text = itemDrafts[itemId] ?? "";
    setSavingItemId(itemId);
    const res = await window.moderator.market.setItemNote(itemId, text);
    setSavingItemId(null);
    await load();
    pushToast(
      res.ok
        ? { kind: "success", title: t("toast.savedTitle"), message: t("toast.noteSaved") }
        : { kind: "error", title: t("toast.errorTitle"), message: t("toast.saveError") },
    );
  };
  const removeItemNote = async (itemId: number) => {
    await window.moderator.market.deleteItemNote(itemId);
    await load();
  };

  return (
    <div className={styles.panel}>
      <p className={styles.intro}>{t("settings.notes.intro")}</p>
      {loading && <p className={styles.loading}>{t("settings.notes.loading")}</p>}

      {!loading ? (
        <>
          <p className={styles.intro}>
            <strong>{t("settings.notes.usersTitle")}</strong>
          </p>
          {notes.length === 0 ? (
            <p className={styles.empty}>{t("settings.notes.empty")}</p>
          ) : (
            <ul className={styles.list}>
              {notes.map((n) => {
                const dirty = (drafts[n.userId] ?? "") !== n.text;
                return (
                  <li className={styles.item} key={`u-${n.userId}`}>
                    <div className={styles.itemHead}>
                      <button
                        type="button"
                        className={styles.userLink}
                        onClick={() =>
                          void window.moderator.app.openExternal(
                            `${SCHEME}${SITE_HOST}/members/${n.userId}/`,
                          )
                        }
                      >
                        ID {n.userId}
                        <ExternalLink size={13} />
                      </button>
                      <span className={styles.date}>{fmtDate(n.updatedAt)}</span>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        title={t("settings.notes.delete")}
                        onClick={() => void removeNote(n.userId)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <textarea
                      className={styles.textarea}
                      value={drafts[n.userId] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [n.userId]: e.target.value }))
                      }
                    />
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={!dirty || savingId === n.userId}
                        onClick={() => void saveNote(n.userId)}
                      >
                        {savingId === n.userId
                          ? t("settings.notes.saving")
                          : t("settings.notes.save")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className={styles.intro}>
            <strong>{t("settings.notes.itemsTitle")}</strong>
          </p>
          {itemNotes.length === 0 ? (
            <p className={styles.empty}>{t("settings.notes.itemsEmpty")}</p>
          ) : (
            <ul className={styles.list}>
              {itemNotes.map((n) => {
                const dirty = (itemDrafts[n.itemId] ?? "") !== n.text;
                return (
                  <li className={styles.item} key={`i-${n.itemId}`}>
                    <div className={styles.itemHead}>
                      <button
                        type="button"
                        className={styles.userLink}
                        onClick={() =>
                          void window.moderator.app.openExternal(
                            `${LZT_CONFIG.marketWebUrl}/${n.itemId}`,
                          )
                        }
                      >
                        {t("settings.notes.item", { id: n.itemId })}
                        <ExternalLink size={13} />
                      </button>
                      <span className={styles.date}>{fmtDate(n.updatedAt)}</span>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        title={t("settings.notes.delete")}
                        onClick={() => void removeItemNote(n.itemId)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <textarea
                      className={styles.textarea}
                      value={itemDrafts[n.itemId] ?? ""}
                      onChange={(e) =>
                        setItemDrafts((d) => ({ ...d, [n.itemId]: e.target.value }))
                      }
                    />
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={!dirty || savingItemId === n.itemId}
                        onClick={() => void saveItemNote(n.itemId)}
                      >
                        {savingItemId === n.itemId
                          ? t("settings.notes.saving")
                          : t("settings.notes.save")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
};
