import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type {
  MarketAutoBumpGlobalPatch,
  MarketAutoBumpItem,
  MarketAutoBumpResult,
  MarketAutoBumpState,
} from "@lzt/shared";
import { formatDate } from "../format";
import styles from "./panels.module.scss";

type Draft = {
  times: string[];
  scheduleOffsetMin: string;
  itemsPerRun: string;
  minDelaySec: string;
  maxDelaySec: string;
  pageDelaySec: string;
  categoryId: string;
  shuffle: boolean;
  skipBumpedInCycle: boolean;
  notifySuccess: boolean;
  notifyErrors: boolean;
};

const toDraft = (state: MarketAutoBumpState): Draft => ({
  times: [...state.times],
  scheduleOffsetMin: String(state.scheduleOffsetMin),
  itemsPerRun: String(state.itemsPerRun),
  minDelaySec: String(state.minDelaySec),
  maxDelaySec: String(state.maxDelaySec),
  pageDelaySec: String(state.pageDelaySec),
  categoryId: state.categoryId === null ? "" : String(state.categoryId),
  shuffle: state.shuffle,
  skipBumpedInCycle: state.skipBumpedInCycle,
  notifySuccess: state.notifySuccess,
  notifyErrors: state.notifyErrors,
});

const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resultClass = (result: MarketAutoBumpResult): string => {
  if (result === "ok") return styles.badgeReady ?? "";
  if (result === "error") return styles.badgeError ?? "";
  return styles.badgeReview ?? "";
};

const eligibilityClass = (value: MarketAutoBumpItem["eligibility"]): string => {
  if (value === "ready") return styles.badgeReady ?? "";
  if (value === "blocked") return styles.badgeError ?? "";
  return styles.badgeReview ?? "";
};

const priceOf = (item: MarketAutoBumpItem): string => {
  if (item.price === null) return "—";
  const currency = item.currency ? ` ${item.currency.toUpperCase()}` : "";
  return `${item.price}${currency}`;
};

export const MarketAutoBumpPanel = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<MarketAutoBumpState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemBusy, setItemBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void window.moderator.marketAutoBump.get().then((next) => {
      if (!alive) return;
      setState(next);
      setDraft(toDraft(next));
    });
    const off = window.moderator.marketAutoBump.onChanged((next) => {
      setState(next);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const apply = async (patch: MarketAutoBumpGlobalPatch, message?: string) => {
    setBusy(true);
    try {
      const next = await window.moderator.marketAutoBump.setGlobal(patch);
      setState(next);
      setDraft(toDraft(next));
      if (message) setNotice(message);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft || !state) return;
    const categoryId = draft.categoryId.trim();
    void apply(
      {
        times: draft.times.filter((value) => value.trim().length > 0),
        scheduleOffsetMin: toNumber(draft.scheduleOffsetMin, state.scheduleOffsetMin),
        itemsPerRun: toNumber(draft.itemsPerRun, state.itemsPerRun),
        minDelaySec: toNumber(draft.minDelaySec, state.minDelaySec),
        maxDelaySec: toNumber(draft.maxDelaySec, state.maxDelaySec),
        pageDelaySec: toNumber(draft.pageDelaySec, state.pageDelaySec),
        categoryId: categoryId === "" ? null : toNumber(categoryId, 0),
        shuffle: draft.shuffle,
        skipBumpedInCycle: draft.skipBumpedInCycle,
        notifySuccess: draft.notifySuccess,
        notifyErrors: draft.notifyErrors,
      },
      t("lztmarket.marketAutoBump.saved"),
    );
  };

  const runNow = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await window.moderator.marketAutoBump.runNow();
      if (res.state) setState(res.state);
      const summary = res.state?.lastSummary ?? null;
      if (res.message === "busy") setNotice(t("lztmarket.marketAutoBump.busy"));
      else if (res.message === "no_token")
        setNotice(t("lztmarket.marketAutoBump.needAuth"));
      else if (!res.ok && !summary)
        setNotice(t("lztmarket.marketAutoBump.runError"));
      else if (summary)
        setNotice(
          t("lztmarket.marketAutoBump.runDone", {
            bumped: summary.bumped,
            limited: summary.limited,
            errors: summary.errors,
          }),
        );
    } finally {
      setBusy(false);
    }
  };

  const resetCycle = async () => {
    setBusy(true);
    try {
      const next = await window.moderator.marketAutoBump.resetCycle();
      setState(next);
      setNotice(t("lztmarket.marketAutoBump.cycleReset"));
    } finally {
      setBusy(false);
    }
  };

  const clearLog = async () => {
    setBusy(true);
    try {
      const next = await window.moderator.marketAutoBump.clearLog();
      setState(next);
    } finally {
      setBusy(false);
    }
  };

  const refreshItems = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await window.moderator.marketAutoBump.refreshItems();
      setState(res.state);
      if (res.message === "busy") setNotice(t("lztmarket.marketAutoBump.busy"));
      else if (res.message === "no_token")
        setNotice(t("lztmarket.marketAutoBump.needAuth"));
      else if (!res.ok) setNotice(t("lztmarket.marketAutoBump.runError"));
    } finally {
      setBusy(false);
    }
  };

  const bumpOne = async (itemId: number) => {
    setItemBusy(itemId);
    setNotice(null);
    try {
      const res = await window.moderator.marketAutoBump.bumpItem(itemId);
      setState(res.state);
      const row = res.state.items.find((entry) => entry.itemId === itemId);
      if (res.ok) setNotice(t("lztmarket.marketAutoBump.itemBumped"));
      else if (row?.lastMessage) setNotice(row.lastMessage);
      else setNotice(t("lztmarket.marketAutoBump.runError"));
    } finally {
      setItemBusy(null);
    }
  };

  const setTime = (index: number, value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      times: draft.times.map((item, i) => (i === index ? value : item)),
    });
  };

  const addTime = () => {
    if (!draft) return;
    setDraft({ ...draft, times: [...draft.times, "12:00"] });
  };

  const removeTime = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, times: draft.times.filter((_, i) => i !== index) });
  };

  if (!state || !draft)
    return <div className={styles.state}>{t("common.loading")}</div>;

  const summary = state.lastSummary;
  const stamp = (value: number | null) =>
    value === null
      ? t("lztmarket.marketAutoBump.never")
      : formatDate(Math.round(value / 1000));

  return (
    <div className={styles.automation}>
      <div className={styles.autoHeader}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() => void apply({ enabled: !state.enabled })}
        >
          {state.enabled
            ? t("lztmarket.marketAutoBump.enabledOn")
            : t("lztmarket.marketAutoBump.enabledOff")}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={busy || state.running}
          onClick={() => void runNow()}
        >
          {state.running ? (
            <Loader2 size={14} className={styles.spin} />
          ) : (
            <Play size={14} />
          )}
          {t("lztmarket.marketAutoBump.runNow")}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={busy}
          onClick={() => void resetCycle()}
        >
          <RotateCcw size={14} />
          {t("lztmarket.marketAutoBump.resetCycle")}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={busy || state.log.length === 0}
          onClick={() => void clearLog()}
        >
          <Trash2 size={14} />
          {t("lztmarket.marketAutoBump.clearLog")}
        </button>
      </div>

      <p className={styles.securityNote}>{t("lztmarket.marketAutoBump.note")}</p>
      {notice ? <p className={styles.muted}>{notice}</p> : null}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{state.totalItems}</span>
          <span className={styles.summaryLabel}>
            {t("lztmarket.marketAutoBump.totalItems")}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{state.cycleBumpedIds.length}</span>
          <span className={styles.summaryLabel}>
            {t("lztmarket.marketAutoBump.cycleProgress")}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{summary ? summary.bumped : 0}</span>
          <span className={styles.summaryLabel}>
            {t("lztmarket.marketAutoBump.bumped")}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{summary ? summary.limited : 0}</span>
          <span className={styles.summaryLabel}>
            {t("lztmarket.marketAutoBump.limited")}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryVal}>{summary ? summary.errors : 0}</span>
          <span className={styles.summaryLabel}>
            {t("lztmarket.marketAutoBump.errors")}
          </span>
        </div>
      </div>

      <p className={styles.muted}>
        {t("lztmarket.marketAutoBump.lastRun")}: {stamp(state.lastRunAt)} ·{" "}
        {t("lztmarket.marketAutoBump.nextRun")}: {stamp(state.nextRunAt)}
      </p>

      <div className={styles.abTimes}>
        <span className={styles.fieldLabel}>
          {t("lztmarket.marketAutoBump.times")}
        </span>
        <div className={styles.abTimeList}>
          {draft.times.map((value, index) => (
            <span className={styles.abTimeRow} key={`slot-${index}`}>
              <input
                className={styles.abTime}
                type="time"
                value={value}
                onChange={(e) => setTime(index, e.target.value)}
              />
              <button
                type="button"
                className={styles.abTimeDel}
                title={t("lztmarket.marketAutoBump.removeTime")}
                onClick={() => removeTime(index)}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          <button type="button" className={styles.abAdd} onClick={addTime}>
            <Plus size={14} />
            {t("lztmarket.marketAutoBump.addTime")}
          </button>
        </div>
        <span className={styles.abHint}>
          {t("lztmarket.marketAutoBump.timesHint")}
        </span>
      </div>

      <div className={styles.abGrid}>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.offset")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            value={draft.scheduleOffsetMin}
            onChange={(e) =>
              setDraft({ ...draft, scheduleOffsetMin: e.target.value })
            }
          />
          <span className={styles.abHint}>
            {t("lztmarket.marketAutoBump.offsetHint")}
          </span>
        </label>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.itemsPerRun")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            min={1}
            value={draft.itemsPerRun}
            onChange={(e) => setDraft({ ...draft, itemsPerRun: e.target.value })}
          />
        </label>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.minDelay")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            min={0}
            value={draft.minDelaySec}
            onChange={(e) => setDraft({ ...draft, minDelaySec: e.target.value })}
          />
        </label>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.maxDelay")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            min={0}
            value={draft.maxDelaySec}
            onChange={(e) => setDraft({ ...draft, maxDelaySec: e.target.value })}
          />
        </label>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.pageDelay")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            min={0}
            value={draft.pageDelaySec}
            onChange={(e) => setDraft({ ...draft, pageDelaySec: e.target.value })}
          />
        </label>
        <label className={styles.abField}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAutoBump.categoryId")}
          </span>
          <input
            className={styles.abInput}
            type="number"
            min={0}
            placeholder={t("lztmarket.marketAutoBump.categoryAll")}
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          />
        </label>
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={draft.shuffle}
          onChange={(e) => setDraft({ ...draft, shuffle: e.target.checked })}
        />
        <span>{t("lztmarket.marketAutoBump.shuffle")}</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={draft.skipBumpedInCycle}
          onChange={(e) =>
            setDraft({ ...draft, skipBumpedInCycle: e.target.checked })
          }
        />
        <span>{t("lztmarket.marketAutoBump.skipBumped")}</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={draft.notifySuccess}
          onChange={(e) => setDraft({ ...draft, notifySuccess: e.target.checked })}
        />
        <span>{t("lztmarket.marketAutoBump.notifySuccess")}</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={draft.notifyErrors}
          onChange={(e) => setDraft({ ...draft, notifyErrors: e.target.checked })}
        />
        <span>{t("lztmarket.marketAutoBump.notifyErrors")}</span>
      </label>

      <div className={styles.applyBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={save}
        >
          <Save size={14} />
          {t("lztmarket.marketAutoBump.save")}
        </button>
      </div>

      <div className={styles.autoHeader}>
        <button
          type="button"
          className={styles.btn}
          disabled={busy || state.running}
          onClick={() => void refreshItems()}
        >
          <RefreshCw size={14} />
          {t("lztmarket.marketAutoBump.refreshItems")}
        </button>
        <span className={styles.muted}>
          {t("lztmarket.marketAutoBump.itemsAt")}: {stamp(state.itemsAt)}
        </span>
      </div>

      {state.items.length === 0 ? (
        <p className={styles.muted}>
          {t("lztmarket.marketAutoBump.itemsEmpty")}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("lztmarket.marketAutoBump.columns.item")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.state")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.price")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.status")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.last")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.itemId}>
                  <td>{item.title ?? `#${item.itemId}`}</td>
                  <td className={styles.muted}>{item.state ?? "—"}</td>
                  <td>{priceOf(item)}</td>
                  <td>
                    <span className={eligibilityClass(item.eligibility)}>
                      {t(
                        `lztmarket.marketAutoBump.eligibility.${item.eligibility}`,
                      )}
                    </span>
                  </td>
                  <td className={styles.muted}>
                    {item.lastMessage ??
                      (item.lastResult
                        ? t(
                            `lztmarket.marketAutoBump.results.${item.lastResult}`,
                          )
                        : "—")}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={
                        busy ||
                        itemBusy !== null ||
                        item.eligibility === "blocked"
                      }
                      onClick={() => void bumpOne(item.itemId)}
                    >
                      {itemBusy === item.itemId ? (
                        <Loader2 size={13} className={styles.spin} />
                      ) : (
                        <ArrowUp size={13} />
                      )}
                      {t("lztmarket.marketAutoBump.bumpItem")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.log.length === 0 ? (
        <p className={styles.muted}>{t("lztmarket.marketAutoBump.empty")}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("lztmarket.marketAutoBump.columns.time")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.item")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.result")}</th>
                <th>{t("lztmarket.marketAutoBump.columns.message")}</th>
              </tr>
            </thead>
            <tbody>
              {state.log.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(Math.round(entry.ts / 1000))}</td>
                  <td>
                    {entry.itemTitle ?? (entry.itemId ? `#${entry.itemId}` : "—")}
                  </td>
                  <td>
                    <span className={resultClass(entry.result)}>
                      {t(`lztmarket.marketAutoBump.results.${entry.result}`)}
                    </span>
                  </td>
                  <td className={styles.muted}>{entry.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
