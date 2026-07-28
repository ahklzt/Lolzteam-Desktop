import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import {
  NAV_ALWAYS_VISIBLE,
  NAV_ITEMS,
  orderedNavIds,
} from "~/widgets/Shell/nav-items";
import styles from "./settingControls.module.scss";

export const NavMenuEditor = () => {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);

  const ids = orderedNavIds(settings?.navOrder ?? []);
  const hidden = new Set(settings?.navHidden ?? []);

  const move = (id: string, dir: -1 | 1) => {
    const idx = ids.indexOf(id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const moved = next[idx];
    if (moved === undefined) return;
    next.splice(idx, 1);
    next.splice(to, 0, moved);
    void patch({ navOrder: next });
  };

  const toggleHidden = (id: string) => {
    const cur = new Set(hidden);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    void patch({ navHidden: [...cur] });
  };

  return (
    <div className={styles.navList}>
      {ids.map((id, i) => {
        const item = NAV_ITEMS.find((n) => n.id === id);
        if (!item) return null;
        const Icon = item.icon;
        const locked = item.id === NAV_ALWAYS_VISIBLE;
        const isHidden = hidden.has(id);
        return (
          <div key={id} className={styles.navRow}>
            <span className={styles.navRowLabel}>
              <Icon size={16} />
              {t(item.labelKey)}
            </span>
            <div className={styles.navRowBtns}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => move(id, -1)}
                disabled={i === 0}
                aria-label="Выше"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => move(id, 1)}
                disabled={i === ids.length - 1}
                aria-label="Ниже"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => toggleHidden(id)}
                disabled={locked}
                title={locked ? "«Настройки» нельзя скрыть" : undefined}
                aria-label={isHidden ? "Показать" : "Скрыть"}
              >
                {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
