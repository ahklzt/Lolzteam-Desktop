import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProfilePreferences, ProfilePreferencesUpdate } from "@lzt/shared";
import { Toggle } from "~/widgets/Toggle/Toggle";
import styles from "./form.module.scss";
import { pushToast } from "~/stores/toast";

const buildUpdate = (
  a: ProfilePreferences,
  b: ProfilePreferences,
): ProfilePreferencesUpdate => {
  const u: ProfilePreferencesUpdate = {};
  if (a.convWelcomeMessage !== b.convWelcomeMessage)
    u.convWelcomeMessage = b.convWelcomeMessage;
  if (a.receiveAdminEmail !== b.receiveAdminEmail)
    u.receiveAdminEmail = b.receiveAdminEmail;
  if (a.activityVisible !== b.activityVisible)
    u.activityVisible = b.activityVisible;
  if (a.hideUsernameChangeLogs !== b.hideUsernameChangeLogs)
    u.hideUsernameChangeLogs = b.hideUsernameChangeLogs;
  return u;
};

export const PreferencesPanel = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ProfilePreferences | null>(null);
  const [draft, setDraft] = useState<ProfilePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.moderator.profile.getPreferences();
      if (res.ok && res.preferences) {
        setInfo(res.preferences);
        setDraft(res.preferences);
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

  const patchDraft = (partial: Partial<ProfilePreferences>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));

  const update = info && draft ? buildUpdate(info, draft) : {};
  const dirty = Object.keys(update).length > 0;

  const save = async () => {
    if (!info || !draft || !dirty) return;
    setSaving(true);
    const res = await window.moderator.profile.updatePreferences(update);
    setSaving(false);
    if (res.ok) {
      const next = res.preferences ?? draft;
      setInfo(next);
      setDraft(next);
      pushToast({
        kind: "success",
        title: t("toast.savedTitle"),
        message: t("toast.preferencesSaved"),
      });
    } else {
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("toast.saveError"),
      });
    }
  };

  const CHECKS: Array<keyof ProfilePreferences> = [
    "receiveAdminEmail",
    "activityVisible",
    "hideUsernameChangeLogs",
  ];

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
                  {t("settings.preferences.form.convWelcome")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <textarea
                  className={styles.textarea}
                  value={draft.convWelcomeMessage}
                  placeholder={t(
                    "settings.preferences.form.convWelcomePlaceholder",
                  )}
                  onChange={(e) =>
                    patchDraft({ convWelcomeMessage: e.target.value })
                  }
                />
                <p className={styles.hint}>
                  {t("settings.preferences.form.convWelcomeHint")}
                </p>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.preferences.form.options")}
                </span>
              </div>
              <div className={styles.controlCol}>
                {CHECKS.map((key) => (
                  <Toggle
                    key={key}
                    checked={Boolean(draft[key])}
                    onChange={(v) => patchDraft({ [key]: v })}
                    label={t(`settings.preferences.form.${key}`)}
                  />
                ))}
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
