import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  PrivacyAudience,
  PrivacySettings,
  PrivacySettingsUpdate,
} from "@lzt/shared";
import { Toggle } from "~/widgets/Toggle/Toggle";
import styles from "./form.module.scss";
import { pushToast } from "~/stores/toast";

const AUDIENCE_FIELDS: Array<keyof PrivacySettings> = [
  "allowViewProfile",
  "allowPostProfile",
  "allowSendPersonalConversation",
  "allowReceiveNewsFeed",
];

const buildUpdate = (
  a: PrivacySettings,
  b: PrivacySettings,
): PrivacySettingsUpdate => {
  const u: PrivacySettingsUpdate = {};
  for (const f of AUDIENCE_FIELDS)
    if (a[f] !== b[f]) u[f] = b[f] as PrivacyAudience;
  if (a.showDobDate !== b.showDobDate) u.showDobDate = b.showDobDate;
  if (a.showDobYear !== b.showDobYear) u.showDobYear = b.showDobYear;
  return u;
};

export const PrivacyPanel = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<PrivacySettings | null>(null);
  const [draft, setDraft] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.moderator.profile.getPrivacy();
      if (res.ok && res.privacy) {
        setInfo(res.privacy);
        setDraft(res.privacy);
      } else {
        setLoadError(
          res.reason === "no_token"
            ? t("settings.personal.form.notAuthed")
            : t("settings.personal.form.loadFailed"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchDraft = (partial: Partial<PrivacySettings>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));

  const update = info && draft ? buildUpdate(info, draft) : {};
  const dirty = Object.keys(update).length > 0;

  const save = async () => {
    if (!info || !draft || !dirty) return;
    setSaving(true);
    const res = await window.moderator.profile.updatePrivacy(update);
    setSaving(false);
    if (res.ok) {
      const next = res.privacy ?? draft;
      setInfo(next);
      setDraft(next);
      pushToast({
        kind: "success",
        title: t("toast.savedTitle"),
        message: t("toast.privacySaved"),
      });
    } else {
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("toast.saveError"),
      });
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        {loading && (
          <p className={styles.loading}>
            {t("settings.personal.form.loading")}
          </p>
        )}
        {!loading && loadError && (
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
        )}

        {!loading && draft && (
          <>
            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.privacy.form.dobVisibility")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <Toggle
                  checked={draft.showDobDate}
                  onChange={(v) => patchDraft({ showDobDate: v })}
                  label={t("settings.privacy.form.showDobDate")}
                />
                <Toggle
                  checked={draft.showDobYear}
                  onChange={(v) => patchDraft({ showDobYear: v })}
                  label={t("settings.privacy.form.showDobYear")}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!dirty || saving}
                onClick={() => void save()}
              >
                {saving
                  ? t("settings.personal.form.saving")
                  : t("settings.personal.form.save")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
