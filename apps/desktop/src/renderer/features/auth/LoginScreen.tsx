import { AppWindow, ExternalLink, Loader2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import s from "./LoginScreen.module.scss";

type NetState =
  { kind: "checking" } | { kind: "online"; ms: number } | { kind: "offline" };

export const LoginScreen = () => {
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState("");
  const [net, setNet] = useState<NetState>({ kind: "checking" });

  const checkNetwork = useCallback(async () => {
    setNet({ kind: "checking" });
    const res = await window.moderator.app.pingApi();
    setNet(res.online ? { kind: "online", ms: res.ms } : { kind: "offline" });
  }, []);

  useEffect(() => {
    window.moderator.app.getVersion().then(setVersion);
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

  const handleLoginInApp = async () => {
    setBusy(true);
    try {
      await window.moderator.auth.openInApp();
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
        <div className={s.logo}>LZT</div>
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

        <button
          type="button"
          className={s.button}
          onClick={handleLoginInApp}
          disabled={busy || net.kind !== "online"}
        >
          <AppWindow size={16} />
          <span>Войти в окне приложения</span>
        </button>

        {busy && (
          <span className={s.hint}>
            Завершите вход в браузере — приложение продолжит автоматически
          </span>
        )}
      </div>

      {version && <span className={s.version}>v{version}</span>}
    </div>
  );
};
