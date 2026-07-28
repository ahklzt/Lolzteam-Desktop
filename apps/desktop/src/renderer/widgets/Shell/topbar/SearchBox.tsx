import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { LZT_CONFIG, type ForumSearchUser } from "@lzt/shared";
import { RichUsername } from "~/features/profile/RichUsername";
import { useViewStore } from "~/stores/view";
import { useProfileTarget } from "~/stores/profileTarget";
import styles from "./navBar.module.scss";
import { useAvatarOverride } from "~/lib/avatar";

const WEB = LZT_CONFIG.webUrl;

export const SearchBox = () => {
  const avatarOverride = useAvatarOverride();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ForumSearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const setView = useViewStore((s) => s.setView);
  const openProfile = useProfileTarget((s) => s.openProfile);

  const openExternal = (url: string) => void window.moderator.app.openExternal(url);

  const goProfile = (userId: number) => {
    openProfile(userId);
    setView("profile");
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await window.moderator.profile.searchUsers(q);
      if (cancelled) return;
      setUsers(res.ok ? res.users : []);
      setLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const runFullSearch = () => {
    const q = query.trim();
    if (!q) return;
    openExternal(`${WEB}/search/?q=${encodeURIComponent(q)}`);
    setOpen(false);
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div className={styles.popover} ref={rootRef}>
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          value={query}
          placeholder={t("topbar.search.placeholder")}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runFullSearch();
          }}
        />
      </div>

      {showPanel && (
        <div className={`${styles.panel} ${styles.panelRight} ${styles.searchPanel}`}>
          {loading && (
            <div className={styles.loaderRow}>
              <Loader2 size={16} className={styles.spin} />
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className={styles.empty}>{t("topbar.search.empty")}</div>
          )}

          {users.map((u) => (
            <button
              key={u.userId}
              type="button"
              className={styles.searchItem}
              onClick={() => goProfile(u.userId)}
            >
              {(avatarOverride ?? u.avatarUrl) ? (
                <img className={styles.searchAvatar} src={avatarOverride ?? u.avatarUrl} alt="" />
              ) : (
                <span className={styles.searchAvatarFallback}>
                  {u.username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className={styles.searchMeta}>
                <span className={styles.searchName}>
                  <RichUsername
                    html={u.usernameHtml}
                    fallback={u.username}
                    color={u.usernameColor}
                  />
                </span>
                {u.userTitle && (
                  <span className={styles.searchTitle}>{u.userTitle}</span>
                )}
              </span>
            </button>
          ))}

          <div className={styles.searchFooter}>
            <button type="button" className={styles.searchBtn} onClick={runFullSearch}>
              <Search size={16} />
              {t("topbar.search.button")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
