import { ExternalLink, Loader2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { APP_ICON_DATA_URLS } from "@lzt/shared";
import { CURRENT_VERSION } from "~/data/changelog";
import { APP_ICON_DATA_URL } from "~/lib/appIcon";
import { useSettingsStore } from "~/stores/settings";
import { ChangelogModal } from "~/widgets/Changelog/ChangelogModal";
import s from "./LoginScreen.module.scss";

type NetState =
  { kind: "checking" } | { kind: "online"; ms: number } | { kind: "offline" };

export const LoginScreen = () => {
  const [busy, setBusy] = useState(false);
  const [net, setNet] = useState<NetState>({ kind: "checking" });
  const [changelogOpen, setChangelogOpen] = useState(false);
  const appIconId = useSettingsStore(
    (st) => st.snapshot?.settings.appIconId ?? 1,
  );
  const appIcon = APP_ICON_DATA_URLS[appIconId - 1] ?? APP_ICON_DATA_URL;

  const checkNetwork = useCallback(async () => {
    setNet({ kind: "checking" });
    const res = await window.moderator.app.pingApi();
    setNet(res.online ? { kind: "online", ms: res.ms } : { kind: "offline" });
  }, []);

  useEffect(() => {
    void checkNetwork();
  }, [checkNetwork]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await window.moderator.auth.openBrowser();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.container}>
      <div
        className={`${s.net} ${
          net.kind === "online"
            ? s.online
            : net.kind === "offline"
              ? s.offline
              : s.checking
        }`}
      >
        {net.kind === "checking" && (
          <>
            <Loader2 size={14} className={s.spin} />
            <span>Проверяем связь…</span>
          </>
        )}
        {net.kind === "online" && (
          <>
            <Wifi size={14} />
            <span>API доступен ({net.ms} мс)</span>
          </>
        )}
        {net.kind === "offline" && (
          <>
            <WifiOff size={14} />
            <span>Нет связи с API</span>
            <button type="button" className={s.retry} onClick={checkNetwork}>
              Повторить
            </button>
          </>
        )}
      </div>

      <div className={s.block}>
        <img
          className={s.logo}
          src={appIcon}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div className={s.text}>
          <span className={s.title}>Lolzteam Desktop</span>
          <span className={s.lede}>
            Войдите через аккаунт LZT, чтобы продолжить
          </span>
        </div>

        <button
          type="button"
          className={s.button}
          onClick={handleLogin}
          disabled={busy || net.kind !== "online"}
        >
          <ExternalLink size={16} />
          <span>{busy ? "Открываем браузер…" : "Войти через сайт LZT"}</span>
        </button>

        {busy && (
          <span className={s.hint}>
            Завершите вход в браузере — приложение продолжит автоматически
          </span>
        )}
      </div>

      <button
        type="button"
        className={s.version}
        onClick={() => setChangelogOpen(true)}
        title="Что нового"
      >
        v{CURRENT_VERSION}
      </button>

      <ChangelogModal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />
    </div>
  );
};
