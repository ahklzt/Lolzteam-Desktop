import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, Smile, X } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { applySendDelay } from "~/lib/sendDelay";
import { useChatStore } from "./chat-store";
import { EmojiPicker } from "./EmojiPicker";
import styles from "./chat.module.scss";

export const ChatComposer = () => {
  const { t } = useTranslation();
  const draft = useChatStore((s) => s.draft);
  const reply = useChatStore((s) => s.reply);
  const editing = useChatStore((s) => s.editing);
  const activeRoomId = useChatStore((s) => s.activeRoomId);

  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showPicker = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setPickerOpen(true);
  };
  const hidePickerSoon = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPickerOpen(false), 250);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending || activeRoomId === null) return;
    const warn =
      useSettingsStore.getState().snapshot?.settings.warnSendChatMessage;
    if (warn) {
      const confirmed = await askConfirm({
        message: "Вы точно хотите отправить данное сообщение в чат?",
      });
      if (!confirmed) return;
    }
    setSending(true);
    await applySendDelay();
    const ok = await useChatStore.getState().send(text);
    setSending(false);
    if (ok) inputRef.current?.focus();
  };

  const cancelMode = () => {
    const state = useChatStore.getState();
    if (state.editing) state.setEditing(null);
    else if (state.reply) state.setReply(null);
  };

  return (
    <div className={styles.footer}>
      {editing && (
        <div className={styles.modeBar}>
          <span>{t("chat.editingTitle")}</span>
          <button
            type="button"
            className={styles.chipClose}
            onClick={cancelMode}
            aria-label={t("common.close")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {reply && !editing && (
        <div className={styles.modeBar}>
          <span>
            {t("chat.replyTo")}: @{reply.user.username}
          </span>
          <button
            type="button"
            className={styles.chipClose}
            onClick={cancelMode}
            aria-label={t("common.close")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className={styles.inputRow}>
        <div
          className={styles.smileyWrap}
          onMouseEnter={showPicker}
          onMouseLeave={hidePickerSoon}
        >
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Emoji"
          >
            <Smile size={18} />
          </button>
          {pickerOpen && (
            <EmojiPicker
              onPick={(code) => {
                useChatStore.getState().insertDraft(code);
                inputRef.current?.focus();
              }}
            />
          )}
        </div>
        <textarea
          ref={inputRef}
          className={styles.textarea}
          rows={1}
          placeholder={t("chat.placeholder")}
          value={draft}
          onChange={(e) => useChatStore.getState().setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") cancelMode();
          }}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={() => void submit()}
          disabled={sending || !draft.trim()}
          aria-label={t("chat.send")}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
