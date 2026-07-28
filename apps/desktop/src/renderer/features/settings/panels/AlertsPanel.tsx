import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SETTINGS, type TelegramTestResult } from "@lzt/shared";
import { Eye, EyeOff, Loader2, Send } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { Toggle } from "~/widgets/Toggle";
import styles from "./settingControls.module.scss";

export const AlertsPanel = () => {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const s = settings ?? DEFAULT_SETTINGS;

  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TelegramTestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await window.moderator.telegram.test());
    } finally {
      setTesting(false);
    }
  };

  const ready = s.telegramBotToken.trim() !== "" && s.telegramChatId.trim() !== "";

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("settings.alerts.telegramTitle")}</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.token")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.tokenDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.textInput}
              type={showToken ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="123456789:AA..."
              value={s.telegramBotToken}
              onChange={(e) => void patch({ telegramBotToken: e.target.value.trim() })}
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setShowToken((v) => !v)}
              title={t(showToken ? "settings.alerts.hide" : "settings.alerts.show")}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.chatId")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.chatIdDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <input
              className={styles.textInput}
              autoComplete="off"
              spellCheck={false}
              placeholder="123456789"
              value={s.telegramChatId}
              onChange={(e) => void patch({ telegramChatId: e.target.value.trim() })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.enabled")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.enabledDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.telegramAlertsEnabled}
              onChange={(v) => void patch({ telegramAlertsEnabled: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.test")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.testDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnIcon}`}
              onClick={() => void runTest()}
              disabled={!ready || testing}
            >
              {testing ? <Loader2 size={15} className={styles.spin} /> : <Send size={15} />}
              <span>{t("settings.alerts.testBtn")}</span>
            </button>
          </div>
        </div>

        {result ? (
          <p className={result.ok ? styles.noteOk : styles.noteErr}>
            {result.ok
              ? t("settings.alerts.testOk", {
                  bot: result.botUsername ?? "—",
                })
              : result.message}
          </p>
        ) : null}
      </div>

      <div className={styles.group}>
        <span className={styles.groupTitle}>{t("settings.alerts.kindsTitle")}</span>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.kindNotifications")}</span>
            <span className={styles.rowDesc}>
              {t("settings.alerts.kindNotificationsDesc")}
            </span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.telegramAlertNotifications}
              onChange={(v) => void patch({ telegramAlertNotifications: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.kindMessages")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.kindMessagesDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.telegramAlertMessages}
              onChange={(v) => void patch({ telegramAlertMessages: v })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>{t("settings.alerts.kindBumps")}</span>
            <span className={styles.rowDesc}>{t("settings.alerts.kindBumpsDesc")}</span>
          </div>
          <div className={styles.rowControl}>
            <Toggle
              checked={s.telegramAlertBumps}
              onChange={(v) => void patch({ telegramAlertBumps: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
