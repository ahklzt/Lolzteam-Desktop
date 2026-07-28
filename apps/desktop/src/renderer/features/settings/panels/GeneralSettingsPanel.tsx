import { useRef } from "react";
import { DEFAULT_AVATAR_PLACEHOLDER, DEFAULT_SETTINGS } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { Toggle } from "~/widgets/Toggle";
import styles from "./settingControls.module.scss";

interface GeneralSettingsPanelProps {
  onOpenLocalUniq: () => void;
  onOpenHistory: () => void;
}

export const GeneralSettingsPanel = ({
  onOpenLocalUniq,
  onOpenHistory,
}: GeneralSettingsPanelProps) => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;

  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPlaceholder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        void patch({ avatarPlaceholder: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const placeholderSrc = s.avatarPlaceholder ?? DEFAULT_AVATAR_PLACEHOLDER;

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <span className={styles.groupTitle}>Отправка</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Использовать отложку</span>
            <span className={styles.rowDesc}>
              Отправлять сообщения и темы с задержкой.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.delayedSend}
              onChange={(v) => void patch({ delayedSend: v })}
            />
          </div>
        </div>

        {s.delayedSend && (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>Период отложки</span>
              <span className={styles.rowDesc}>
                Задержка перед отправкой, в секундах.
              </span>
            </div>
            <div className={styles.rowControl}>
              <input
                className={styles.numInput}
                type="number"
                min={1}
                max={3600}
                step={1}
                value={s.delayedSendSeconds}
                onChange={(e) =>
                  void patch({
                    delayedSendSeconds: Math.max(
                      1,
                      Math.min(3600, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
              <span className={styles.rangeVal}>сек</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Приватность</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Скрыть аватар</span>
            <span className={styles.rowDesc}>
              Показывать заглушку вместо аватаров пользователей везде.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.hideAvatars}
              onChange={(v) => void patch({ hideAvatars: v })}
            />
          </div>
        </div>

        {s.hideAvatars && (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>Картинка-заглушка</span>
              <span className={styles.rowDesc}>
                По умолчанию — логотип LZT. Можно выбрать свою.
              </span>
            </div>
            <div className={styles.rowControl}>
              <img className={styles.avatarPreview} src={placeholderSrc} alt="" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onPickPlaceholder}
              />
              <button
                type="button"
                className={styles.btn}
                onClick={() => fileRef.current?.click()}
              >
                Выбрать
              </button>
              {s.avatarPlaceholder && (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => void patch({ avatarPlaceholder: null })}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Подменять платформу как Android</span>
            <span className={styles.rowDesc}>
              Помечать активность на форуме как с Android-устройства.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.spoofAndroid}
              onChange={(v) => void patch({ spoofAndroid: v })}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Оформление ника</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Локальный Уник</span>
            <span className={styles.rowDesc}>
              Клиентское оформление вашего ника: лычка, стиль, тени, иконка.
              Видно только вам.
            </span>
          </div>
          <div className={styles.rowControl}>
            <button
              type="button"
              className={styles.btn}
              onClick={onOpenLocalUniq}
            >
              Открыть редактор
            </button>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Предупреждения при отправке</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Отправка сообщения</span>
            <span className={styles.rowDesc}>
              Подтверждение перед отправкой ответа в теме.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.warnSendMessage}
              onChange={(v) => void patch({ warnSendMessage: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Отправка темы</span>
            <span className={styles.rowDesc}>
              Подтверждение перед созданием новой темы.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.warnSendThread}
              onChange={(v) => void patch({ warnSendThread: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Отправка сообщения в чат</span>
            <span className={styles.rowDesc}>
              Подтверждение перед отправкой сообщения в чат-виджете.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.warnSendChatMessage}
              onChange={(v) => void patch({ warnSendChatMessage: v })}
            />
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>История и хранилище</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Сохранять удалённые сообщения</span>
            <span className={styles.rowDesc}>
              Локально хранить и помечать удалённые посты форума и сообщения чата.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.saveDeletedMessages}
              onChange={(v) => void patch({ saveDeletedMessages: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Сохранять удалённые темы</span>
            <span className={styles.rowDesc}>
              Локально хранить и помечать удалённые темы форума.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.saveDeletedThreads}
              onChange={(v) => void patch({ saveDeletedThreads: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Сохранять историю правок</span>
            <span className={styles.rowDesc}>
              Отслеживать изменения сообщений и хранить цепочку версий.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.saveEditHistory}
              onChange={(v) => void patch({ saveEditHistory: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Кэшировать медиа (webp)</span>
            <span className={styles.rowDesc}>
              Сохранять картинки/аватары/смайлы локально в webp (без даунскейла).
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.cacheMedia}
              onChange={(v) => void patch({ cacheMedia: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Интервал проверки</span>
            <span className={styles.rowDesc}>
              Как часто сверять контент на удаления/правки, в секундах (мин. 10).
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.numInput}
              type="number"
              min={10}
              max={3600}
              step={5}
              value={s.historyCheckSeconds}
              onChange={(e) =>
                void patch({
                  historyCheckSeconds: Math.max(
                    10,
                    Math.min(3600, Number(e.target.value) || 10),
                  ),
                })
              }
            />
            <span className={styles.rangeVal}>сек</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Срок хранения</span>
            <span className={styles.rowDesc}>
              Сколько дней хранить дампы/медиа (потом авто-очистка). 0 — не удалять.
            </span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.numInput}
              type="number"
              min={0}
              max={3650}
              step={1}
              value={s.historyRetentionDays}
              onChange={(e) =>
                void patch({
                  historyRetentionDays: Math.max(
                    0,
                    Math.min(3650, Number(e.target.value) || 0),
                  ),
                })
              }
            />
            <span className={styles.rangeVal}>дн.</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>История удаления и правок</span>
            <span className={styles.rowDesc}>
              Просмотр сохранённых удалённых сообщений/тем и истории правок.
            </span>
          </div>
          <div className={styles.rowControl}>
            <button type="button" className={styles.btn} onClick={onOpenHistory}>
              Открыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
