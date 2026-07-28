import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play, Square } from "lucide-react";
import type {
  MarketCategoryInfo,
  MarketCurrency,
} from "@lzt/shared";
import { MARKET_CURRENCIES } from "@lzt/shared";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import {
  buildPublishInput,
  GUARANTEE_OPTIONS,
  MAX_ACCOUNTS,
  MAX_PARALLEL,
  MIN_PROTECTIVE_PRICE,
  ORIGIN_OPTIONS,
  parseAccountsText,
  redactAccount,
  safeExtra,
  type BulkConfig,
  type ParsedAccount,
} from "./bulk-upload";
import { formatSum } from "../format";
import styles from "./panels.module.scss";

type RowStatus = "queued" | "invalid" | "submitting" | "done" | "failed";

interface DisplayRow {
  id: number;
  sourceLine: number;
  valid: boolean;
  status: RowStatus;
  itemId: number | null;
  error: string | null;
}

export const BulkUploadPanel = () => {
  const { t } = useTranslation();

  const [categories, setCategories] = useState<MarketCategoryInfo[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<MarketCurrency>("rub");
  const [initialPrice, setInitialPrice] = useState(99999);
  const [origin, setOrigin] = useState<string>("brute");
  const [guarantee, setGuarantee] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [information, setInformation] = useState("");
  const [extraText, setExtraText] = useState("");
  const [parallelism, setParallelism] = useState(2);

  const [accountsText, setAccountsText] = useState("");
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const accountsRef = useRef<Map<number, ParsedAccount>>(new Map());
  const cancelRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await window.moderator.market.getCategories();
      if (!alive || !res.ok) return;
      setCategories(res.categories);
      setCategoryId((prev) => prev ?? res.categories[0]?.category_id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleText = useCallback(
    (value: string) => {
      setAccountsText(value);
      const parsed = parseAccountsText(value);
      const map = new Map<number, ParsedAccount>();
      const next: DisplayRow[] = parsed.map((entry, index) => {
        if (entry.account) map.set(index, entry.account);
        return {
          id: index,
          sourceLine: entry.sourceLine,
          valid: entry.account !== null,
          status: entry.account ? "queued" : "invalid",
          itemId: null,
          error: entry.error ? t("lztmarket.bulkUpload.invalidFormat") : null,
        };
      });
      accountsRef.current = map;
      setRows(next);
    },
    [t],
  );

  const stats = useMemo(() => {
    let done = 0;
    let failed = 0;
    let submitting = 0;
    let valid = 0;
    for (const row of rows) {
      if (row.valid) valid += 1;
      if (row.status === "done") done += 1;
      else if (row.status === "failed") failed += 1;
      else if (row.status === "submitting") submitting += 1;
    }
    const processed = done + failed;
    return {
      done,
      failed,
      submitting,
      valid,
      processed,
      percent: valid > 0 ? Math.round((processed / valid) * 100) : 0,
    };
  }, [rows]);

  const updateRow = useCallback((id: number, patch: Partial<DisplayRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    if (!categoryId) {
      setNotice(t("lztmarket.bulkUpload.pickCategory"));
      return;
    }
    const validRows = rows.filter((row) => row.valid);
    if (!validRows.length) {
      setNotice(t("lztmarket.bulkUpload.noAccounts"));
      return;
    }
    if (validRows.length > MAX_ACCOUNTS) {
      setNotice(t("lztmarket.bulkUpload.tooMany", { n: MAX_ACCOUNTS }));
      return;
    }
    if (!Number.isFinite(initialPrice) || initialPrice < MIN_PROTECTIVE_PRICE) {
      setNotice(t("lztmarket.bulkUpload.badPrice"));
      return;
    }
    let extra: Record<string, string | number | boolean> = {};
    if (extraText.trim()) {
      try {
        extra = safeExtra(JSON.parse(extraText));
      } catch {
        setNotice(t("lztmarket.bulkUpload.invalidExtra"));
        return;
      }
    }
    const confirmed = await askConfirm({
      title: t("lztmarket.bulkUpload.confirmTitle"),
      message: t("lztmarket.bulkUpload.confirmMsg", {
        n: validRows.length,
        price: formatSum(Math.round(initialPrice), currency),
      }),
      confirmText: t("lztmarket.bulkUpload.start"),
    });
    if (!confirmed) return;

    const config: BulkConfig = {
      categoryId,
      currency,
      initialPrice: Math.round(initialPrice),
      origin,
      guarantee,
      title: title.trim(),
      description: description.trim(),
      information: information.trim(),
      extra,
    };

    setRunning(true);
    cancelRef.current = false;
    setNotice(null);
    setRows((prev) =>
      prev.map((row) =>
        row.valid ? { ...row, status: "queued", itemId: null, error: null } : row,
      ),
    );

    const queue = validRows.map((row) => row.id);
    let cursor = 0;
    let okCount = 0;
    let failCount = 0;
    const take = (): number | undefined =>
      cursor < queue.length ? queue[cursor++] : undefined;

    const worker = async (): Promise<void> => {
      for (;;) {
        if (cancelRef.current) return;
        const id = take();
        if (id === undefined) return;
        const account = accountsRef.current.get(id);
        if (!account) {
          failCount += 1;
          updateRow(id, { status: "failed", error: t("lztmarket.bulkUpload.noCreds") });
          continue;
        }
        updateRow(id, { status: "submitting", error: null });
        let ok = false;
        let itemId: number | null = null;
        let errText: string | null = null;
        try {
          const res = await window.moderator.market.publishItem(
            buildPublishInput(account, config),
          );
          if (res.ok) {
            ok = true;
            itemId = res.itemId;
          } else {
            const reason = t(`lztmarket.bulkUpload.reasons.${res.reason}`);
            errText = res.message
              ? `${reason}: ${redactAccount(res.message, account)}`
              : reason;
          }
        } catch {
          errText = t("lztmarket.bulkUpload.reasons.network");
        }
        if (ok) {
          okCount += 1;
          accountsRef.current.delete(id);
          updateRow(id, { status: "done", itemId, error: null });
        } else {
          failCount += 1;
          updateRow(id, { status: "failed", error: errText });
        }
      }
    };

    const count = Math.min(MAX_PARALLEL, Math.max(1, parallelism));
    await Promise.all(Array.from({ length: count }, () => worker()));
    setRunning(false);
    setNotice(
      t("lztmarket.bulkUpload.done", { ok: okCount, fail: failCount }),
    );
  }, [
    running,
    categoryId,
    rows,
    initialPrice,
    extraText,
    currency,
    origin,
    guarantee,
    title,
    description,
    information,
    parallelism,
    updateRow,
    t,
  ]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const statusClass = (status: RowStatus): string =>
    status === "done"
      ? styles.badgeReady
      : status === "submitting"
        ? styles.badgeReview
        : status === "failed" || status === "invalid"
          ? styles.badgeError
          : styles.badgeManual;

  return (
    <div className={styles.wallet}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.category")}
          </span>
          <select
            className={styles.select}
            value={categoryId ?? ""}
            disabled={running}
            onChange={(e) => setCategoryId(Number(e.target.value) || null)}
          >
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name ?? c.category_title ?? `#${c.category_id}`}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.currency")}
          </span>
          <select
            className={styles.select}
            value={currency}
            disabled={running}
            onChange={(e) => setCurrency(e.target.value as MarketCurrency)}
          >
            {MARKET_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.initialPrice")}
          </span>
          <input
            className={styles.num}
            type="number"
            value={initialPrice}
            disabled={running}
            onChange={(e) => setInitialPrice(Number(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.origin")}
          </span>
          <select
            className={styles.select}
            value={origin}
            disabled={running}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {ORIGIN_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {t(`lztmarket.bulkUpload.origins.${o}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.guarantee")}
          </span>
          <select
            className={styles.select}
            value={guarantee}
            disabled={running}
            onChange={(e) => setGuarantee(Number(e.target.value))}
          >
            {GUARANTEE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {t(`lztmarket.bulkUpload.guarantees.${g}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.parallelism")}
          </span>
          <input
            className={styles.num}
            type="number"
            min={1}
            max={MAX_PARALLEL}
            value={parallelism}
            disabled={running}
            onChange={(e) =>
              setParallelism(
                Math.min(MAX_PARALLEL, Math.max(1, Number(e.target.value) || 1)),
              )
            }
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.title")}
          </span>
          <input
            className={styles.select}
            type="text"
            value={title}
            disabled={running}
            placeholder={t("lztmarket.bulkUpload.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.extra")}
          </span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={extraText}
            disabled={running}
            placeholder={t("lztmarket.bulkUpload.extraPlaceholder")}
            onChange={(e) => setExtraText(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.bulkUpload.accounts")}
          </span>
          <textarea
            className={styles.textarea}
            rows={8}
            value={accountsText}
            disabled={running}
            placeholder={t("lztmarket.bulkUpload.accountsPlaceholder")}
            onChange={(e) => handleText(e.target.value)}
          />
          <span className={styles.parseSummary}>
            {t("lztmarket.bulkUpload.parseSummary", {
              valid: stats.valid,
              invalid: rows.length - stats.valid,
            })}
          </span>
        </div>
      </div>

      <div className={styles.applyBar}>
        {running ? (
          <button type="button" className={styles.btn} onClick={cancel}>
            <Square size={16} />
            {t("lztmarket.bulkUpload.cancel")}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void start()}
            disabled={stats.valid === 0}
          >
            <Play size={16} />
            {t("lztmarket.bulkUpload.startN", { n: stats.valid })}
          </button>
        )}
        {running ? <Loader2 className={styles.spin} size={16} /> : null}
        {stats.processed > 0 || running ? (
          <span className={styles.parseSummary}>
            {t("lztmarket.bulkUpload.progress", {
              done: stats.done,
              fail: stats.failed,
              total: stats.valid,
            })}
          </span>
        ) : null}
      </div>

      {running || stats.processed > 0 ? (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      ) : null}

      {notice ? <p className={styles.muted}>{notice}</p> : null}

      <p className={styles.securityNote}>
        {t("lztmarket.bulkUpload.securityNote")}
      </p>

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("lztmarket.bulkUpload.columns.line")}</th>
                <th>{t("lztmarket.bulkUpload.columns.status")}</th>
                <th>{t("lztmarket.bulkUpload.columns.item")}</th>
                <th>{t("lztmarket.bulkUpload.columns.info")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.sourceLine}</td>
                  <td>
                    <span className={statusClass(row.status)}>
                      {t(`lztmarket.bulkUpload.status.${row.status}`)}
                    </span>
                  </td>
                  <td>{row.itemId ? `#${row.itemId}` : "\u2014"}</td>
                  <td>
                    {row.error ? (
                      <span className={styles.muted}>{row.error}</span>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
