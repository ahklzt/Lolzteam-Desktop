
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_STREAMER_SETTINGS,
  normalizeBanwords,
  type BanwordReplacement,
  type StreamerMaskMode,
  type StreamerSettings,
} from "@lzt/shared";
import { Toggle } from "~/widgets/Toggle/Toggle";
import { useStreamerStore } from "~/stores/streamer";
import styles from "./StreamerView.module.scss";

interface FlagRow {
  key: keyof StreamerSettings;
  labelKey: string;
  hintKey?: string;
}
interface FlagGroup {
  id: string;
  titleKey: string;
  rows: FlagRow[];
}

const GROUPS: FlagGroup[] = [
  {
    id: "finance",
    titleKey: "settings.streamer.groups.finance",
    rows: [
      { key: "hideBalance", labelKey: "settings.streamer.flags.hideBalance" },
      {
        key: "hidePaymentHistory",
        labelKey: "settings.streamer.flags.hidePaymentHistory",
      },
      {
        key: "hidePaymentStats",
        labelKey: "settings.streamer.flags.hidePaymentStats",
      },
      {
        key: "hidePendingPayments",
        labelKey: "settings.streamer.flags.hidePendingPayments",
      },
      {
        key: "hideRecentlyViewed",
        labelKey: "settings.streamer.flags.hideRecentlyViewed",
      },
      {
        key: "hidePurchasedAccounts",
        labelKey: "settings.streamer.flags.hidePurchasedAccounts",
      },
    ],
  },
  {
    id: "messages",
    titleKey: "settings.streamer.groups.messages",
    rows: [
      {
        key: "hideConversationList",
        labelKey: "settings.streamer.flags.hideConversationList",
      },
      {
        key: "blurMessageBodies",
        labelKey: "settings.streamer.flags.blurMessageBodies",
      },
      {
        key: "hideMessageBadge",
        labelKey: "settings.streamer.flags.hideMessageBadge",
      },
      {
        key: "hideNotifications",
        labelKey: "settings.streamer.flags.hideNotifications",
      },
    ],
  },
  {
    id: "credentials",
    titleKey: "settings.streamer.groups.credentials",
    rows: [
      {
        key: "hideAccountCredentials",
        labelKey: "settings.streamer.flags.hideAccountCredentials",
      },
      {
        key: "hideSecretAnswers",
        labelKey: "settings.streamer.flags.hideSecretAnswers",
      },
    ],
  },
  {
    id: "moderation",
    titleKey: "settings.streamer.groups.moderation",
    rows: [
      {
        key: "hideModeratorTools",
        labelKey: "settings.streamer.flags.hideModeratorTools",
      },
      {
        key: "hideForumTeamFeatures",
        labelKey: "settings.streamer.flags.hideForumTeamFeatures",
      },
      {
        key: "hideServiceElements",
        labelKey: "settings.streamer.flags.hideServiceElements",
      },
    ],
  },
];

const MASK_MODES: Array<{ id: StreamerMaskMode; labelKey: string }> = [
  { id: "blur", labelKey: "settings.streamer.mask.blur" },
  { id: "hide", labelKey: "settings.streamer.mask.hide" },
];

const REPLACEMENTS: Array<{
  id: BanwordReplacement;
  labelKey: string;
}> = [
  { id: "asterisks", labelKey: "settings.streamer.banwords.rep.asterisks" },
  { id: "block", labelKey: "settings.streamer.banwords.rep.block" },
  { id: "hidden", labelKey: "settings.streamer.banwords.rep.hidden" },
];

export const StreamerView = () => {
  const { t } = useTranslation();
  const settings = useStreamerStore((s) => s.settings);
  const loaded = useStreamerStore((s) => s.loaded);
  const load = useStreamerStore((s) => s.load);
  const subscribe = useStreamerStore((s) => s.subscribe);
  const patch = useStreamerStore((s) => s.patch);
  const reset = useStreamerStore((s) => s.reset);
  const exportJson = useStreamerStore((s) => s.exportJson);
  const importJson = useStreamerStore((s) => s.importJson);

  useEffect(() => {
    if (!loaded) void load();
    return subscribe();
  }, [loaded, load, subscribe]);

  const [banwordDraft, setBanwordDraft] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const disabled = !settings.enabled;

  const setFlag = useCallback(
    (key: keyof StreamerSettings, value: boolean) => {
      void patch({ [key]: value } as Partial<StreamerSettings>);
    },
    [patch],
  );

  const addBanwords = useCallback(
    (raw: string) => {
      const parts = normalizeBanwords(raw);
      if (parts.length === 0) return;
      const set = new Set<string>(settings.banwords);
      for (const p of parts) set.add(p);
      void patch({ banwords: [...set] });
      setBanwordDraft("");
    },
    [patch, settings.banwords],
  );

  const removeBanword = useCallback(
    (word: string) => {
      void patch({
        banwords: settings.banwords.filter((w) => w !== word),
      });
    },
    [patch, settings.banwords],
  );

  const clearBanwords = useCallback(() => {
    void patch({ banwords: [] });
  }, [patch]);

  const onExport = useCallback(async () => {
    const json = await exportJson();
    try {
      await navigator.clipboard.writeText(json);
    } catch {
    }
  }, [exportJson]);

  const onImportFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const text = await file.text();
      try {
        await importJson(text);
      } catch {
      }
    },
    [importJson],
  );

  const banwordCount = settings.banwords.length;
  const isDirty = useMemo(() => {
    return (
      JSON.stringify(settings) !== JSON.stringify(DEFAULT_STREAMER_SETTINGS)
    );
  }, [settings]);

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{t("settings.streamer.title")}</h2>
          <p className={styles.subtitle}>{t("settings.streamer.subtitle")}</p>
        </div>
        <Toggle
          checked={settings.enabled}
          onChange={(v) => setFlag("enabled", v)}
          ariaLabel={t("settings.streamer.enable")}
        />
      </header>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{t("settings.streamer.mask.title")}</h3>
        <p className={styles.cardHint}>{t("settings.streamer.mask.hint")}</p>

        <div className={styles.chips} role="radiogroup">
          {MASK_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.chip} ${
                settings.maskMode === m.id ? styles.chipActive : ""
              }`}
              onClick={() => void patch({ maskMode: m.id })}
              disabled={disabled}
              role="radio"
              aria-checked={settings.maskMode === m.id}
            >
              {m.id === "blur" ? <Eye size={14} /> : <EyeOff size={14} />}
              {t(m.labelKey)}
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            {t("settings.streamer.mask.blurRadius")}
            <span className={styles.value}>{settings.blurRadiusPx}px</span>
          </label>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={settings.blurRadiusPx}
            onChange={(e) =>
              void patch({ blurRadiusPx: Number(e.target.value) })
            }
            disabled={disabled || settings.maskMode !== "blur"}
            className={styles.range}
          />
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            {t("settings.streamer.mask.transition")}
            <span className={styles.value}>{settings.transitionMs}ms</span>
          </label>
          <input
            type="range"
            min={0}
            max={600}
            step={20}
            value={settings.transitionMs}
            onChange={(e) =>
              void patch({ transitionMs: Number(e.target.value) })
            }
            disabled={disabled}
            className={styles.range}
          />
        </div>

        <div className={styles.flagRow}>
          <Toggle
            checked={settings.revealOnClick}
            onChange={(v) => setFlag("revealOnClick", v)}
            disabled={disabled}
            label={t("settings.streamer.mask.revealOnClick")}
          />
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} className={styles.card}>
          <h3 className={styles.cardTitle}>{t(g.titleKey)}</h3>
          <div className={styles.flags}>
            {g.rows.map((r) => (
              <Toggle
                key={r.key as string}
                checked={Boolean(settings[r.key])}
                onChange={(v) => setFlag(r.key, v)}
                disabled={disabled}
                label={t(r.labelKey)}
              />
            ))}
          </div>
        </section>
      ))}

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>
          {t("settings.streamer.banwords.title")}
          <span className={styles.badge}>{banwordCount}</span>
        </h3>
        <p className={styles.cardHint}>
          {t("settings.streamer.banwords.hint")}
        </p>

        <div className={styles.flagRow}>
          <Toggle
            checked={settings.banwordsEnabled}
            onChange={(v) => setFlag("banwordsEnabled", v)}
            disabled={disabled}
            label={t("settings.streamer.banwords.enable")}
          />
        </div>

        <div className={styles.inputRow}>
          <input
            type="text"
            value={banwordDraft}
            onChange={(e) => setBanwordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBanwords(banwordDraft);
              }
            }}
            placeholder={t("settings.streamer.banwords.placeholder")}
            className={styles.input}
            disabled={disabled || !settings.banwordsEnabled}
          />
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => addBanwords(banwordDraft)}
            disabled={
              disabled || !settings.banwordsEnabled || !banwordDraft.trim()
            }
          >
            {t("settings.streamer.banwords.add")}
          </button>
        </div>

        <div className={styles.chips}>
          {settings.banwords.map((w) => (
            <span key={w} className={styles.tag}>
              {w}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => removeBanword(w)}
                aria-label={t("common.remove")}
                disabled={disabled || !settings.banwordsEnabled}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {banwordCount === 0 && (
            <span className={styles.emptyHint}>
              {t("settings.streamer.banwords.empty")}
            </span>
          )}
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            {t("settings.streamer.banwords.replacement")}
          </label>
          <div className={styles.chips}>
            {REPLACEMENTS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`${styles.chip} ${
                  settings.banwordReplacement === r.id ? styles.chipActive : ""
                }`}
                onClick={() => void patch({ banwordReplacement: r.id })}
                disabled={disabled || !settings.banwordsEnabled}
              >
                {t(r.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={clearBanwords}
            disabled={disabled || banwordCount === 0}
          >
            {t("settings.streamer.banwords.clear")}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>
          {t("settings.streamer.io.title")}
        </h3>
        <p className={styles.cardHint}>{t("settings.streamer.io.hint")}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => void onExport()}
          >
            <Download size={14} />
            {t("settings.streamer.io.export")}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={14} />
            {t("settings.streamer.io.import")}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className={styles.fileHidden}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onImportFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => void reset()}
            disabled={!isDirty}
          >
            <RefreshCw size={14} />
            {t("settings.streamer.io.reset")}
          </button>
        </div>
      </section>
    </div>
  );
};
