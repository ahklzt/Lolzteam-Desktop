import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DownloadCloud, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { pushToast } from "~/stores/toast";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { Toggle } from "~/widgets/Toggle/Toggle";
import styles from "./settingControls.module.scss";
import local from "./appPanelValues.module.scss";

const TDESKTOP_RELEASES_URL =
  "https" + "://github.com/telegramdesktop/tdesktop/releases/latest";

interface AppPanelProps {
  onOpenProxy: () => void;
  onOpenLoginMethods: () => void;
  onOpenLabels: () => void;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      {children}
    </div>
  );
}

function Item({
  title,
  description,
  control,
}: {
  title: string;
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {description != null && (
          <span className={styles.rowDesc}>{description}</span>
        )}
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
}

function NavItem({
  title,
  description,
  value,
  onClick,
}: {
  title: string;
  description?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {description != null && (
          <span className={styles.rowDesc}>{description}</span>
        )}
      </div>
      <div className={styles.rowControl}>
        {value}
        <button type="button" className={styles.btn} onClick={onClick}>
          Открыть
        </button>
      </div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: number; label: string }>;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const AppPanel = ({
  onOpenProxy,
  onOpenLoginMethods,
  onOpenLabels,
}: AppPanelProps) => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);
  const patch = useSettingsStore((s) => s.patch);

  const [busy, setBusy] = useState<"logs" | "steam" | null>(null);

  const settings = snapshot?.settings;
  if (!settings) return null;

  const exportLog = async () => {
    setBusy("logs");
    const res = await window.moderator.app.exportLog();
    setBusy(null);
    if (res.ok)
      pushToast({
        kind: "success",
        title: t("toast.successTitle"),
        message: t("settings.logs.saved"),
      });
  };

  const pickTelegramFolder = async () => {
    const dir = await window.moderator.app.pickDirectory(
      t("settings.telegram.folderDialog"),
    );
    if (dir) await patch({ telegramSessionPath: dir });
  };

  const clearSteamSessions = async () => {
    const confirmed = await askConfirm({
      title: t("settings.steam.confirmTitle"),
      message: t("settings.steam.confirmBody"),
      confirmText: t("settings.steam.confirmOk"),
      cancelText: t("common.cancel"),
    });
    if (!confirmed) return;
    setBusy("steam");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
    setBusy(null);
    pushToast({
      kind: "success",
      title: t("toast.successTitle"),
      message: t("settings.steam.cleared"),
    });
  };

  return (
    <div className={styles.wrap}>
      <Block title={t("settings.telegram.blockTitle")}>
        <Item
          title={t("settings.telegram.folderLabel")}
          description={
            settings.telegramSessionPath ? (
              <span className={local.pathValue}>
                {settings.telegramSessionPath}
              </span>
            ) : (
              t("settings.telegram.folderNotSet")
            )
          }
          control={
            <button
              type="button"
              className={styles.btn}
              onClick={() => void pickTelegramFolder()}
            >
              <FolderOpen size={16} />
              {settings.telegramSessionPath
                ? t("settings.telegram.folderChange")
                : t("settings.telegram.folderPick")}
            </button>
          }
        />
        <Item
          title={t("settings.telegram.releaseLabel")}
          description={t("settings.telegram.releaseHint")}
          control={
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                void window.moderator.app.openExternal(TDESKTOP_RELEASES_URL)
              }
            >
              <ExternalLink size={16} />
              {t("settings.telegram.releaseBtn")}
            </button>
          }
        />
        <Item
          title={t("settings.telegram.limitLabel")}
          description={t("settings.telegram.limitHint")}
          control={
            <Segmented
              value={settings.telegramMaxAccounts}
              onChange={(v) => void patch({ telegramMaxAccounts: v })}
              options={[
                { value: 3, label: "3" },
                { value: 4, label: "4" },
                { value: 0, label: "∞" },
              ]}
            />
          }
        />
      </Block>

      <Block title={t("settings.steam.blockTitle")}>
        <Item
          title={t("settings.steam.invisibleLabel")}
          description={t("settings.steam.invisibleHint")}
          control={
            <Toggle
              checked={settings.steamInvisible}
              onChange={(v) => void patch({ steamInvisible: v })}
              ariaLabel={t("settings.steam.invisibleLabel")}
            />
          }
        />
        <Item
          title={t("settings.steam.autoLaunchLabel")}
          description={t("settings.steam.autoLaunchHint")}
          control={
            <Toggle
              checked={settings.steamAutoLaunchGame}
              onChange={(v) => void patch({ steamAutoLaunchGame: v })}
              ariaLabel={t("settings.steam.autoLaunchLabel")}
            />
          }
        />
        {settings.steamAutoLaunchGame && (
          <Item
            title={t("settings.steam.appIdLabel")}
            control={
              <input
                className={styles.numInput}
                value={settings.steamAutoLaunchAppId}
                inputMode="numeric"
                placeholder={t("settings.steam.appIdPlaceholder")}
                onChange={(e) =>
                  void patch({
                    steamAutoLaunchAppId: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
              />
            }
          />
        )}
        <Item
          title={t("settings.steam.clearLabel")}
          description={t("settings.steam.clearHint")}
          control={
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void clearSteamSessions()}
              disabled={busy !== null}
            >
              <Trash2 size={16} />
              {busy === "steam"
                ? t("settings.steam.clearing")
                : t("settings.steam.clearBtn")}
            </button>
          }
        />
      </Block>

      <Block title={t("settings.profile.blockTitle")}>
        <NavItem
          title={t("settings.profile.labelsMenu")}
          description={t("settings.profile.labelsMenuHint")}
          value={
            settings.accountLabels.length > 0 ? (
              <span className={local.navValue}>
                {settings.accountLabels.length}
              </span>
            ) : undefined
          }
          onClick={onOpenLabels}
        />
      </Block>

      <Block title={t("settings.app.blockTitle")}>
        <Item
          title={t("settings.app.refreshOnLaunchLabel")}
          description={t("settings.app.refreshOnLaunchHint")}
          control={
            <Toggle
              checked={settings.refreshOnLaunch}
              onChange={(v) => void patch({ refreshOnLaunch: v })}
              ariaLabel={t("settings.app.refreshOnLaunchLabel")}
            />
          }
        />
        <Item
          title={t("settings.app.backgroundRefreshLabel")}
          description={t("settings.app.backgroundRefreshHint")}
          control={
            <Segmented
              value={settings.backgroundRefreshMinutes}
              onChange={(v) => void patch({ backgroundRefreshMinutes: v })}
              options={[
                { value: 0, label: t("settings.app.bgOff") },
                { value: 15, label: t("settings.app.minutesShort", { n: 15 }) },
                { value: 30, label: t("settings.app.minutesShort", { n: 30 }) },
                { value: 60, label: t("settings.app.minutesShort", { n: 60 }) },
              ]}
            />
          }
        />
        <Item
          title={t("settings.app.concurrencyLabel")}
          description={t("settings.app.concurrencyHint")}
          control={
            <Segmented
              value={settings.accountLoadConcurrency}
              onChange={(v) => void patch({ accountLoadConcurrency: v })}
              options={[
                { value: 1, label: "1" },
                { value: 2, label: "2" },
                { value: 3, label: "3" },
                { value: 4, label: "4" },
              ]}
            />
          }
        />
        <NavItem
          title={t("settings.proxy.menuLabel")}
          description={
            settings.proxyEnabled
              ? t("settings.proxy.hintOn", { count: settings.proxies.length })
              : t("settings.proxy.menuHint")
          }
          onClick={onOpenProxy}
        />
        <NavItem
          title={t("settings.loginMethods.menuLabel")}
          description={t("settings.loginMethods.menuHint")}
          onClick={onOpenLoginMethods}
        />
        <Item
          title={t("settings.logs.menuLabel")}
          description={t("settings.logs.menuHint")}
          control={
            <button
              type="button"
              className={styles.btn}
              onClick={() => void exportLog()}
              disabled={busy !== null}
            >
              <DownloadCloud size={16} />
              {busy === "logs"
                ? t("settings.logs.saving")
                : t("settings.logs.button")}
            </button>
          }
        />
      </Block>

    </div>
  );
};
