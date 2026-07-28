import { APP_ICON_DATA_URLS, DEFAULT_SETTINGS } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { Toggle } from "~/widgets/Toggle";
import { NavMenuEditor } from "./NavMenuEditor";
import styles from "./settingControls.module.scss";

const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "system", label: "Системный" },
  {
    value: '"Open Sans", "Segoe UI", Inter, system-ui, sans-serif',
    label: "Open Sans",
  },
  { value: 'Georgia, "Times New Roman", serif', label: "С засечками" },
  {
    value: "'JetBrains Mono', 'Courier New', monospace",
    label: "Моноширинный",
  },
];

export const AppearanceSettingsPanel = () => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <div className={styles.iconPickRow}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Иконка приложения</span>
            <span className={styles.rowDesc}>
              Меняет иконку окна, трея и ярлыка приложения.
            </span>
          </div>
          <div className={styles.iconGrid}>
            {APP_ICON_DATA_URLS.map((url, i) => {
              const id = i + 1;
              const active = s.appIconId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={
                    active
                      ? `${styles.iconBtn} ${styles.iconBtnActive}`
                      : styles.iconBtn
                  }
                  onClick={() => void patch({ appIconId: id })}
                  aria-label={`Иконка ${id}`}
                  aria-pressed={active}
                >
                  <img className={styles.iconImg} src={url} alt="" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Шрифт приложения</span>
            <span className={styles.rowDesc}>Основной шрифт интерфейса.</span>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={s.appFont}
              onChange={(e) => void patch({ appFont: e.target.value })}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Скрыть счётчик уведомлений</span>
            <span className={styles.rowDesc}>
              Прячет счётчики сообщений и уведомлений в шапке.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.hideNotificationBadges}
              onChange={(v) => void patch({ hideNotificationBadges: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Закругление аватарок</span>
            <span className={styles.rowDesc}>
              Применяется ко всем аватарам приложения.
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={50}
              step={1}
              value={s.avatarRadius}
              onChange={(e) =>
                void patch({ avatarRadius: Number(e.target.value) })
              }
            />
            <span className={styles.rangeVal}>{s.avatarRadius}%</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Отключить фоны профиля</span>
            <span className={styles.rowDesc}>
              Использовать стандартный фон вместо фона профиля.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.disableProfileBackgrounds}
              onChange={(v) => void patch({ disableProfileBackgrounds: v })}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Нижнее меню</span>
        <NavMenuEditor />
      </div>
    </div>
  );
};
