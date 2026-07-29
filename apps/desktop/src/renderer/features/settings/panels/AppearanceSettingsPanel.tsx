import { APP_ICON_DATA_URLS, DEFAULT_SETTINGS } from "@lzt/shared";
import { useEffect, useState } from "react";
import { useSettingsStore } from "~/stores/settings";
import { Toggle } from "~/widgets/Toggle";
import { NavMenuEditor } from "./NavMenuEditor";
import { ThemeSettings } from "./ThemeSettings";
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

const fileNameFromPath = (value: string): string =>
  value.split(/[/\\]/).pop() ?? value;

const pathToFileUrl = (value: string): string => {
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("file://")) return normalized;
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(normalized);
};

export const AppearanceSettingsPanel = () => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;
  const savedContentWidth = Math.max(1220, s.contentWidth ?? 1220);
  const [contentWidth, setContentWidth] = useState(savedContentWidth);
  const [avatarRadius, setAvatarRadius] = useState(s.avatarRadius);

  useEffect(() => {
    setContentWidth(savedContentWidth);
  }, [savedContentWidth]);

  useEffect(() => {
    setAvatarRadius(s.avatarRadius);
  }, [s.avatarRadius]);

  const commitContentWidth = (): void => {
    if (contentWidth === savedContentWidth) return;
    void patch({ contentWidth });
  };

  const commitAvatarRadius = (): void => {
    if (avatarRadius === s.avatarRadius) return;
    void patch({ avatarRadius });
  };

  const pickAppBackground = async () => {
    const filePath = await window.moderator.app.pickFile({
      title: "Выберите фон приложения",
      extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
    });
    if (!filePath) return;
    await patch({ appBackgroundPath: filePath });
  };

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
          <ThemeSettings />
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Фон приложения</span>
            <span className={styles.rowDesc}>
              Задает общий фон для всех страниц. Если у пользователя есть
              собственный баннер, на профиле и объявлениях он будет в приоритете.
            </span>
          </div>
          <div className={`${styles.rowControl} ${styles.fileControl}`}>
            {s.appBackgroundPath ? (
              <div className={styles.filePreview}>
                <img
                  className={styles.filePreviewThumb}
                  src={pathToFileUrl(s.appBackgroundPath)}
                  alt=""
                />
                <div className={styles.filePreviewText}>
                  <span className={styles.filePreviewName}>
                    {fileNameFromPath(s.appBackgroundPath)}
                  </span>
                  <span className={styles.filePreviewHint}>
                    Фон уже применяется ко всему приложению.
                  </span>
                </div>
              </div>
            ) : (
              <span className={styles.rowDesc}>
                Сейчас используется только стандартный фон темы.
              </span>
            )}
            <div className={styles.fileButtons}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => void pickAppBackground()}
              >
                {s.appBackgroundPath ? "Изменить" : "Выбрать файл"}
              </button>
              {s.appBackgroundPath ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => void patch({ appBackgroundPath: null })}
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Ширина интерфейса</span>
            <span className={styles.rowDesc}>
              Текущее значение — базовое. Ползунок расширяет рабочую область приложения без сжатия блоков.
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.range}
              type="range"
              min={1220}
              max={1680}
              step={20}
              value={contentWidth}
              onChange={(e) => setContentWidth(Number(e.target.value))}
              onPointerUp={commitContentWidth}
              onKeyUp={commitContentWidth}
              onBlur={commitContentWidth}
            />
            <span className={styles.rangeVal}>{contentWidth}px</span>
          </div>
        </div>

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
              value={avatarRadius}
              onChange={(e) => setAvatarRadius(Number(e.target.value))}
              onPointerUp={commitAvatarRadius}
              onKeyUp={commitAvatarRadius}
              onBlur={commitAvatarRadius}
            />
            <span className={styles.rangeVal}>{avatarRadius}%</span>
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
