import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Search } from "lucide-react";
import type { GifItem } from "@lzt/shared";
import styles from "./forum.module.scss";

interface GifPickerProps {
  onPick: (url: string) => void;
  onBack: () => void;
}

export const GifPicker = ({ onPick, onBack }: GifPickerProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    const timer = setTimeout(
      () => {
        void window.moderator.forum
          .searchGif(query)
          .then((res) => {
            if (id !== reqId.current) return;
            if (res.ok) setItems(res.items);
            else setError(true);
          })
          .catch(() => {
            if (id === reqId.current) setError(true);
          })
          .finally(() => {
            if (id === reqId.current) setLoading(false);
          });
      },
      query ? 350 : 0,
    );
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className={`${styles.edPopover} ${styles.edGifPop}`}>
      <div className={styles.edPopoverHead}>
        <button
          type="button"
          className={styles.edPopoverBack}
          onClick={onBack}
          title={t("forum.editor.back")}
        >
          <ArrowLeft size={16} />
        </button>
        <span>{t("forum.editor.gif")}</span>
      </div>
      <div className={styles.edGifSearch}>
        <Search size={15} />
        <input
          autoFocus
          value={query}
          placeholder={t("forum.editor.gifSearch")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.edGifGrid}>
        {loading && (
          <div className={styles.edGifState}>{t("forum.editor.gifLoading")}</div>
        )}
        {!loading && error && (
          <div className={styles.edGifState}>{t("forum.editor.gifError")}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className={styles.edGifState}>{t("forum.editor.gifEmpty")}</div>
        )}
        {!loading &&
          !error &&
          items.map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.edGifItem}
              onClick={() => onPick(g.url)}
            >
              <img src={g.previewUrl} alt="" loading="lazy" />
            </button>
          ))}
      </div>
      <div className={styles.edGifCredit}>{t("forum.editor.gifTenor")}</div>
    </div>
  );
};
