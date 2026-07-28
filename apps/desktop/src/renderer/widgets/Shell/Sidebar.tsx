import { useTranslation } from "react-i18next";
import { Puzzle } from "lucide-react";
import { useViewStore } from "~/stores/view";
import { usePluginTabs } from "~/stores/pluginTabs";
import { useSettingsStore } from "~/stores/settings";
import { visibleNavItems } from "./nav-items";
import styles from "./Sidebar.module.scss";

export const Sidebar = () => {
  const { t } = useTranslation();
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const pluginTabs = usePluginTabs((s) => s.tabs);
  const navOrder = useSettingsStore((s) => s.snapshot?.settings.navOrder);
  const navHidden = useSettingsStore((s) => s.snapshot?.settings.navHidden);
  const items = visibleNavItems(navOrder ?? [], navHidden ?? []);

  return (
    <nav className={styles.dock}>
      {items.map(({ id, icon: Icon, labelKey }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            className={`${styles.item} ${active ? styles.active : ""}`}
            onClick={() => setView(id)}
            title={t(labelKey)}
          >
            <Icon size={18} />
            <span className={styles.label}>{t(labelKey)}</span>
          </button>
        );
      })}

      {pluginTabs.map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`${styles.item} ${active ? styles.active : ""}`}
            onClick={() => setView(tab.id)}
            title={tab.label}
          >
            {}
            {tab.icon ? (
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
            ) : (
              <Puzzle size={18} />
            )}
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
