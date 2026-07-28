import { useEffect } from "react";
import { setForumWebBase } from "@lzt/shared";
import { useLocaleSync } from "~/i18n/useLocaleSync";
import { useSettingsStore } from "~/stores/settings";
import { ChatPanel } from "./ChatPanel";
import { ConfirmDialog } from "~/widgets/ConfirmDialog/ConfirmDialog";
import styles from "./chat.module.scss";

export const ChatWindowApp = () => {
  useLocaleSync();
  const setSnapshot = useSettingsStore((s) => s.setSnapshot);

  useEffect(() => {
    void window.moderator.app.getForumWebUrl().then(setForumWebBase);
    return window.moderator.settings.onChanged(setSnapshot);
  }, [setSnapshot]);

  return (
    <div className={styles.windowRoot}>
      <ChatPanel />
      <ConfirmDialog />
    </div>
  );
};
