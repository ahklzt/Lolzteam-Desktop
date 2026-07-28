import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Pencil, X } from "lucide-react";
import type { MarketItem } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { formatDate, formatSum, toMarketCurrency } from "../format";
import styles from "./panels.module.scss";

type LoadState = "idle" | "loading" | "loadingMore" | "error" | "ready";

export const AccountsPanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const currency = profile?.currency ?? "RUB";
  const userId = profile?.userId ?? null;

  const [items, setItems] = useState<MarketItem[]>([]);
  const [catMap, setCatMap] = useState<Record<number, string>>({});
  const [state, setState] = useState<LoadState>("idle");
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reqRef = useRef(0);
  const pageRef = useRef(1);

  const load = useCallback(
    async (targetPage: number, mode: "reset" | "more") => {
      if (!userId) return;
      const reqId = ++reqRef.current;
      setState(mode === "reset" ? "loading" : "loadingMore");
      const res = await window.moderator.market.getUserItems(userId, targetPage, {
        order_by: "pdate_to_down",
      });
      if (reqId !== reqRef.current) return;
      if (!res.ok) {
        setState("error");
        return;
      }
      setHasNext(res.page.hasNextPage);
      setTotal(res.page.totalItems);
      pageRef.current = res.page.page || targetPage;
      setItems((prev) => {
        if (mode === "reset") return res.page.items;
        const seen = new Set(prev.map((it) => it.item_id));
        return [
          ...prev,
          ...res.page.items.filter((it) => !seen.has(it.item_id)),
        ];
      });
      setState("ready");
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setState("idle");
      return;
    }
    void load(1, "reset");
  }, [userId, load]);

  useEffect(() => {
    let alive = true;
    void window.moderator.market.getCategories().then((res) => {
      if (!alive || !res.ok) return;
      const map: Record<number, string> = {};
      for (const c of res.categories) {
        if (typeof c.category_id === "number" && c.category_name) {
          map[c.category_id] = c.category_name;
        }
      }
      setCatMap(map);
    });
    return () => {
      alive = false;
    };
  }, []);

  const startEdit = (it: MarketItem) => {
    setNotice(null);
    setEditingId(it.item_id);
    setDraft(it.price !== undefined ? String(it.price) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const saveEdit = async (it: MarketItem) => {
    const price = Number(draft);
    if (!Number.isFinite(price) || price <= 0) {
      setNotice(t("lztmarket.accounts.invalidPrice"));
      return;
    }
    const confirmed = await askConfirm({
      title: t("lztmarket.accounts.confirmTitle"),
      message: `${t("lztmarket.accounts.confirmMsg")} #${it.item_id} \u2192 ${formatSum(price, currency)}`,
      confirmText: t("lztmarket.accounts.save"),
    });
    if (!confirmed) return;
    setSavingId(it.item_id);
    setNotice(null);
    const res = await window.moderator.market.editPrice({
      itemId: it.item_id,
      price,
      currency: toMarketCurrency(it.price_currency ?? currency),
    });
    setSavingId(null);
    if (!res.ok) {
      setNotice(t("lztmarket.accounts.saveError"));
      return;
    }
    const newPrice = res.item?.price ?? price;
    setItems((prev) =>
      prev.map((row) =>
        row.item_id === it.item_id ? { ...row, price: newPrice } : row,
      ),
    );
    setEditingId(null);
    setDraft("");
    setNotice(t("lztmarket.accounts.saved"));
  };

  if (!userId) {
    return <p className={styles.muted}>{t("lztmarket.accounts.needAuth")}</p>;
  }

  return (
    <div className={styles.wallet}>
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          {t("lztmarket.accounts.myLots")}
          {total ? ` (${total})` : ""}
        </h3>
        {notice ? <p className={styles.muted}>{notice}</p> : null}
      </div>

      {state === "error" ? (
        <div className={styles.state}>
          <p className={styles.error}>{t("lztmarket.accounts.loadError")}</p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => void load(1, "reset")}
          >
            {t("lztmarket.accounts.retry")}
          </button>
        </div>
      ) : state === "loading" || state === "idle" ? (
        <div className={styles.state}>
          <Loader2 className={styles.spin} size={22} />
        </div>
      ) : items.length === 0 ? (
        <p className={styles.muted}>{t("lztmarket.accounts.empty")}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("lztmarket.accounts.columns.item")}</th>
                  <th>{t("lztmarket.accounts.columns.category")}</th>
                  <th>{t("lztmarket.accounts.columns.state")}</th>
                  <th>{t("lztmarket.accounts.columns.date")}</th>
                  <th>{t("lztmarket.accounts.columns.price")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const editing = editingId === it.item_id;
                  const saving = savingId === it.item_id;
                  return (
                    <tr key={it.item_id}>
                      <td>
                        <div className={styles.itemTitle}>
                          {it.title || it.title_en || `#${it.item_id}`}
                        </div>
                        <div className={styles.itemId}>#{it.item_id}</div>
                      </td>
                      <td>{catMap[it.category_id] ?? String(it.category_id)}</td>
                      <td>{it.item_state ?? "\u2014"}</td>
                      <td>
                        {it.published_date
                          ? formatDate(it.published_date)
                          : "\u2014"}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            className={styles.priceInput}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            disabled={saving}
                            autoFocus
                          />
                        ) : it.price !== undefined ? (
                          formatSum(it.price, it.price_currency || currency)
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => void saveEdit(it)}
                              disabled={saving}
                              title={t("lztmarket.accounts.save")}
                            >
                              {saving ? (
                                <Loader2 className={styles.spin} size={15} />
                              ) : (
                                <Check size={15} />
                              )}
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={cancelEdit}
                              disabled={saving}
                              title={t("lztmarket.accounts.cancel")}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => startEdit(it)}
                            title={t("lztmarket.accounts.editPrice")}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
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
              onClick={() => void load(pageRef.current + 1, "more")}
              disabled={state === "loadingMore"}
            >
              {state === "loadingMore" ? (
                <Loader2 className={styles.spin} size={16} />
              ) : (
                t("lztmarket.accounts.loadMore")
              )}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};
