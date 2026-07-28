
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { pushToast } from "~/stores/toast";
import { Modal } from "~/widgets/Modal/Modal";
import { useFeedOptions } from "./forum-hooks";
import styles from "./forum.module.scss";

interface FeedSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const FeedSettingsModal = ({ open, onClose }: FeedSettingsModalProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useFeedOptions(open);
  const options = data?.ok ? data.options : null;

  const [excluded, setExcluded] = useState<number[]>([]);
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (options) {
      setExcluded(options.excludedForumIds);
      setKeywords(options.keywords.join("\n"));
    }
  }, [options]);

  const toggle = (forumId: number) => {
    setExcluded((prev) =>
      prev.includes(forumId)
        ? prev.filter((id) => id !== forumId)
        : [...prev, forumId],
    );
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const words = keywords
        .split(/[\n,]/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      const res = await window.moderator.forum.setFeedOptions(excluded, words);
      if (res.ok) {
        pushToast({ kind: "success", title: t("forum.feedSaved") });
        await queryClient.invalidateQueries({ queryKey: ["forum", "threads"] });
        await queryClient.invalidateQueries({
          queryKey: ["forum", "feedOptions"],
        });
        onClose();
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("forum.feedSettings")}>
      <div className={styles.feedModal}>
        <div className={styles.feedSection}>
          <div className={styles.feedLabel}>{t("forum.feedExcludeForums")}</div>
          {isLoading && <div className={styles.hint}>{t("forum.loading")}</div>}
          {data && !data.ok && (
            <div className={styles.hint}>
              {data.message ?? t("forum.loadError")}
            </div>
          )}
          {options && options.forums.length === 0 && (
            <div className={styles.hint}>{t("forum.feedNoForums")}</div>
          )}
          {options && options.forums.length > 0 && (
            <div className={styles.feedForums}>
              {options.forums.map((forum) => (
                <label key={forum.forumId} className={styles.feedForumRow}>
                  <input
                    type="checkbox"
                    checked={excluded.includes(forum.forumId)}
                    onChange={() => toggle(forum.forumId)}
                  />
                  <span>{forum.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={styles.feedSection}>
          <div className={styles.feedLabel}>{t("forum.feedKeywords")}</div>
          <textarea
            className={styles.feedKeywords}
            rows={4}
            value={keywords}
            placeholder={t("forum.feedKeywordsPlaceholder")}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </div>

        <div className={styles.feedActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={saving}
            onClick={() => void save()}
          >
            {t("forum.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
};
