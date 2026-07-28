import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EMOJI_GROUPS, getEmojiByCode } from "~/data/emoji";
import type { ForumEmoji } from "~/data/emoji";
import styles from "./chat.module.scss";

const RECENT_KEY = "lzt.chat.recentEmojis";
const RECENT_MAX = 21;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
};

interface EmojiPickerProps {
  onPick: (code: string) => void;
}

export const EmojiPicker = ({ onPick }: EmojiPickerProps) => {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<string[]>(readRecent);

  const recentEmojis = useMemo(
    () =>
      recent
        .map((code) => getEmojiByCode(code))
        .filter((e): e is ForumEmoji => e !== null),
    [recent],
  );

  const pick = (emoji: ForumEmoji) => {
    onPick(`:${emoji.code}:`);
    const next = [
      emoji.code,
      ...recent.filter((c) => c !== emoji.code),
    ].slice(0, RECENT_MAX);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
    }
  };

  const renderGrid = (emojis: ForumEmoji[]) => (
    <div className={styles.pickerGrid}>
      {emojis.map((emoji) => (
        <button
          key={emoji.code}
          type="button"
          className={styles.emojiBtn}
          title={emoji.title}
          onClick={() => pick(emoji)}
        >
          <img src={emoji.url} alt={`:${emoji.code}:`} loading="lazy" />
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.picker}>
      {recentEmojis.length > 0 && (
        <div className={styles.pickerGroup}>
          <div className={styles.pickerTitle}>{t("chat.recentEmojis")}</div>
          {renderGrid(recentEmojis)}
        </div>
      )}
      {EMOJI_GROUPS.map((group) => (
        <div key={group.title} className={styles.pickerGroup}>
          <div className={styles.pickerTitle}>{group.title}</div>
          {renderGrid(group.emojis)}
        </div>
      ))}
    </div>
  );
};
