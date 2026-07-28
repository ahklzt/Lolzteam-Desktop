import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import type { SettingsNavSection, SettingsTab } from "./SettingsView";
import styles from "./SettingsSidebar.module.scss";

interface SettingsSidebarProps {
  sections: SettingsNavSection[];
  active: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
}

export const SettingsSidebar = ({
  sections,
  active,
  onSelect,
}: SettingsSidebarProps) => {
  const { t } = useTranslation();

  const openAntipublic = () =>
    void window.moderator.app.openExternal(
      getForumWebBase() + "/account/antipublic",
    );

  return (
    <nav className={styles.nav} aria-label={t("settings.heading")}>
      {sections.map((section) => (
        <div key={section.id} className={styles.section}>
          <span className={styles.sectionTitle}>{t(section.labelKey)}</span>
          {section.items.map(({ id, icon: Icon, labelKey }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.item} ${isActive ? styles.active : ""}`}
                onClick={() => onSelect(id)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.itemIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.itemLabel}>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      ))}

      {}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          {t("settings.antipublic.title")}
        </span>
        <button
          type="button"
          className={styles.antipublicBtn}
          onClick={openAntipublic}
        >
          <ShieldAlert size={18} />
          <span>{t("settings.antipublic.trial")}</span>
        </button>
      </div>
    </nav>
  );
};
