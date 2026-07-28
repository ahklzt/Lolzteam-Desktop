import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import type { MarketItem } from "@lzt/shared";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { AccountCard } from "../AccountCard";
import { BuyModal } from "../BuyModal";
import styles from "../MarketView.module.scss";

type Status = "loading" | "error" | "ready";

export const CartPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [busyId, setBusyId] = useState(0);
  const [buyItem, setBuyItem] = useState<MarketItem | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await window.moderator.market.getCart(1);
    if (!res.ok) {
      setStatus("error");
      return;
    }
    setItems(res.page.items);
    setStatus("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (itemId: number) => {
    setBusyId(itemId);
    const res = await window.moderator.market.removeFromCart(itemId);
    setBusyId(0);
    if (res.ok) setItems((prev) => prev.filter((it) => it.item_id !== itemId));
  };

  const clear = async () => {
    const confirmed = await askConfirm({ message: t("market.cart.clearConfirm") });
    if (!confirmed) return;
    const res = await window.moderator.market.clearCart();
    if (res.ok) setItems([]);
  };

  if (status === "loading") {
    return (
      <div className={styles.state}>
        <Loader2 className={styles.spin} size={26} />
        <p>{t("market.cart.loading")}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.state}>
        <p className={styles.errorText}>{t("market.cart.error")}</p>
        <button type="button" className={styles.retry} onClick={() => void load()}>
          {t("market.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.cartPage}>
      <div className={styles.cartHead}>
        <h1 className={styles.cartTitle}>
          <ShoppingCart size={18} />
          {t("market.cart.title")}
          <span className={styles.cartCount}>{items.length}</span>
        </h1>
        {items.length > 0 ? (
          <button type="button" className={styles.cartClear} onClick={() => void clear()}>
            <Trash2 size={14} />
            {t("market.cart.clear")}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className={styles.cartEmpty}>{t("market.cart.empty")}</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <div key={item.item_id} className={styles.cartRow}>
              <AccountCard item={item} />
              <div className={styles.cartRowActions}>
                <button
                  type="button"
                  className={styles.cartBuy}
                  onClick={() => setBuyItem(item)}
                >
                  {t("market.item.buy")}
                </button>
                <button
                  type="button"
                  className={styles.cartRemove}
                  disabled={busyId === item.item_id}
                  onClick={() => void remove(item.item_id)}
                >
                  {busyId === item.item_id ? (
                    <Loader2 className={styles.spin} size={14} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {t("market.cart.remove")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BuyModal
        itemId={buyItem?.item_id ?? 0}
        open={buyItem !== null}
        onClose={() => setBuyItem(null)}
        onPurchased={() => {
          setBuyItem(null);
          void load();
        }}
      />
    </div>
  );
};

export default CartPage;
