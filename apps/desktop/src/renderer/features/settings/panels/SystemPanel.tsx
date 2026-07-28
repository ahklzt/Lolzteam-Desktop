import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type StorageCategory,
  type StorageUsage,
  type UpdateStatus,
} from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { pushToast } from "~/stores/toast";
import { Toggle } from "~/widgets/Toggle";
import styles from "./settingControls.module.scss";
import local from "./SystemPanel.module.scss";

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 0) return "0 МБ";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const clamp = (raw: string, min: number, max: number, fallback: number): number => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const AGE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 7, label: "1 неделя" },
  { value: 14, label: "2 недели" },
  { value: 30, label: "Месяц" },
  { value: 90, label: "3 месяца" },
  { value: 0, label: "Никогда" },
];

const CATEGORIES: ReadonlyArray<{ key: StorageCategory; label: string }> = [
  { key: "images", label: "Изображения" },
  { key: "stickers", label: "Стикеры" },
  { key: "animations", label: "Анимации" },
  { key: "cache", label: "Кэш" },
];

export const SystemPanel = () => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [busy, setBusy] = useState<StorageCategory | "all" | null>(null);
  const [checking, setChecking] = useState(false);
  const [storageInput, setStorageInput] = useState(String(s.storageLimitMb));
  const [mediaInput, setMediaInput] = useState(String(s.mediaCacheLimitMb));

  useEffect(() => {
    setStorageInput(String(s.storageLimitMb));
    setMediaInput(String(s.mediaCacheLimitMb));
  }, [s.storageLimitMb, s.mediaCacheLimitMb]);

  const refreshUsage = () => {
    void window.moderator.storage
      .getUsage()
      .then(setUsage)
      .catch(() => {});
  };

  useEffect(refreshUsage, []);

  useEffect(() => {
    const off = window.moderator.update.onStatus((st: UpdateStatus) => {
      if (st.state === "checking") return;
      setChecking(false);
      if (st.state === "available") {
        pushToast({ kind: "success", title: `Доступно обновление ${st.version}` });
      } else if (st.state === "not-available") {
        pushToast({ kind: "info", title: "У вас последняя версия" });
      } else if (st.state === "downloaded") {
        pushToast({
          kind: "success",
          title: `Обновление ${st.version} загружено—будет установлено при выходе`,
        });
      } else if (st.state === "error") {
        pushToast({ kind: "error", title: "Ошибка обновления", message: st.message });
      }
    });
    return off;
  }, []);

  const checkUpdates = () => {
    setChecking(true);
    void window.moderator.update.check().catch(() => setChecking(false));
    window.setTimeout(() => setChecking(false), 8000);
  };

  const clearCategory = async (category: StorageCategory | "all") => {
    setBusy(category);
    try {
      const next = await window.moderator.storage.clear(category);
      setUsage(next);
      pushToast({ kind: "success", title: "Память очищена" });
    } catch {
      pushToast({ kind: "error", title: "Не удалось очистить память" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.wrap}>
      {}
      <div className={styles.group}>
        <div className={styles.groupTitle}>Система</div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Запуск при включении системы</span>
            <span className={styles.rowDesc}>
              Автоматически запускать приложение при входе в систему.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.launchOnStartup}
              onChange={(v) => void patch({ launchOnStartup: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Системная рамка окна</span>
            <span className={styles.rowDesc}>
              Использовать стандартную рамку ОС. Требует перезапуска.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.systemWindowFrame}
              onChange={(v) => void patch({ systemWindowFrame: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Показывать иконку в трее</span>
            <span className={styles.rowDesc}>
              Значок приложения в системном трее.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.showTrayIcon}
              onChange={(v) => void patch({ showTrayIcon: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Показывать иконку на панели задач</span>
            <span className={styles.rowDesc}>
              Отображать окно на панели задач.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.showTaskbarIcon}
              onChange={(v) => void patch({ showTaskbarIcon: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Системная проверка орфографии</span>
            <span className={styles.rowDesc}>
              Подчёркивать ошибки в полях ввода.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.systemSpellcheck}
              onChange={(v) => void patch({ systemSpellcheck: v })}
            />
          </div>
        </div>
      </div>

      {}
      <div className={styles.group}>
        <div className={styles.groupTitle}>Обновления</div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Обновлять автоматически</span>
            <span className={styles.rowDesc}>
              Скачивать и устанавливать обновления автоматически.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.autoUpdate}
              onChange={(v) => void patch({ autoUpdate: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Устанавливать бета-версии</span>
            <span className={styles.rowDesc}>
              Получать предварительные версии (могут быть нестабильны).
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.betaUpdates}
              onChange={(v) => void patch({ betaUpdates: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Проверить наличие обновлений</span>
            <span className={styles.rowDesc}>
              Ручная проверка новой версии на сервере обновлений.
            </span>
          </div>
          <div className={styles.rowControl}>
            <button
              type="button"
              className={styles.btn}
              onClick={checkUpdates}
              disabled={checking}
            >
              {checking ? "Проверка…" : "Проверить"}
            </button>
          </div>
        </div>
      </div>

      {}
      <div className={styles.group}>
        <div className={styles.groupTitle}>Управление памятью</div>

        <div className={local.mem}>
          {CATEGORIES.map((c) => (
            <div key={c.key} className={local.memItem}>
              <span className={local.memName}>{c.label}</span>
              <span className={local.memSize}>
                {usage ? formatBytes(usage[c.key]) : "…"}
              </span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => void clearCategory(c.key)}
                disabled={busy !== null}
              >
                Очистить
              </button>
            </div>
          ))}
          <div className={local.memItem}>
            <span className={`${local.memName} ${local.memTotal}`}>
              Память устройства
            </span>
            <span className={`${local.memSize} ${local.memTotal}`}>
              {usage ? formatBytes(usage.totalBytes) : "…"}
            </span>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void clearCategory("all")}
              disabled={busy !== null}
            >
              Очистить всё
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Автоочистка</span>
            <span className={styles.rowDesc}>
              Автоматически чистить кэш по лимитам и возрасту.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.autoCleanCache}
              onChange={(v) => void patch({ autoCleanCache: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Общее ограничение по размеру</span>
            <span className={styles.rowDesc}>От 200 МБ до 10 ГБ (в МБ).</span>
          </div>
          <div className={styles.rowControl}>
            <input
              type="number"
              className={styles.numInput}
              min={200}
              max={10240}
              step={100}
              value={storageInput}
              onChange={(e) => setStorageInput(e.target.value)}
              onBlur={() => {
                const n = clamp(storageInput, 200, 10240, s.storageLimitMb);
                setStorageInput(String(n));
                if (n !== s.storageLimitMb) void patch({ storageLimitMb: n });
              }}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Лимит кэша медиа</span>
            <span className={styles.rowDesc}>От 100 МБ до 9 ГБ (в МБ).</span>
          </div>
          <div className={styles.rowControl}>
            <input
              type="number"
              className={styles.numInput}
              min={100}
              max={9216}
              step={100}
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              onBlur={() => {
                const n = clamp(mediaInput, 100, 9216, s.mediaCacheLimitMb);
                setMediaInput(String(n));
                if (n !== s.mediaCacheLimitMb) void patch({ mediaCacheLimitMb: n });
              }}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Очищать кэш старше</span>
            <span className={styles.rowDesc}>
              Удалять медиа-файлы старше выбранного возраста.
            </span>
          </div>
          <div className={styles.rowControl}>
            <div className={local.seg}>
              {AGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`${local.segBtn} ${
                    s.cacheMaxAgeDays === o.value ? local.segActive : ""
                  }`}
                  onClick={() => void patch({ cacheMaxAgeDays: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
