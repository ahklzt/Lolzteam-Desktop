import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, UserX } from "lucide-react";
import type { IgnoredUser } from "@lzt/shared";
import styles from "./list.module.scss";

export const BlacklistPanel = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<IgnoredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.moderator.profile.getIgnored();
      if (res.ok) setUsers(res.users);
      else
        setLoadError(
          res.reason === "no_token"
            ? t("settings.personal.form.notAuthed")
            : t("settings.personal.form.loadFailed"),
        );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unignore = async (userId: number) => {
    setBusyId(userId);
    await window.moderator.profile.unignore(userId);
    setBusyId(null);
    await load();
  };

  return (
    <div className={styles.panel}>
      <p className={styles.intro}>{t("settings.blacklist.intro")}</p>

      {loading && (
        <p className={styles.loading}>{t("settings.blacklist.loading")}</p>
      )}

      {!loading && loadError && (
        <div className={styles.errorBox}>
          <span>{loadError}</span>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => void load()}
          >
            {t("settings.personal.form.retry")}
          </button>
        </div>
      )}

      {!loading && !loadError && users.length === 0 && (
        <p className={styles.empty}>{t("settings.blacklist.empty")}</p>
      )}

      {!loading && users.length > 0 && (
        <ul className={styles.list}>
          {users.map((u) => (
            <li className={styles.item} key={u.userId}>
              <div className={styles.itemMain}>
                <span className={styles.name}>
                  {u.username || `ID ${u.userId}`}
                </span>
                {u.userTitle && (
                  <span className={styles.title}>{u.userTitle}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                {u.viewUrl && (
                  <button
                    type="button"
                    className={styles.openBtn}
                    title={t("settings.blacklist.open")}
                    onClick={() =>
                      void window.moderator.app.openExternal(u.viewUrl)
                    }
                  >
                    <ExternalLink size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.dangerBtn}
                  disabled={busyId === u.userId}
                  onClick={() => void unignore(u.userId)}
                >
                  <UserX size={15} />
                  {t("settings.blacklist.unignore")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
