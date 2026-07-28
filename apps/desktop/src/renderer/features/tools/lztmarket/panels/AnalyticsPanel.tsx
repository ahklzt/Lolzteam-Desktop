import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { MarketItem, MarketPayment } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { formatSum } from "../format";
import styles from "./panels.module.scss";

const MAX_PAGES = 6;

const monthKey = (unix: number): string => {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const AnalyticsPanel = () => {
  const { t, i18n } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const currency = profile?.currency ?? "RUB";
  const userId = profile?.userId ?? null;

  const [payments, setPayments] = useState<MarketPayment[]>([]);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [catMap, setCatMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const allPayments: MarketPayment[] = [];
        let cursor: number | undefined = undefined;
        for (let i = 0; i < MAX_PAGES; i += 1) {
          const res = await window.moderator.market.getPayments({
            showPaymentStats: false,
            operationIdLt: cursor,
          });
          if (!res.ok) {
            if (i === 0) throw new Error("payments");
            break;
          }
          allPayments.push(...res.page.payments);
          if (!res.page.hasNextPage || res.page.lastOperationId === null) break;
          cursor = res.page.lastOperationId;
        }

        const allItems: MarketItem[] = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const res = await window.moderator.market.getUserItems(userId, page, {
            order_by: "pdate_to_down",
          });
          if (!res.ok) break;
          allItems.push(...res.page.items);
          if (!res.page.hasNextPage) break;
        }

        const catRes = await window.moderator.market.getCategories();
        const map: Record<number, string> = {};
        if (catRes.ok) {
          for (const c of catRes.categories) {
            if (typeof c.category_id === "number" && c.category_name) {
              map[c.category_id] = c.category_name;
            }
          }
        }

        if (!alive) return;
        setPayments(allPayments);
        setItems(allItems);
        setCatMap(map);
        setLoading(false);
      } catch {
        if (!alive) return;
        setError(true);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const summary = useMemo(() => {
    let income = 0;
    let outflow = 0;
    for (const p of payments) {
      income += p.incoming_sum || 0;
      outflow += p.outgoing_sum || 0;
    }
    return { income, outflow, net: income - outflow, ops: payments.length };
  }, [payments]);

  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (!p.operation_date) continue;
      const key = monthKey(p.operation_date);
      const net = (p.incoming_sum || 0) - (p.outgoing_sum || 0);
      map.set(key, (map.get(key) ?? 0) + net);
    }
    const keys = Array.from(map.keys()).sort();
    const rows = keys.slice(-12).map((k) => ({ key: k, value: map.get(k) ?? 0 }));
    const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.value)), 0);
    return { rows, max };
  }, [payments]);

  const categories = useMemo(() => {
    const map = new Map<number, number>();
    for (const it of items) {
      map.set(it.category_id, (map.get(it.category_id) ?? 0) + 1);
    }
    const rows = Array.from(map.entries())
      .map(([id, count]) => ({ id, count, name: catMap[id] ?? `#${id}` }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return { rows, max };
  }, [items, catMap]);

  const monthLabel = (key: string): string => {
    const parts = key.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!y || !m) return key;
    try {
      return new Intl.DateTimeFormat(i18n.language || "ru-RU", {
        month: "short",
        year: "2-digit",
      }).format(new Date(y, m - 1, 1));
    } catch {
      return key;
    }
  };

  if (!userId) {
    return <p className={styles.muted}>{t("lztmarket.analytics.needAuth")}</p>;
  }
  if (loading) {
    return (
      <div className={styles.state}>
        <Loader2 className={styles.spin} size={22} />
      </div>
    );
  }
  if (error) {
    return <p className={styles.error}>{t("lztmarket.analytics.error")}</p>;
  }

  return (
    <div className={styles.wallet}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.analytics.income")}</span>
            <span className={styles.cardValue}>{formatSum(summary.income, currency)}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.analytics.outflow")}</span>
            <span className={styles.cardValue}>{formatSum(summary.outflow, currency)}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.analytics.net")}</span>
            <span className={styles.cardValue}>{formatSum(summary.net, currency)}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.analytics.ops")}</span>
            <span className={styles.cardValue}>{summary.ops}</span>
          </div>
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>{t("lztmarket.analytics.monthlyNet")}</h3>
        <p className={styles.muted}>{t("lztmarket.analytics.sampleNote")}</p>
        {months.rows.length === 0 ? (
          <p className={styles.muted}>{t("lztmarket.analytics.noData")}</p>
        ) : (
          <div className={styles.chart}>
            {months.rows.map((r) => {
              const h =
                months.max > 0
                  ? Math.max(4, (Math.abs(r.value) / months.max) * 100)
                  : 4;
              const negative = r.value < 0;
              return (
                <div
                  key={r.key}
                  className={styles.chartCol}
                  title={formatSum(r.value, currency)}
                >
                  <div className={styles.chartBarWrap}>
                    <div
                      className={negative ? styles.chartBarNeg : styles.chartBar}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className={styles.chartLabel}>{monthLabel(r.key)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>{t("lztmarket.analytics.byCategory")}</h3>
        {categories.rows.length === 0 ? (
          <p className={styles.muted}>{t("lztmarket.analytics.noLots")}</p>
        ) : (
          <div className={styles.distList}>
            {categories.rows.map((r) => {
              const w =
                categories.max > 0
                  ? Math.max(3, (r.count / categories.max) * 100)
                  : 3;
              return (
                <div key={r.id} className={styles.distRow}>
                  <span className={styles.distName}>{r.name}</span>
                  <div className={styles.distTrack}>
                    <div className={styles.distFill} style={{ width: `${w}%` }} />
                  </div>
                  <span className={styles.distCount}>{r.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
