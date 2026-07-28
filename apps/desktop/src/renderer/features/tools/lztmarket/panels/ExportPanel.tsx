import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import type { MarketItem, MarketPayment } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { formatDate } from "../format";
import styles from "./panels.module.scss";

type Dataset = "items" | "payments";
type ExportFormat = "csv" | "json";

const MAX_PAGES = 20;

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (headers: string[], rows: unknown[][]): string => {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
};

const downloadFile = (
  filename: string,
  content: string,
  mime: string,
): void => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ITEM_HEADERS = [
  "item_id",
  "category_id",
  "title",
  "price",
  "rub_price",
  "currency",
  "state",
  "published_date",
  "view_count",
];

const itemRow = (it: MarketItem): unknown[] => [
  it.item_id,
  it.category_id,
  it.title ?? "",
  it.price ?? "",
  it.rub_price ?? "",
  it.price_currency ?? "",
  it.item_state ?? "",
  it.published_date ? formatDate(it.published_date) : "",
  it.view_count ?? "",
];

const PAYMENT_HEADERS = [
  "operation_id",
  "operation_date",
  "operation_type",
  "incoming_sum",
  "outgoing_sum",
  "item_id",
  "wallet",
  "payment_system",
  "is_finished",
  "is_hold",
];

const paymentRow = (p: MarketPayment): unknown[] => [
  p.operation_id,
  p.operation_date ? formatDate(p.operation_date) : "",
  p.operation_type,
  p.incoming_sum,
  p.outgoing_sum,
  p.item_id ?? "",
  p.wallet ?? "",
  p.payment_system ?? "",
  p.is_finished,
  p.is_hold,
];

export const ExportPanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const userId = profile?.userId ?? null;

  const [dataset, setDataset] = useState<Dataset>("items");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const collectItems = useCallback(async (): Promise<MarketItem[]> => {
    if (!userId) throw new Error("no_auth");
    const items: MarketItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await window.moderator.market.getUserItems(userId, page, {
        order_by: "pdate_to_down",
      });
      if (!res.ok) {
        if (page === 1) throw new Error("fetch");
        break;
      }
      items.push(...res.page.items);
      if (!res.page.hasNextPage) break;
    }
    return items;
  }, [userId]);

  const collectPayments = useCallback(async (): Promise<MarketPayment[]> => {
    const payments: MarketPayment[] = [];
    let cursor: number | undefined;
    for (let i = 0; i < MAX_PAGES; i += 1) {
      const res = await window.moderator.market.getPayments({
        operationIdLt: cursor,
        showPaymentStats: false,
      });
      if (!res.ok) {
        if (i === 0) throw new Error("fetch");
        break;
      }
      payments.push(...res.page.payments);
      if (!res.page.hasNextPage || res.page.lastOperationId === null) break;
      cursor = res.page.lastOperationId;
    }
    return payments;
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    try {
      if (dataset === "items" && !userId) {
        setNotice(t("lztmarket.export.needAuth"));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (dataset === "items") {
        const items = await collectItems();
        if (items.length === 0) {
          setNotice(t("lztmarket.export.empty"));
          return;
        }
        if (format === "json") {
          downloadFile(
            `lzt-items-${stamp}.json`,
            JSON.stringify(items, null, 2),
            "application/json",
          );
        } else {
          downloadFile(
            `lzt-items-${stamp}.csv`,
            toCsv(ITEM_HEADERS, items.map(itemRow)),
            "text/csv",
          );
        }
        setNotice(t("lztmarket.export.done", { count: items.length }));
      } else {
        const payments = await collectPayments();
        if (payments.length === 0) {
          setNotice(t("lztmarket.export.empty"));
          return;
        }
        if (format === "json") {
          downloadFile(
            `lzt-payments-${stamp}.json`,
            JSON.stringify(payments, null, 2),
            "application/json",
          );
        } else {
          downloadFile(
            `lzt-payments-${stamp}.csv`,
            toCsv(PAYMENT_HEADERS, payments.map(paymentRow)),
            "text/csv",
          );
        }
        setNotice(t("lztmarket.export.done", { count: payments.length }));
      }
    } catch {
      setNotice(t("lztmarket.export.error"));
    } finally {
      setRunning(false);
    }
  }, [collectItems, collectPayments, dataset, format, t, userId]);

  return (
    <div className={styles.export}>
      <p className={styles.securityNote}>{t("lztmarket.export.note")}</p>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.export.dataset")}
          </span>
          <select
            className={styles.select}
            value={dataset}
            onChange={(e) =>
              setDataset(e.target.value === "payments" ? "payments" : "items")
            }
          >
            <option value="items">
              {t("lztmarket.export.datasets.items")}
            </option>
            <option value="payments">
              {t("lztmarket.export.datasets.payments")}
            </option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("lztmarket.export.format")}
          </span>
          <select
            className={styles.select}
            value={format}
            onChange={(e) =>
              setFormat(e.target.value === "json" ? "json" : "csv")
            }
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>
      <div className={styles.applyBar}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => void run()}
          disabled={running}
        >
          {running ? (
            <Loader2 size={15} className={styles.spin} />
          ) : (
            <Download size={15} />
          )}
          {running
            ? t("lztmarket.export.running")
            : t("lztmarket.export.run")}
        </button>
        {notice ? <span className={styles.muted}>{notice}</span> : null}
      </div>
    </div>
  );
};
