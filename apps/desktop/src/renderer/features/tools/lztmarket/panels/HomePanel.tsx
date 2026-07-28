import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Gauge, Loader2, Package, Wallet } from "lucide-react";
import type { MarketPayment, MarketRateLimitState } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { useSellerMarketStats } from "~/features/market/market-hooks";
import { formatDate, formatSum } from "../format";
import styles from "./panels.module.scss";

export const HomePanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const currency = profile?.currency ?? "RUB";
  const userId = profile?.userId ?? null;

  const stats = useSellerMarketStats(userId);

  const [recent, setRecent] = useState<MarketPayment[]>([]);
  const [rate, setRate] = useState<MarketRateLimitState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      const [pay, rl] = await Promise.all([
        window.moderator.market.getPayments({ showPaymentStats: false }),
        window.moderator.market.getRateLimitState(),
      ]);
      if (!alive) return;
      if (pay.ok) setRecent(pay.page.payments.slice(0, 5));
      setRate(rl);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const balanceText =
    profile && profile.balance !== null
      ? formatSum(profile.balance, currency)
      : "\u2014";
  const limitText = rate
    ? `${rate.remaining ?? rate.availableTokens}${rate.limit ? ` / ${rate.limit}` : ""}`
    : "\u2014";

  return (
    <div className={styles.home}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardIcon}>
            <Wallet size={18} />
          </span>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.home.balance")}</span>
            <span className={styles.cardValue}>{balanceText}</span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardIcon}>
            <Package size={18} />
          </span>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.home.activeLots")}</span>
            <span className={styles.cardValue}>
              {stats.active !== null ? stats.active : "\u2014"}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardIcon}>
            <CheckCircle2 size={18} />
          </span>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.home.sold")}</span>
            <span className={styles.cardValue}>
              {stats.sold !== null ? stats.sold : "\u2014"}
            </span>
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardIcon}>
            <Gauge size={18} />
          </span>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.home.apiLimit")}</span>
            <span className={styles.cardValue}>{limitText}</span>
          </div>
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>{t("lztmarket.home.recentOps")}</h3>
        {loading ? (
          <div className={styles.state}>
            <Loader2 className={styles.spin} size={20} />
          </div>
        ) : recent.length === 0 ? (
          <p className={styles.muted}>{t("lztmarket.home.noOps")}</p>
        ) : (
          <ul className={styles.opList}>
            {recent.map((p) => {
              const net = (p.incoming_sum || 0) - (p.outgoing_sum || 0);
              const positive = net >= 0;
              return (
                <li key={p.operation_id} className={styles.opRow}>
                  <span className={styles.opDate}>{formatDate(p.operation_date)}</span>
                  <span className={styles.opType}>
                    {p.payment_system || p.operation_type || "\u2014"}
                  </span>
                  <span className={positive ? styles.opIn : styles.opOut}>
                    {positive ? "+" : "\u2212"}
                    {formatSum(Math.abs(net), currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
