import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Inbox,
  LogOut,
  Mail as MailIcon,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { type MailLetter } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { useMailTarget } from "~/stores/mailTarget";
import { ProviderSelect } from "./ProviderSelect";
import styles from "./MailPanel.module.scss";

type Filter = "all" | "unread" | "fav";

interface LocalFlags {
  read: Record<string, boolean>;
  fav: Record<string, boolean>;
  deleted: Record<string, boolean>;
}

const emptyFlags = (): LocalFlags => ({ read: {}, fav: {}, deleted: {} });

const flagsKey = (email: string) => `lzt.mail.flags.${email.toLowerCase()}`;

const loadFlags = (email: string): LocalFlags => {
  try {
    const raw = localStorage.getItem(flagsKey(email));
    if (!raw) return emptyFlags();
    const parsed = JSON.parse(raw) as Partial<LocalFlags>;
    return {
      read: parsed.read ?? {},
      fav: parsed.fav ?? {},
      deleted: parsed.deleted ?? {},
    };
  } catch {
    return emptyFlags();
  }
};

const saveFlags = (email: string, flags: LocalFlags) => {
  try {
    localStorage.setItem(flagsKey(email), JSON.stringify(flags));
  } catch {
  }
};

const buildSrcDoc = (html: string): string => {
  const css = [
    ":root{color-scheme:light}",
    "html,body{margin:0;padding:0}",
    "body{background:#ffffff;color:#1a1a1a;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;padding:16px;word-break:break-word;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
    "*{box-sizing:border-box}",
    "img,video{max-width:100%!important;height:auto}",
    "table{max-width:100%!important;border-collapse:collapse}",
    "td,th{word-break:break-word}",
    "a{color:#0a7d57}",
    "p,div,span,li,td{max-width:100%}",
    "pre,code{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
    "blockquote{margin:0 0 8px;padding-left:12px;border-left:3px solid #e2e2e2;color:#555}",
    "h1,h2,h3{line-height:1.25}",
  ].join("");
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<base target="_blank"><style>' +
    css +
    "</style></head><body>" +
    html +
    "</body></html>"
  );
};

const LetterBody = ({ letter }: { letter: MailLetter }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const fit = () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (doc) {
        const h = doc.documentElement.scrollHeight;
        frame.style.height = Math.min(6000, h + 8) + "px";
      }
    } catch {
    }
  };

  if (letter.bodyHtml) {
    return (
      <iframe
        ref={frameRef}
        className={styles.htmlBody}
        title={letter.subject || "letter"}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={buildSrcDoc(letter.bodyHtml)}
        onLoad={fit}
      />
    );
  }
  return (
    <pre className={styles.detailBody}>{letter.body || letter.preview}</pre>
  );
};

export const MailPanel = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);
  const patch = useSettingsStore((s) => s.patch);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [letters, setLetters] = useState<MailLetter[] | null>(null);
  const [activeEmail, setActiveEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<LocalFlags>(emptyFlags());
  const [filter, setFilter] = useState<Filter>("all");
  const [openUid, setOpenUid] = useState<string | null>(null);

  const history = snapshot?.settings.mailHistory ?? [];

  const errText = (code: string) =>
    t(`mail.err.${code}`, { defaultValue: t("mail.err.unknown_error") });

  const isRead = (l: MailLetter) => flags.read[l.uid] ?? l.seenOnServer;

  const updateFlags = (next: LocalFlags) => {
    setFlags(next);
    if (activeEmail) saveFlags(activeEmail, next);
  };

  const rememberEmail = async (entry: string) => {
    const next = [entry, ...history.filter((h) => h !== entry)].slice(0, 8);
    await patch({ mailHistory: next });
  };

  const removeHistory = async (entry: string) => {
    await patch({ mailHistory: history.filter((h) => h !== entry) });
  };

  const doFetch = async (targetEmail: string, targetPassword: string) => {
    setLoading(true);
    setError(null);
    const res = await window.moderator.mail.getLetters(
      targetEmail,
      targetPassword,
      provider || undefined,
      30,
    );
    setLoading(false);
    if (res.ok) {
      setLetters(res.letters);
      setActiveEmail(res.email);
      setFlags(loadFlags(res.email));
      setOpenUid(null);
      void rememberEmail(res.email);
    } else {
      setError(errText(res.message));
    }
  };

  const onEmailChange = (raw: string) => {
    const at = raw.indexOf("@");
    const colon = raw.indexOf(":");
    if (at >= 0 && colon > at) {
      setEmail(raw.slice(0, colon).trim());
      setPassword(raw.slice(colon + 1));
      return;
    }
    setEmail(raw);
  };

  const mailPending = useMailTarget((s) => s.pending);
  const clearMailPending = useMailTarget((s) => s.setPending);
  useEffect(() => {
    if (!mailPending) return;
    const raw = mailPending;
    clearMailPending(null);
    const at = raw.indexOf("@");
    const colon = raw.indexOf(":");
    let addr = raw;
    let pass = "";
    if (colon > 0 && (at < 0 || colon > at)) {
      addr = raw.slice(0, colon).trim();
      pass = raw.slice(colon + 1);
    }
    setEmail(addr);
    setPassword(pass);
    if (addr.includes("@") && pass) void doFetch(addr, pass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailPending]);

  const onLogin = () => {
    const addr = email.trim();
    if (!addr.includes("@") || password === "") {
      setError(errText("invalid_credentials"));
      return;
    }
    void doFetch(addr, password);
  };

  const onRefresh = () => {
    if (activeEmail && password) void doFetch(activeEmail, password);
  };

  const onLogout = () => {
    setLetters(null);
    setActiveEmail("");
    setPassword("");
    setError(null);
    setOpenUid(null);
    setFlags(emptyFlags());
  };

  const toggleRead = (l: MailLetter) => {
    updateFlags({ ...flags, read: { ...flags.read, [l.uid]: !isRead(l) } });
  };

  const markRead = (l: MailLetter) => {
    if (isRead(l)) return;
    updateFlags({ ...flags, read: { ...flags.read, [l.uid]: true } });
  };

  const toggleFav = (l: MailLetter) => {
    const fav = { ...flags.fav };
    if (fav[l.uid]) delete fav[l.uid];
    else fav[l.uid] = true;
    updateFlags({ ...flags, fav });
  };

  const removeLetter = (l: MailLetter) => {
    updateFlags({ ...flags, deleted: { ...flags.deleted, [l.uid]: true } });
    if (openUid === l.uid) setOpenUid(null);
  };

  const visible = useMemo(() => {
    if (!letters) return [];
    return letters.filter((l) => {
      if (flags.deleted[l.uid]) return false;
      if (filter === "unread") return !(flags.read[l.uid] ?? l.seenOnServer);
      if (filter === "fav") return !!flags.fav[l.uid];
      return true;
    });
  }, [letters, flags, filter]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : "";

  if (!letters) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}>
          <button type="button" className={styles.back} onClick={onBack}>
            <ArrowLeft size={16} />
            {t("common.back")}
          </button>
          <div>
            <h1 className={styles.title}>{t("mail.title")}</h1>
            <p className={styles.subtitle}>{t("mail.loginSubtitle")}</p>
          </div>
        </header>

        <div className={styles.loginCard}>
          <label className={styles.field}>
            <span className={styles.label}>{t("mail.email")}</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="user@example.com"
              spellCheck={false}
              autoComplete="off"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t("mail.password")}</span>
            <div className={styles.passRow}>
              <input
                className={styles.input}
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                spellCheck={false}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLogin();
                }}
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPass((v) => !v)}
                title={
                  showPass ? t("mail.hidePassword") : t("mail.showPassword")
                }
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>{t("mail.provider")}</span>
            <ProviderSelect value={provider} onChange={setProvider} />
            <span className={styles.hint}>{t("mail.providerHint")}</span>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.submit}
            onClick={onLogin}
            disabled={loading}
          >
            <MailIcon size={16} />
            {loading ? t("mail.loading") : t("mail.login")}
          </button>

          {history.length > 0 && (
            <div className={styles.quick}>
              <span className={styles.quickLabel}>{t("mail.history")}</span>
              <div className={styles.chips}>
                {history.map((entry) => (
                  <span key={entry} className={styles.chip}>
                    <button
                      type="button"
                      className={styles.chipText}
                      onClick={() => setEmail(entry)}
                    >
                      {entry}
                    </button>
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() => void removeHistory(entry)}
                      title={t("mail.removeFromHistory")}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const openLetter = openUid ? letters.find((l) => l.uid === openUid) : null;
  if (openLetter) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}>
          <button
            type="button"
            className={styles.back}
            onClick={() => setOpenUid(null)}
          >
            <ArrowLeft size={16} />
            {t("mail.backToInbox")}
          </button>
        </header>
        <article className={styles.detail}>
          <h2 className={styles.detailSubject}>
            {openLetter.subject || t("mail.noSubject")}
          </h2>
          <div className={styles.detailMeta}>
            <span className={styles.detailFrom}>{openLetter.from}</span>
            <span className={styles.detailDate}>
              {fmtDate(openLetter.date)}
            </span>
          </div>
          <div className={styles.detailActions}>
            <button
              type="button"
              className={styles.rowBtn}
              onClick={() => toggleFav(openLetter)}
            >
              <Star
                size={15}
                className={flags.fav[openLetter.uid] ? styles.starOn : ""}
              />
              {flags.fav[openLetter.uid]
                ? t("mail.unfavorite")
                : t("mail.favorite")}
            </button>
            <button
              type="button"
              className={styles.rowBtn}
              onClick={() => toggleRead(openLetter)}
            >
              {isRead(openLetter) ? t("mail.markUnread") : t("mail.markRead")}
            </button>
            <button
              type="button"
              className={styles.rowBtn}
              onClick={() => removeLetter(openLetter)}
            >
              <Trash2 size={15} />
              {t("mail.delete")}
            </button>
          </div>
          <LetterBody letter={openLetter} />
        </article>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={16} />
          {t("common.back")}
        </button>
        <div className={styles.inboxHead}>
          <div>
            <h1 className={styles.title}>{activeEmail}</h1>
            <p className={styles.subtitle}>
              {t("mail.inboxCount", { count: visible.length })}
            </p>
          </div>
          <div className={styles.headActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onRefresh}
              disabled={loading}
              title={t("mail.refresh")}
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onLogout}
              title={t("mail.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.filters}>
        {(["all", "unread", "fav"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`mail.filter.${f}`)}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <Inbox size={32} />
          <p>{t("mail.emptyList")}</p>
        </div>
      ) : (
        <ul className={styles.letters}>
          {visible.map((l) => {
            const read = isRead(l);
            return (
              <li
                key={l.uid}
                className={`${styles.letter} ${read ? "" : styles.unread}`}
              >
                <button
                  type="button"
                  className={styles.letterMain}
                  onClick={() => {
                    markRead(l);
                    setOpenUid(l.uid);
                  }}
                >
                  {!read && <span className={styles.dot} />}
                  <span className={styles.letterFrom}>{l.from}</span>
                  <span className={styles.letterSubject}>
                    {l.subject || t("mail.noSubject")}
                  </span>
                  <span className={styles.letterPreview}>{l.preview}</span>
                  <span className={styles.letterDate}>{fmtDate(l.date)}</span>
                </button>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.rowIcon}
                    onClick={() => toggleFav(l)}
                    title={
                      flags.fav[l.uid]
                        ? t("mail.unfavorite")
                        : t("mail.favorite")
                    }
                  >
                    <Star
                      size={15}
                      className={flags.fav[l.uid] ? styles.starOn : ""}
                    />
                  </button>
                  <button
                    type="button"
                    className={styles.rowIcon}
                    onClick={() => removeLetter(l)}
                    title={t("mail.delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
