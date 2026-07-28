import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play, Save } from "lucide-react";
import type {
  AutoRepriceLogEntry,
  AutoRepriceRules,
  AutoRepriceState,
  PricingEstimator,
} from "@lzt/shared";
import { formatDate, formatSum } from "../format";
import styles from "./panels.module.scss";

const ESTIMATORS: PricingEstimator[] = [
  "weightedMedian",
  "median",
  "lowerQuartile",
  "lowest",
];

export const AutomationPanel = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<AutoRepriceState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(180);
  const [estimator, setEstimator] = useState<PricingEstimator>("weightedMedian");
  const [multiplier, setMultiplier] = useState(100);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [minSimilarityPercent, setMinSimilarityPercent] = useState(35);
  const [minConfidence, setMinConfidence] = useState<"review" | "ready">("ready");
  const [maxChangePercent, setMaxChangePercent] = useState(25);
  const [priceFloor, setPriceFloor] = useState(1);
  const [onlyLower, setOnlyLower] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const applyForm = useCallback((s: AutoRepriceState) => {
    setEnabled(s.enabled);
    setDryRun(s.dryRun);
    setIntervalMinutes(s.intervalMinutes);
    setEstimator(s.rules.estimator);
    setMultiplier(s.rules.multiplier);
    setDiscountPercent(s.rules.discountPercent);
    setMinSimilarityPercent(s.rules.minSimilarityPercent);
    setMinConfidence(s.rules.minConfidence);
    setMaxChangePercent(s.rules.maxChangePercent);
    setPriceFloor(s.rules.priceFloor);
    setOnlyLower(s.rules.onlyLower);
  }, []);

  useEffect(() => {
    let active = true;
    void window.moderator.autoReprice.get().then((s) => {
      if (!active) return;
      setState(s);
      setRunning(s.running);
      applyForm(s);
    });
    const off = window.moderator.autoReprice.onChanged((s) => {
      setState(s);
      setRunning(s.running);
    });
    return () => {
      active = false;
      off();
    };
  }, [applyForm]);

  const rules = useMemo<AutoRepriceRules>(
    () => ({
      estimator,
      multiplier,
      discountPercent,
      minSimilarityPercent,
      minConfidence,
      maxChangePercent,
      priceFloor,
      onlyLower,
    }),
    [
      estimator,
      multiplier,
      discountPercent,
      minSimilarityPercent,
      minConfidence,
      maxChangePercent,
      priceFloor,
      onlyLower,
    ],
  );

  const save = useCallback(
    async (override?: { enabled?: boolean; dryRun?: boolean }) => {
      setSaving(true);
      setNotice(null);
      try {
        const next = await window.moderator.autoReprice.setGlobal({
          enabled: override?.enabled ?? enabled,
          dryRun: override?.dryRun ?? dryRun,
          intervalMinutes,
          rules,
        });
        setState(next);
        applyForm(next);
        setNotice(t("lztmarket.automation.saved"));
      } finally {
        setSaving(false);
      }
    },
    [applyForm, dryRun, enabled, intervalMinutes, rules, t],
  );

  const toggleEnabled = useCallback(() => {
    const value = !enabled;
    setEnabled(value);
    void save({ enabled: value });
  }, [enabled, save]);

  const toggleDryRun = useCallback(() => {
    const value = !dryRun;
    setDryRun(value);
    void save({ dryRun: value });
  }, [dryRun, save]);

  const runNow = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    try {
      const res = await window.moderator.autoReprice.runNow();
      if (res.state) {
        setState(res.state);
        setRunning(res.state.running);
      }
      if (!res.ok) {
        setNotice(
          res.message === "no_token"
            ? t("lztmarket.automation.needAuth")
            : res.message === "busy"
              ? t("lztmarket.automation.busy")
              : t("lztmarket.automation.runError"),
        );
      } else if (res.state && res.state.lastSummary) {
        const s = res.state.lastSummary;
        setNotice(
          t("lztmarket.automation.runDone", {
            updated: s.updated,
            held: s.held,
            errors: s.errors,
          }),
        );
      }
    } finally {
      setRunning(false);
    }
  }, [t]);

  const resultClass = (result: AutoRepriceLogEntry["result"]): string => {
    if (result === "updated") return styles.badgeReady ?? "";
    if (result === "held") return styles.badgeReview ?? "";
    if (result === "error") return styles.badgeError ?? "";
    return styles.muted ?? "";
  };

  const summary = state?.lastSummary ?? null;
  const logEntries = state?.log ?? [];

  return (
    <div className={styles.automation}>
      <div className={styles.autoHeader}>
        <button
          type="button"
          className={enabled ? styles.primaryBtn : styles.btn}
          onClick={toggleEnabled}
          disabled={saving}
        >
          {enabled
            ? t("lztmarket.automation.enabledOn")
            : t("lztmarket.automation.enabledOff")}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={toggleDryRun}
          disabled={saving}
        >
          {dryRun
            ? t("lztmarket.automation.dryRunOn")
            : t("lztmarket.automation.dryRunOff")}
        </button>
      </div>

      <p className={styles.securityNote}>{t("lztmarket.automation.dryRunNote")}</p>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.interval")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={15}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.estimator")}
          </span>
          <select
            className={styles.select}
            value={estimator}
            onChange={(e) => setEstimator(e.target.value as PricingEstimator)}
          >
            {ESTIMATORS.map((value) => (
              <option key={value} value={value}>
                {t(`lztmarket.automation.estimators.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.minConfidence")}
          </span>
          <select
            className={styles.select}
            value={minConfidence}
            onChange={(e) =>
              setMinConfidence(e.target.value === "review" ? "review" : "ready")
            }
          >
            <option value="ready">
              {t("lztmarket.automation.confidences.ready")}
            </option>
            <option value="review">
              {t("lztmarket.automation.confidences.review")}
            </option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.multiplier")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={10}
            max={500}
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.discount")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={0}
            max={90}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.minSimilarity")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={0}
            max={100}
            value={minSimilarityPercent}
            onChange={(e) => setMinSimilarityPercent(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.maxChange")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={1}
            max={100}
            value={maxChangePercent}
            onChange={(e) => setMaxChangePercent(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.automation.priceFloor")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={1}
            value={priceFloor}
            onChange={(e) => setPriceFloor(Number(e.target.value))}
          />
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={onlyLower}
            onChange={(e) => setOnlyLower(e.target.checked)}
          />
          <span>{t("lztmarket.automation.onlyLower")}</span>
        </label>
      </div>

      <div className={styles.applyBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 size={15} className={styles.spin} />
          ) : (
            <Save size={15} />
          )}
          {t("lztmarket.automation.save")}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => void runNow()}
          disabled={running}
        >
          {running ? (
            <Loader2 size={15} className={styles.spin} />
          ) : (
            <Play size={15} />
          )}
          {t("lztmarket.automation.runNow")}
        </button>
        {notice ? <span className={styles.muted}>{notice}</span> : null}
      </div>

      {summary ? (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{summary.scanned}</span>
            <span className={styles.summaryLabel}>
              {t("lztmarket.automation.scanned")}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{summary.updated}</span>
            <span className={styles.summaryLabel}>
              {t("lztmarket.automation.updated")}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{summary.held}</span>
            <span className={styles.summaryLabel}>
              {t("lztmarket.automation.held")}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{summary.errors}</span>
            <span className={styles.summaryLabel}>
              {t("lztmarket.automation.errors")}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryVal}>{formatDate(Math.floor(summary.at / 1000))}</span>
            <span className={styles.summaryLabel}>
              {t("lztmarket.automation.lastRun")}
            </span>
          </div>
        </div>
      ) : null}

      {logEntries.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("lztmarket.automation.columns.time")}</th>
                <th>{t("lztmarket.automation.columns.item")}</th>
                <th>{t("lztmarket.automation.columns.result")}</th>
                <th>{t("lztmarket.automation.columns.price")}</th>
                <th>{t("lztmarket.automation.columns.message")}</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(Math.floor(entry.ts / 1000))}</td>
                  <td>{entry.itemTitle ?? entry.itemId}</td>
                  <td>
                    <span className={resultClass(entry.result)}>
                      {t(`lztmarket.automation.results.${entry.result}`)}
                    </span>
                  </td>
                  <td>
                    {entry.oldPrice !== null
                      ? formatSum(entry.oldPrice, entry.currency ?? "rub")
                      : "—"}
                    {entry.newPrice !== null
                      ? ` → ${formatSum(entry.newPrice, entry.currency ?? "rub")}`
                      : ""}
                  </td>
                  <td className={styles.muted}>{entry.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.state}>{t("lztmarket.automation.empty")}</p>
      )}
    </div>
  );
};
