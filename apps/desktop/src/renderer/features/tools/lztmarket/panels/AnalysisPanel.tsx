import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import type {
  MarketItem,
  PricingCandidate,
  PricingEstimate,
  PricingEstimator,
} from "@lzt/shared";
import { estimatePrice } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { MARKET_CATEGORIES } from "~/features/market/categories";
import { formatSum, toMarketCurrency } from "../format";
import styles from "./panels.module.scss";

const MAX_OWN_PAGES = 4;
const ANALOG_PAGES = 2;
const ESTIMATORS: PricingEstimator[] = [
  "weightedMedian",
  "median",
  "lowerQuartile",
  "lowest",
];

const norm = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const SLUG_BY_NORM: Record<string, string> = Object.fromEntries(
  MARKET_CATEGORIES.filter((c) => c.slug).map((c) => [norm(c.label), c.slug]),
);

const tokenize = (value: string | undefined): Set<string> => {
  const set = new Set<string>();
  if (!value) return set;
  for (const raw of value.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const token = raw.replace(/\d+/g, "#");
    if (token) set.add(token);
  }
  return set;
};

const jaccard = (left: Set<string>, right: Set<string>): number => {
  if (!left.size && !right.size) return 1;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  const union = left.size + right.size - common;
  return union > 0 ? common / union : 0;
};

const priceOf = (item: MarketItem): number => {
  const rub = Number(item.rub_price);
  if (Number.isFinite(rub) && rub > 0) return rub;
  const raw = Number(item.price);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

const sellerIdOf = (item: MarketItem): number | null => {
  const id = item.seller?.user_id;
  return typeof id === "number" ? id : null;
};

type Phase = "idle" | "collecting" | "ready" | "error";

interface AnalysisRow {
  item: MarketItem;
  estimate: PricingEstimate;
  analogCount: number;
}

export const AnalysisPanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const currency = profile?.currency ?? "RUB";
  const userId = profile?.userId ?? null;

  const [ownItems, setOwnItems] = useState<MarketItem[]>([]);
  const [catName, setCatName] = useState<Record<number, string>>({});
  const [pools, setPools] = useState<Record<number, MarketItem[]>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [estimator, setEstimator] = useState<PricingEstimator>("weightedMedian");
  const [multiplier, setMultiplier] = useState(100);
  const [discount, setDiscount] = useState(0);
  const [minSimPercent, setMinSimPercent] = useState(0);

  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [includes, setIncludes] = useState<Record<number, boolean>>({});

  const collect = useCallback(async () => {
    if (!userId) return;
    setPhase("collecting");
    setNotice(null);
    try {
      const items: MarketItem[] = [];
      for (let page = 1; page <= MAX_OWN_PAGES; page += 1) {
        const res = await window.moderator.market.getUserItems(userId, page, {
          order_by: "pdate_to_down",
        });
        if (!res.ok) {
          if (page === 1) throw new Error("own");
          break;
        }
        items.push(...res.page.items);
        if (!res.page.hasNextPage) break;
      }

      const names: Record<number, string> = {};
      const slugs: Record<number, string> = {};
      const catRes = await window.moderator.market.getCategories();
      if (catRes.ok) {
        for (const c of catRes.categories) {
          if (c.category_name) {
            names[c.category_id] = c.category_name;
            const slug = SLUG_BY_NORM[norm(c.category_name)];
            if (slug) slugs[c.category_id] = slug;
          }
        }
      }

      const cats = Array.from(new Set(items.map((it) => it.category_id)));
      const nextPools: Record<number, MarketItem[]> = {};
      for (const catId of cats) {
        const slug = slugs[catId];
        if (!slug) {
          nextPools[catId] = [];
          continue;
        }
        const collected: MarketItem[] = [];
        for (let page = 1; page <= ANALOG_PAGES; page += 1) {
          const res = await window.moderator.market.getItems({
            slug,
            page,
            order_by: "price_to_up",
          });
          if (!res.ok) break;
          collected.push(...res.page.items);
          if (!res.page.hasNextPage) break;
        }
        nextPools[catId] = collected;
      }

      setOwnItems(items);
      setCatName(names);
      setPools(nextPools);
      setIncludes({});
      setOverrides({});
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [userId]);

  const rows = useMemo<AnalysisRow[]>(() => {
    return ownItems.map((item) => {
      const pool = pools[item.category_id] ?? [];
      const targetTokens = tokenize(item.title ?? item.title_en);
      const targetSeller = sellerIdOf(item);
      const candidates: PricingCandidate[] = pool
        .filter((cand) => cand.item_id !== item.item_id)
        .map((cand) => ({
          itemId: cand.item_id,
          price: priceOf(cand),
          similarity: jaccard(targetTokens, tokenize(cand.title ?? cand.title_en)),
          sellerId: sellerIdOf(cand),
          title: cand.title ?? cand.title_en,
        }));
      const estimate = estimatePrice(
        {
          itemId: item.item_id,
          sellerId: targetSeller,
          categoryId: item.category_id,
        },
        candidates,
        {
          estimator,
          priceMultiplier: multiplier,
          discountPercent: discount,
          minSimilarity: minSimPercent / 100,
        },
      );
      return { item, estimate, analogCount: candidates.length };
    });
  }, [ownItems, pools, estimator, multiplier, discount, minSimPercent]);

  const targetPrice = useCallback(
    (row: AnalysisRow): number | null => {
      const raw = overrides[row.item.item_id];
      const overrideNum = raw ? Number(raw) : Number.NaN;
      if (Number.isFinite(overrideNum) && overrideNum > 0) {
        return Math.round(overrideNum);
      }
      return row.estimate.proposedPrice;
    },
    [overrides],
  );

  const queueCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const id = row.item.item_id;
      if (!includes[id]) continue;
      const price = targetPrice(row);
      if (price !== null && price > 0 && price !== Math.round(row.item.price ?? 0)) {
        count += 1;
      }
    }
    return count;
  }, [rows, includes, targetPrice]);

  const selectRecommended = useCallback(() => {
    const next: Record<number, boolean> = {};
    for (const row of rows) {
      if (row.estimate.status !== "ready") continue;
      const price = row.estimate.proposedPrice;
      if (price !== null && price > 0 && price !== Math.round(row.item.price ?? 0)) {
        next[row.item.item_id] = true;
      }
    }
    setIncludes(next);
  }, [rows]);

  const applyQueue = useCallback(async () => {
    const queue: Array<{ id: number; price: number }> = [];
    for (const row of rows) {
      const id = row.item.item_id;
      if (!includes[id]) continue;
      const price = targetPrice(row);
      if (price === null || price <= 0) continue;
      if (price === Math.round(row.item.price ?? 0)) continue;
      queue.push({ id, price });
    }
    if (!queue.length) {
      setNotice(t("lztmarket.marketAnalysis.nothingToApply"));
      return;
    }
    const confirmed = await askConfirm({
      title: t("lztmarket.marketAnalysis.applyTitle"),
      message: t("lztmarket.marketAnalysis.applyMsg", { n: queue.length }),
      confirmText: t("lztmarket.marketAnalysis.apply"),
    });
    if (!confirmed) return;
    setApplying(true);
    setNotice(null);
    const cur = toMarketCurrency(currency);
    let ok = 0;
    let fail = 0;
    const applied = new Map<number, number>();
    for (const entry of queue) {
      const res = await window.moderator.market.editPrice({
        itemId: entry.id,
        price: entry.price,
        currency: cur,
      });
      if (res.ok) {
        ok += 1;
        applied.set(entry.id, res.item?.price ?? entry.price);
      } else {
        fail += 1;
      }
    }
    setApplying(false);
    if (applied.size) {
      setOwnItems((prev) =>
        prev.map((it) =>
          applied.has(it.item_id)
            ? { ...it, price: applied.get(it.item_id) ?? it.price }
            : it,
        ),
      );
      setIncludes((prev) => {
        const next = { ...prev };
        for (const id of applied.keys()) delete next[id];
        return next;
      });
    }
    setNotice(t("lztmarket.marketAnalysis.applyDone", { ok, fail }));
  }, [rows, includes, targetPrice, currency, t]);

  const confidencePct = (value: number): string => `${Math.round(value * 100)}%`;

  const statusClass = (state: PricingEstimate["status"]): string =>
    state === "ready"
      ? styles.badgeReady
      : state === "review"
        ? styles.badgeReview
        : styles.badgeManual;

  if (!userId) {
    return (
      <p className={styles.muted}>{t("lztmarket.marketAnalysis.needAuth")}</p>
    );
  }

  return (
    <div className={styles.wallet}>
      <div className={styles.analysisToolbar}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAnalysis.estimator")}
          </span>
          <select
            className={styles.select}
            value={estimator}
            onChange={(e) => setEstimator(e.target.value as PricingEstimator)}
          >
            {ESTIMATORS.map((id) => (
              <option key={id} value={id}>
                {t(`lztmarket.marketAnalysis.estimators.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAnalysis.multiplier")}
          </span>
          <input
            className={styles.num}
            type="number"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAnalysis.discount")}
          </span>
          <input
            className={styles.num}
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.marketAnalysis.minSimilarity")}
          </span>
          <input
            className={styles.num}
            type="number"
            value={minSimPercent}
            onChange={(e) => setMinSimPercent(Number(e.target.value) || 0)}
          />
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => void collect()}
          disabled={phase === "collecting" || applying}
        >
          {phase === "collecting" ? (
            <Loader2 className={styles.spin} size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {phase === "ready" || phase === "error"
            ? t("lztmarket.marketAnalysis.recollect")
            : t("lztmarket.marketAnalysis.collect")}
        </button>
      </div>

      {notice ? <p className={styles.muted}>{notice}</p> : null}

      {phase === "idle" ? (
        <p className={styles.muted}>
          {t("lztmarket.marketAnalysis.notCollected")}
        </p>
      ) : phase === "collecting" ? (
        <div className={styles.state}>
          <Loader2 className={styles.spin} size={22} />
        </div>
      ) : phase === "error" ? (
        <p className={styles.error}>{t("lztmarket.marketAnalysis.loadError")}</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>{t("lztmarket.marketAnalysis.empty")}</p>
      ) : (
        <>
          <div className={styles.applyBar}>
            <button
              type="button"
              className={styles.btn}
              onClick={selectRecommended}
              disabled={applying}
            >
              <Sparkles size={16} />
              {t("lztmarket.marketAnalysis.selectRecommended")}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void applyQueue()}
              disabled={applying || queueCount === 0}
            >
              {applying ? <Loader2 className={styles.spin} size={16} /> : null}
              {t("lztmarket.marketAnalysis.applyN", { n: queueCount })}
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("lztmarket.marketAnalysis.columns.lot")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.current")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.recommended")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.confidence")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.delta")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.override")}</th>
                  <th>{t("lztmarket.marketAnalysis.columns.include")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = row.item.item_id;
                  const current = Math.round(row.item.price ?? 0);
                  const proposed = row.estimate.proposedPrice;
                  const target = targetPrice(row);
                  const delta =
                    target !== null && current > 0
                      ? Math.round(((target - current) / current) * 100)
                      : null;
                  const range = row.estimate.priceRange;
                  return (
                    <tr key={id}>
                      <td>
                        <span className={styles.itemTitle}>
                          {row.item.title ?? row.item.title_en ?? `#${id}`}
                        </span>
                        <span className={styles.itemId}>
                          {`${catName[row.item.category_id] ?? `#${row.item.category_id}`} \u00b7 ${t("lztmarket.marketAnalysis.analogs", { n: row.analogCount })}`}
                        </span>
                      </td>
                      <td>{formatSum(current, currency)}</td>
                      <td>
                        {proposed !== null ? (
                          <>
                            <span>{formatSum(proposed, currency)}</span>
                            {range ? (
                              <span className={styles.rangeText}>
                                {`${formatSum(range.min, currency)} \u2013 ${formatSum(range.max, currency)}`}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className={styles.muted}>{"\u2014"}</span>
                        )}
                      </td>
                      <td>
                        <span className={statusClass(row.estimate.status)}>
                          {`${t(`lztmarket.marketAnalysis.status.${row.estimate.status}`)} ${confidencePct(row.estimate.confidence)}`}
                        </span>
                      </td>
                      <td>
                        {delta !== null ? (
                          <span
                            className={
                              delta > 0
                                ? styles.deltaUp
                                : delta < 0
                                  ? styles.deltaDown
                                  : undefined
                            }
                          >
                            {`${delta > 0 ? "+" : ""}${delta}%`}
                          </span>
                        ) : (
                          <span className={styles.muted}>{"\u2014"}</span>
                        )}
                      </td>
                      <td>
                        <input
                          className={styles.priceInput}
                          type="number"
                          placeholder={proposed !== null ? String(proposed) : ""}
                          value={overrides[id] ?? ""}
                          onChange={(e) =>
                            setOverrides((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={includes[id] ?? false}
                          onChange={(e) =>
                            setIncludes((prev) => ({ ...prev, [id]: e.target.checked }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
