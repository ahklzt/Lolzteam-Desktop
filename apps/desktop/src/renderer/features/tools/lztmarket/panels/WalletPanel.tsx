import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { MarketPayment } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { formatDate, formatSum } from "../format";
import styles from "./panels.module.scss";

type LoadState = "loading" | "loadingMore" | "error" | "ready";

export const WalletPanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const currency = profile?.currency ?? "RUB";

  const [rows, setRows] = useState<MarketPayment[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [hasNext, setHasNext] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const reqRef = useRef(0);

  const load = useCallback(
    async (mode: "reset" | "more") => {
      const reqId = ++reqRef.current;
      setState(mode === "reset" ? "loading" : "loadingMore");
      const res = await window.moderator.market.getPayments({
        showPaymentStats: mode === "reset",
        operationIdLt: mode === "more" && lastId !== null ? lastId : undefined,
      });
      if (reqId !== reqRef.current) return;
      if (!res.ok) {
        setState("error");
        return;
      }
      setHasNext(res.page.hasNextPage);
      setLastId(res.page.lastOperationId);
      if (mode === "reset") {
        setTotal(res.page.totalPaymentsSum);
        setRows(res.page.payments);
      } else {
        setRows((prev) => {
          const seen = new Set(prev.map((p) => p.operation_id));
          return [
            ...prev,
            ...res.page.payments.filter((p) => !seen.has(p.operation_id)),
          ];
        });
      }
      setState("ready");
    },
    [lastId],
  );

  useEffect(() => {
    void load("reset");
  }, []);

  const balanceText =
    profile && profile.balance !== null
      ? formatSum(profile.balance, currency)
      : "\u2014";

  return (
    <div className={styles.wallet}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>{t("lztmarket.wallet.balance")}</span>
            <span className={styles.cardValue}>{balanceText}</span>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>
              {t("lztmarket.wallet.totalAllTime")}
            </span>
            <span className={styles.cardValue}>
              {total !== null ? formatSum(total, currency) : "\u2014"}
            </span>
          </div>
        </div>
      </div>

      <h3 className={styles.blockTitle}>{t("lztmarket.wallet.history")}</h3>

      {state === "error" ? (
        <div className={styles.state}>
          <p className={styles.error}>{t("lztmarket.wallet.error")}</p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => void load("reset")}
          >
            {t("lztmarket.wallet.retry")}
          </button>
        </div>
      ) : state === "loading" ? (
        <div className={styles.state}>
          <Loader2 className={styles.spin} size={22} />
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>{t("lztmarket.wallet.empty")}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("lztmarket.wallet.columns.date")}</th>
                  <th>{t("lztmarket.wallet.columns.type")}</th>
                  <th>{t("lztmarket.wallet.columns.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const net = (p.incoming_sum || 0) - (p.outgoing_sum || 0);
                  const positive = net >= 0;
                  return (
                    <tr key={p.operation_id}>
                      <td>{formatDate(p.operation_date)}</td>
                      <td>{p.payment_system || p.operation_type || "\u2014"}</td>
                      <td className={positive ? styles.opIn : styles.opOut}>
                        {positive ? "+" : "\u2212"}
                        {formatSum(Math.abs(net), currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasNext ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => void load("more")}
              disabled={state === "loadingMore"}
            >
              {state === "loadingMore" ? (
                <Loader2 className={styles.spin} size={16} />
              ) : (
                t("lztmarket.wallet.loadMore")
              )}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};
