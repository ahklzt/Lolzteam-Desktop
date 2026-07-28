import { useState } from "react";
import { DEFAULT_SETTINGS } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { pushToast } from "~/stores/toast";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { Toggle } from "~/widgets/Toggle";
import { PlannedSettingsPanel, type PlannedItem } from "./PlannedSettingsPanel";
import styles from "./settingControls.module.scss";

const OTHER_PLANNED: PlannedItem[] = [
  {
    title: "История удаления",
    desc: "Отдельная вкладка: удалённые сообщения и темы.",
  },
  { title: "История правок", desc: "Отдельная вкладка: история изменений." },
];

export const OtherSettingsPanel = () => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const setSnapshot = useSettingsStore((s) => s.setSnapshot);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;
  const [busy, setBusy] = useState<null | "cache" | "reset">(null);

  const clearCache = async () => {
    setBusy("cache");
    try {
      await window.moderator.app.clearCache();
      pushToast({ kind: "success", title: "Кэш очищен" });
    } catch {
      pushToast({ kind: "error", title: "Не удалось очистить кэш" });
    } finally {
      setBusy(null);
    }
  };

  const resetSettings = async () => {
    const confirmed = await askConfirm({
      title: "Сброс настроек",
      message: "Сбросить все настройки к значениям по умолчанию?",
      confirmText: "Сбросить",
    });
    if (!confirmed) return;
    setBusy("reset");
    try {
      const next = await window.moderator.settings.reset();
      setSnapshot(next);
      window.location.reload();
    } catch {
      pushToast({ kind: "error", title: "Не удалось сбросить настройки" });
      setBusy(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <span className={styles.groupTitle}>Диагностика</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Отчёты об ошибках</span>
            <span className={styles.rowDesc}>
              Влияет на детальность логов приложения.
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.errorReports}
              onChange={(v) => void patch({ errorReports: v })}
            />
          </div>
        </div>

      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Обслуживание</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Сбросить кэш</span>
            <span className={styles.rowDesc}>
              Очистка локального кэша приложения.
            </span>
          </div>
          <div className={styles.rowControl}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => void clearCache()}
              disabled={busy !== null}
            >
              Очистить
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Сбросить настройки</span>
            <span className={styles.rowDesc}>
              Возврат всех настроек к значениям по умолчанию.
            </span>
          </div>
          <div className={styles.rowControl}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void resetSettings()}
              disabled={busy !== null}
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>Планируется</span>
        <PlannedSettingsPanel items={OTHER_PLANNED} />
      </div>
    </div>
  );
};
