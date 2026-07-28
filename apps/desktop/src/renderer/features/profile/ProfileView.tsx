import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import type { FullProfile } from "@lzt/shared";
import { useViewStore } from "~/stores/view";
import { useProfileTarget } from "~/stores/profileTarget";
import { useReportPresence } from "~/stores/presence";
import { pushToast } from "~/stores/toast";
import { ProfileCard } from "./ProfileCard";
import styles from "./ProfileView.module.scss";

type ViewState = "loading" | "ready" | "offline";

const AUTO_REFRESH_MS = 30_000;

export const ProfileView = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>("loading");
  const [me, setMe] = useState<FullProfile | null>(null);
  const [viewing, setViewing] = useState<FullProfile | null>(null);
  useReportPresence(
    viewing ? { kind: "profile", nickname: viewing.username } : null,
  );
  const profileNonce = useViewStore((s) => s.profileNonce);
  const targetQuery = useProfileTarget((s) => s.query);
  const targetNonce = useProfileTarget((s) => s.nonce);
  const lastTarget = useRef(0);
  const targetRequested = useRef(false);

  const loadStatus = useCallback(async () => {
    setState("loading");
    try {
      const status = await window.moderator.profile.getTokenStatus();
      if (!status.hasToken || !status.profile) {
        setState("offline");
        return;
      }
      setMe(status.profile);
      if (!targetRequested.current) setViewing(status.profile);
      setState("ready");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const firstNonce = useRef(true);
  useEffect(() => {
    if (firstNonce.current) {
      firstNonce.current = false;
      return;
    }
    if (targetNonce !== lastTarget.current) return;
    targetRequested.current = false;
    if (me) setViewing(me);
    else void loadStatus();
  }, [profileNonce, me, loadStatus, targetNonce]);

  useEffect(() => {
    if (targetNonce === 0 || targetNonce === lastTarget.current) return;
    lastTarget.current = targetNonce;
    targetRequested.current = true;
    const q = targetQuery;
    if (!q) return;
    void (async () => {
      const res = await window.moderator.profile.getUser(q);
      if (res.ok) {
        setViewing(res.profile);
        return;
      }
      targetRequested.current = false;
      pushToast({
        kind: "error",
        title: t("profile.userNotFound", { query: q }),
      });
    })();
  }, [targetNonce, targetQuery, t]);

  const refreshViewing = useCallback(async () => {
    setViewing((current) => {
      if (!current) return current;
      void (async () => {
        const res =
          me && current.userId === me.userId
            ? await window.moderator.profile.getMe()
            : await window.moderator.profile.getUser(String(current.userId));
        if (res.ok) {
          setViewing(res.profile);
          if (me && res.profile.userId === me.userId) setMe(res.profile);
        }
      })();
      return current;
    });
  }, [me]);

  useEffect(() => {
    if (state !== "ready") return;
    const id = window.setInterval(() => {
      void refreshViewing();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [state, refreshViewing]);

  const onLogout = async () => {
    await window.moderator.profile.clearToken();
    setMe(null);
    setViewing(null);
    setState("loading");
  };

  const openProfileById = async (userId: number) => {
    const res = await window.moderator.profile.getUser(String(userId));
    if (res.ok) {
      setViewing(res.profile);
      return;
    }
    pushToast({
      kind: "error",
      title: t("profile.userNotFound", { query: String(userId) }),
    });
  };

  if (state === "loading") {
    return (
      <div className={styles.center}>
        <Loader2 className={styles.spin} size={28} />
        <p>{t("profile.loading")}</p>
      </div>
    );
  }

  if (state === "offline") {
    return (
      <div className={styles.center}>
        <h2 className={styles.offlineTitle}>{t("profile.offline.title")}</h2>
        <p className={styles.offlineDesc}>{t("profile.offline.desc")}</p>
        <div className={styles.centerActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void loadStatus()}
          >
            <RefreshCw size={16} />
            {t("profile.offline.retry")}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => void onLogout()}
          >
            <LogOut size={16} />
            {t("profile.actions.logout")}
          </button>
        </div>
      </div>
    );
  }

  const isOwn = Boolean(me && viewing && me.userId === viewing.userId);

  return (
    <div className={styles.wrap}>
      {viewing && (
        <ProfileCard
          profile={viewing}
          isOwn={isOwn}
          onOpenProfile={(userId) => void openProfileById(userId)}
        />
      )}
    </div>
  );
};
