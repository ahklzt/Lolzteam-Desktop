import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthStatus } from "@lzt/shared";
import { setForumWebBase } from "@lzt/shared";
import { ConnectionScreen } from "~/features/auth/ConnectionScreen";
import { LoginScreen } from "~/features/auth/LoginScreen";
import { useLocaleSync } from "~/i18n/useLocaleSync";
import { useSettingsEffects } from "~/features/settings/useSettingsEffects";
import { useSession } from "~/stores/session";
import { useSettingsStore } from "~/stores/settings";
import { useHistoryStore } from "~/stores/history";
import { MARKET_CATEGORIES } from "~/features/market/categories";
import { Shell } from "~/widgets/Shell/Shell";
import { Splash } from "~/widgets/Splash/Splash";
import { LoginProgressModal } from "~/features/market/LoginProgressModal";
import { TitleBar } from "~/widgets/TitleBar/TitleBar";
import appStyles from "./App.module.scss";

export const App = () => {
  const status = useSession((s) => s.status);
  const setStatus = useSession((s) => s.setStatus);
  const refresh = useSession((s) => s.refresh);
  const setSnapshot = useSettingsStore((s) => s.setSnapshot);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  const frameless = useSettingsStore(
    (s) => (s.snapshot?.settings.systemWindowFrame ?? false) === false,
  );

  useLocaleSync();

  useSettingsEffects();

  useEffect(() => {
    void window.moderator.app.getForumWebUrl().then(setForumWebBase);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const offStatus = window.moderator.auth.onStatusChanged((next) =>
      setStatus(next),
    );
    const offSettings = window.moderator.settings.onChanged((snap) =>
      setSnapshot(snap),
    );
    return () => {
      offStatus();
      offSettings();
    };
  }, [setStatus, setSnapshot]);

  useEffect(() => {
    void useHistoryStore.getState().loadMarkers();
    const off = useHistoryStore.getState().subscribe();
    return off;
  }, []);

  useEffect(() => {
    const off = window.moderator.auth.onTokenReceived(() => {
      void refresh();
    });
    return off;
  }, [refresh]);

  useEffect(() => {
    if (!status?.authenticated || status.offline) return;
    let cancelled = false;
    void (async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ["forum", "tree"],
          queryFn: () => window.moderator.forum.getTree(),
          staleTime: 5 * 60_000,
        }),
        queryClient.prefetchInfiniteQuery({
          queryKey: [
            "forum",
            "threadsInfinite",
            { type: "all" },
            "last_post_date",
            null,
          ],
          queryFn: ({ pageParam }) =>
            window.moderator.forum.getThreads({
              page: pageParam as number,
              order: "last_post_date",
            }),
          initialPageParam: 1,
        }),
        queryClient.prefetchQuery({
          queryKey: ["forum", "me", "profile"],
          queryFn: async () => {
            const res = await window.moderator.profile.getMe();
            return res.ok ? res.profile : null;
          },
          staleTime: 5 * 60_000,
        }),
        window.moderator.market.getCategories(),
      ]);
      if (cancelled) return;
      for (const cat of MARKET_CATEGORIES) {
        if (cat.iconUrl) {
          const img = new Image();
          img.src = cat.iconUrl;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status?.authenticated, status?.offline, queryClient]);

  const onRetry = useCallback(
    async (): Promise<AuthStatus> => refresh(),
    [refresh],
  );

  let content: ReactNode;
  if (loading && !status) {
    content = <ConnectionScreen mode="loading" onRetry={onRetry} />;
  } else if (!status?.authenticated) {
    content = <LoginScreen />;
  } else if (status.offline) {
    content = <ConnectionScreen mode="offline" onRetry={onRetry} />;
  } else {
    content = <Shell />;
  }

  return (
    <div className={appStyles.root}>
      {frameless ? <TitleBar /> : null}
      <div className={appStyles.body}>{content}</div>
      <LoginProgressModal />
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </div>
  );
};
