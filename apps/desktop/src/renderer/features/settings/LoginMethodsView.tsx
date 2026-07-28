import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { LOGIN_METHODS, type LoginMethod } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import styles from "./SubView.module.scss";

interface LoginMethodsViewProps {
  onBack: () => void;
}

export const LoginMethodsView = ({ onBack }: LoginMethodsViewProps) => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);
  const patch = useSettingsStore((s) => s.patch);
  const current = snapshot?.settings.preferredLoginMethod ?? "ask";

  const select = (method: LoginMethod) => {
    if (method !== current) void patch({ preferredLoginMethod: method });
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headText}>
          <h2 className={styles.title}>{t("settings.loginMethods.title")}</h2>
          <p className={styles.subtitle}>{t("settings.loginMethods.subtitle")}</p>
        </div>
      </header>

      <div className={styles.card}>
        {LOGIN_METHODS.map((method) => {
          const active = current === method;
          return (
            <button
              key={method}
              type="button"
              className={`${styles.option} ${active ? styles.optionActive : ""}`}
              onClick={() => select(method)}
            >
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>
                  {t(`settings.loginMethods.methods.${method}.label`)}
                </span>
                <span className={styles.optionHint}>
                  {t(`settings.loginMethods.methods.${method}.hint`)}
                </span>
              </span>
              {active && <Check size={18} className={styles.checkIcon} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
