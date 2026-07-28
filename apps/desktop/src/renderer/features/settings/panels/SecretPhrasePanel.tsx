import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SecretAnswerType } from "@lzt/shared";
import { Dropdown } from "~/widgets/Dropdown/Dropdown";
import { pushToast } from "~/stores/toast";
import styles from "./form.module.scss";

export const SecretPhrasePanel = () => {
  const { t } = useTranslation();
  const [types, setTypes] = useState<SecretAnswerType[]>([]);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.moderator.profile.getSecretTypes();
      if (res.ok) {
        setTypes(res.info.types);
        setTypeId(res.info.types[0]?.id ?? null);
      } else
        setLoadError(
          res.reason === "no_token"
            ? t("settings.personal.form.notAuthed")
            : t("settings.personal.form.loadFailed"),
        );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (typeId === null || answer.trim() === "") return;
    setSaving(true);
    const res = await window.moderator.profile.setSecret({
      answer: answer.trim(),
      typeId,
    });
    setSaving(false);
    if (res.ok) {
      setAnswer("");
      pushToast({
        kind: "success",
        title: t("toast.savedTitle"),
        message: t("toast.secretSaved"),
      });
    } else {
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("toast.saveError"),
      });
    }
  };

  const requestReset = async () => {
    setResetting(true);
    const res = await window.moderator.profile.requestSecretReset();
    setResetting(false);
    if (res.ok)
      pushToast({
        kind: "success",
        title: t("toast.successTitle"),
        message: t("settings.secret.resetRequested"),
      });
    else
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("settings.secret.resetFailed"),
      });
  };

  const cancelReset = async () => {
    setResetting(true);
    const res = await window.moderator.profile.cancelSecretReset();
    setResetting(false);
    if (res.ok)
      pushToast({
        kind: "success",
        title: t("toast.successTitle"),
        message: t("settings.secret.resetCancelled"),
      });
    else
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("settings.secret.resetFailed"),
      });
  };

  if (loading) {
    return (
      <p className={styles.loading}>{t("settings.personal.form.loading")}</p>
    );
  }

  if (loadError) {
    return (
      <div className={styles.errorBox}>
        <span>{loadError}</span>
        <button
          type="button"
          className={styles.retryBtn}
          onClick={() => void load()}
        >
          {t("settings.personal.form.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>{t("settings.secret.intro")}</p>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.labelCol}>
            <label className={styles.label}>{t("settings.secret.type")}</label>
          </div>
          <div className={styles.controlCol}>
            <Dropdown
              value={typeId ?? 0}
              onChange={(v) => setTypeId(v)}
              options={types.map((tp) => ({ value: tp.id, label: tp.title }))}
            />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelCol}>
            <label className={styles.label}>
              {t("settings.secret.answer")}
            </label>
          </div>
          <div className={styles.controlCol}>
            <input
              className={styles.input}
              type="text"
              value={answer}
              placeholder={t("settings.secret.answerPlaceholder")}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <span className={styles.hint}>
              {t("settings.secret.answerHint")}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={saving || typeId === null || answer.trim() === ""}
          onClick={() => void save()}
        >
          {saving
            ? t("settings.personal.form.saving")
            : t("settings.personal.form.save")}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <div className={styles.labelCol}>
            <label className={styles.label}>
              {t("settings.secret.resetTitle")}
            </label>
          </div>
          <div className={styles.controlCol}>
            <span className={styles.hint}>
              {t("settings.secret.resetHint")}
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={resetting}
                onClick={() => void requestReset()}
              >
                {t("settings.secret.requestReset")}
              </button>
              <button
                type="button"
                className={styles.retryBtn}
                disabled={resetting}
                onClick={() => void cancelReset()}
              >
                {t("settings.secret.cancelReset")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
