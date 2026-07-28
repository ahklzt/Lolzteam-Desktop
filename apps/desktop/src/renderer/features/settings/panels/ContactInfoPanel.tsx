import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ContactInfo, ContactInfoUpdate } from "@lzt/shared";
import styles from "./form.module.scss";
import { pushToast } from "~/stores/toast";

const FIELDS: Array<keyof ContactInfo> = [
  "telegram",
  "vk",
  "discord",
  "steam",
  "github",
  "jabber",
  "matrix",
];

const buildUpdate = (a: ContactInfo, b: ContactInfo): ContactInfoUpdate => {
  const u: ContactInfoUpdate = {};
  for (const f of FIELDS) if (a[f] !== b[f]) u[f] = b[f];
  return u;
};

export const ContactInfoPanel = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ContactInfo | null>(null);
  const [draft, setDraft] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.moderator.profile.getContact();
      if (res.ok && res.info) {
        setInfo(res.info);
        setDraft(res.info);
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

  const patchDraft = (partial: Partial<ContactInfo>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));

  const update = info && draft ? buildUpdate(info, draft) : {};
  const dirty = Object.keys(update).length > 0;

  const save = async () => {
    if (!info || !draft || !dirty) return;
    setSaving(true);
    const res = await window.moderator.profile.updateContact(update);
    setSaving(false);
    if (res.ok) {
      const next = res.info ?? draft;
      setInfo(next);
      setDraft(next);
      pushToast({
        kind: "success",
        title: t("toast.savedTitle"),
        message: t("toast.contactSaved"),
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
            {FIELDS.map((f) => (
              <div className={styles.field} key={f}>
                <div className={styles.labelCol}>
                  <span className={styles.label}>
                    {t(`settings.contact.form.${f}`)}
                  </span>
                </div>
                <div className={styles.controlCol}>
                  <input
                    className={styles.input}
                    value={draft[f]}
                    placeholder={t(`settings.contact.form.${f}Placeholder`)}
                    onChange={(e) => patchDraft({ [f]: e.target.value })}
                  />
                </div>
              </div>
            ))}

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
