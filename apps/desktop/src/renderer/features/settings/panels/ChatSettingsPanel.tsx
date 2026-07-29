import { DEFAULT_SETTINGS } from "@lzt/shared";
import { useEffect, useState } from "react";
import { useSettingsStore } from "~/stores/settings";
import { Toggle } from "~/widgets/Toggle";
import styles from "./settingControls.module.scss";

export const ChatSettingsPanel = () => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;
  const [messageRadius, setMessageRadius] = useState(s.messageRadius);
  const [messageFontScale, setMessageFontScale] = useState(
    s.messageFontScale,
  );

  useEffect(() => {
    setMessageRadius(s.messageRadius);
  }, [s.messageRadius]);

  useEffect(() => {
    setMessageFontScale(s.messageFontScale);
  }, [s.messageFontScale]);

  const commitMessageRadius = (): void => {
    if (messageRadius === s.messageRadius) return;
    void patch({ messageRadius });
  };

  const commitMessageFontScale = (): void => {
    if (messageFontScale === s.messageFontScale) return;
    void patch({ messageFontScale });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>
              Скрыть кнопку «Комментировать»
            </span>
            <span className={styles.rowDesc}>
              Отключает кнопку комментирования у сообщений.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.hideCommentButton}
              onChange={(v) => void patch({ hideCommentButton: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Чат в отдельном окне</span>
            <span className={styles.rowDesc}>
              Открывает чат отдельным окном приложения и скрывает плавающее окно
              внутри интерфейса.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.chatSeparateWindow}
              onChange={(v) => void patch({ chatSeparateWindow: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Закругление сообщений</span>
            <span className={styles.rowDesc}>
              Радиус карточек сообщений и разделов.
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={24}
              step={1}
              value={messageRadius}
              onChange={(e) => setMessageRadius(Number(e.target.value))}
              onPointerUp={commitMessageRadius}
              onKeyUp={commitMessageRadius}
              onBlur={commitMessageRadius}
            />
            <span className={styles.rangeVal}>{messageRadius}px</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Размер сообщений</span>
            <span className={styles.rowDesc}>
              Масштаб текста сообщений и комментариев.
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.range}
              type="range"
              min={80}
              max={140}
              step={5}
              value={messageFontScale}
              onChange={(e) => setMessageFontScale(Number(e.target.value))}
              onPointerUp={commitMessageFontScale}
              onKeyUp={commitMessageFontScale}
              onBlur={commitMessageFontScale}
            />
            <span className={styles.rangeVal}>{messageFontScale}%</span>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupTitle}>История сообщений</div>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Заменить иконки</span>
            <span className={styles.rowDesc}>
              Показывать иконки ✒️/🗑 у отредактированных и удалённых
              сообщений вместо текста.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.chatReplaceIcons}
              onChange={(v) => void patch({ chatReplaceIcons: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
