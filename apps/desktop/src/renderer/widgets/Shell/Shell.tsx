import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useViewStore } from "~/stores/view";
import { startUnreadPolling } from "~/stores/unread";
import { useDiscordPresenceSync, usePresenceStore } from "~/stores/presence";
import { useStreamerSync } from "~/lib/streamer-mask";
import { openLztLink } from "~/lib/lztLinks";
import { PlaceholderView } from "~/features/placeholder/PlaceholderView";
import { ProfileView } from "~/features/profile/ProfileView";
import { RequireToken } from "~/features/profile/RequireToken";
import { MarketView } from "~/features/market/MarketView";
import { ForumView } from "~/features/forum/ForumView";
import { MessagesView } from "~/features/messages/MessagesView";
import { SettingsView } from "~/features/settings/SettingsView";
import { ToolsView } from "~/features/tools/ToolsView";
import { FaqView } from "~/features/faq/FaqView";
import { AdsView } from "~/features/faq/AdsView";
import { ChatWidget } from "~/features/chat/ChatWidget";
import { PluginTabHost } from "~/features/plugins/PluginTabHost";
import { usePluginHost } from "~/features/plugins/usePluginHost";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { WelcomeToast } from "./WelcomeToast";
import { Toaster } from "./Toaster";
import { ConfirmDialog } from "~/widgets/ConfirmDialog/ConfirmDialog";
import styles from "./Shell.module.scss";
import { usePrefixCss } from "~/features/forum/usePrefixCss";

export const Shell = () => {
  const { t } = useTranslation();
  const view = useViewStore((s) => s.view);

  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view]);

  usePrefixCss();

  useDiscordPresenceSync();

  useStreamerSync();

  useEffect(() => {
    const set = usePresenceStore.getState().set;
    if (view === "tools") set({ kind: "tools" });
    else if (view === "messages") set({ kind: "messages" });
    else if (view === "faq") set({ kind: "faq" });
    else if (view === "ads") set({ kind: "ads" });
    else if (view === "settings") set({ kind: "settings" });
    else if (view.startsWith("plugin:")) set({ kind: "plugin" });
  }, [view]);


  useEffect(() => startUnreadPolling(), []);

  useEffect(
    () => window.moderator.app.onOpenLztLink(({ url }) => openLztLink(url)),
    [],
  );

  return (
    <div className={styles.shell}>
      {}
      <WelcomeToast />
      <Toaster />
      <ConfirmDialog />
      <TopBar />
      <main className={styles.content} ref={contentRef}>
        {view === "settings" && (
          <RequireToken>
            <SettingsView />
          </RequireToken>
        )}
        {view === "market" && (
          <RequireToken>
            <MarketView />
          </RequireToken>
        )}
        {view === "forum" && (
          <RequireToken>
            <ForumView />
          </RequireToken>
        )}
        {view === "messages" && (
          <RequireToken>
            <MessagesView />
          </RequireToken>
        )}
        {view === "tools" && <ToolsView />}
        {view === "profile" && <ProfileView />}
        {view === "faq" && <FaqView />}
        {view === "ads" && <AdsView />}
        {view.startsWith("plugin:") && <PluginTabHost />}
      </main>
      <ChatWidget />
      <Sidebar />
    </div>
  );
};
