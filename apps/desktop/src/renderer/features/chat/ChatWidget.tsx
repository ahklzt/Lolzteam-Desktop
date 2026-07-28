import { MessageSquareText, X } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { useChatStore } from "./chat-store";
import { ChatPanel } from "./ChatPanel";
import styles from "./chat.module.scss";

export const ChatWidget = () => {
  const separateWindow = useSettingsStore(
    (s) => s.snapshot?.settings.chatSeparateWindow ?? false,
  );
  const open = useChatStore((s) => s.open);
  const toggleOpen = useChatStore((s) => s.toggleOpen);

  if (separateWindow) return null;

  return (
    <>
      {open && (
        <div className={styles.floating}>
          <ChatPanel onClose={() => useChatStore.getState().setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        className={styles.fab}
        onClick={toggleOpen}
        aria-label="Чат"
      >
        {open ? <X /> : <MessageSquareText />}
      </button>
    </>
  );
};
