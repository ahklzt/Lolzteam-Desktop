import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck, ShoppingCart, X } from "lucide-react";
import {
  LZT_CONFIG,
  type MarketPurchaseError,
  type MarketPurchasePreview,
  type MarketPurchaseSuccess,
} from "@lzt/shared";
import styles from "./BuyModal.module.scss";
import { useSession } from "~/stores/session";

type Stage = "preview" | "loading" | "checking" | "done" | "failed";

interface Props {
  itemId: number;
  open: boolean;
  onClose: () => void;
  onPurchased?: (purchase: MarketPurchaseSuccess) => void;
}

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export const BuyModal = ({ itemId, open, onClose, onPurchased }: Props) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>("loading");
  const [preview, setPreview] = useState<MarketPurchasePreview | null>(null);
  const [purchase, setPurchase] = useState<MarketPurchaseSuccess | null>(null);
  const [error, setError] = useState<MarketPurchaseError | null>(null);
  const [reasonText, setReasonText] = useState("");

  const loadPreview = useCallback(async () => {
    if (!itemId) return;
    setStage("loading");
    setError(null);
    setReasonText("");
    setPurchase(null);
    const res = await window.moderator.market.getPurchasePreview(itemId);
    if (!res.ok) {
      setError(res.error ?? null);
      setReasonText(res.message ?? t(`market.buy.reason.${res.reason}`));
      setStage("failed");
      return;
    }
    setPreview(res.preview);
    setStage("preview");
  }, [itemId, t]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
  }, [open, loadPreview]);

  if (!open) return null;

  const errorText = (): string => {
    if (!error) return reasonText || t("market.buy.unknownError");
    if (error.kind === "unknown") return error.message || t("market.buy.unknownError");
    return t(`market.buy.errors.${error.kind}`);
  };

  const depositUrl = (): string => {
    const amount = error?.depositAmount;
    const base = `${LZT_CONFIG.marketWebUrl}/balance/deposit`;
    return amount ? `${base}?amount=${amount}` : base;
  };

  const buy = async () => {
    if (!preview) return;
    setStage("checking");
    setError(null);
    setReasonText("");
    const res = await window.moderator.market.fastBuy(preview.itemId, preview.price);
    if (!res.ok) {
      setError(res.error ?? null);
      setReasonText(res.message ?? t(`market.buy.reason.${res.reason}`));
      setStage("failed");
      return;
    }
    setPurchase(res.purchase);
    setStage("done");
    void useSession.getState().refresh();
    onPurchased?.(res.purchase);
  };

  const priceText = preview
    ? `${nf.format(preview.price)} ${preview.currency}`.trim()
    : "";

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}>
            <ShoppingCart size={16} />
            {t("market.buy.title")}
          </span>
          <button type="button" className={styles.close} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {stage === "loading" ? (
          <div className={styles.center}>
            <Loader2 className={styles.spin} size={24} />
            <p>{t("market.buy.loading")}</p>
          </div>
        ) : null}

        {stage === "checking" ? (
          <div className={styles.center}>
            <Loader2 className={styles.spin} size={24} />
            <p className={styles.waitTitle}>{t("market.buy.waitTitle")}</p>
            <p className={styles.waitText}>{t("market.buy.waitText")}</p>
          </div>
        ) : null}

        {stage === "preview" && preview ? (
          <div className={styles.body}>
            <div className={styles.previewTitle}>{preview.title}</div>
            <div className={styles.price}>{priceText}</div>
            <div className={styles.grid}>
              {preview.categoryTitle ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.category")}</span>
                  <span className={styles.cellValue}>{preview.categoryTitle}</span>
                </div>
              ) : null}
              {preview.itemOriginPhrase ?? preview.itemOrigin ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.origin")}</span>
                  <span className={styles.cellValue}>
                    {preview.itemOriginPhrase ?? preview.itemOrigin}
                  </span>
                </div>
              ) : null}
              {preview.emailType ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.email")}</span>
                  <span className={styles.cellValue}>{preview.emailType}</span>
                </div>
              ) : null}
              {preview.sellerUsername ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.seller")}</span>
                  <span className={styles.cellValue}>{preview.sellerUsername}</span>
                </div>
              ) : null}
              <div className={styles.cell}>
                <span className={styles.cellLabel}>{t("market.buy.guarantee")}</span>
                <span className={styles.cellValue}>
                  {preview.guaranteePhrase ??
                    (preview.hasGuarantee ? t("market.item.yes") : t("market.item.no"))}
                </span>
              </div>
              <div className={styles.cell}>
                <span className={styles.cellLabel}>{t("market.buy.validation")}</span>
                <span className={styles.cellValue}>
                  {preview.canValidateAccount
                    ? t("market.buy.validationOn")
                    : t("market.buy.validationOff")}
                </span>
              </div>
            </div>

            {preview.descriptionPlain ? (
              <p className={styles.description}>{preview.descriptionPlain}</p>
            ) : null}

            {preview.requireVideoRecording ? (
              <p className={styles.notice}>{t("market.buy.errors.video_required")}</p>
            ) : null}

            <div className={styles.actions}>
              <button type="button" className={styles.buy} onClick={() => void buy()}>
                <ShieldCheck size={16} />
                {t("market.buy.confirm")} · {priceText}
              </button>
              <button type="button" className={styles.cancel} onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {stage === "failed" ? (
          <div className={styles.body}>
            <p className={styles.errorText}>{errorText()}</p>
            {error?.kind === "not_enough_balance" ? (
              <button
                type="button"
                className={styles.deposit}
                onClick={() => void window.moderator.app.openExternal(depositUrl())}
              >
                {t("market.buy.deposit")}
              </button>
            ) : null}
            <div className={styles.actions}>
              <button type="button" className={styles.buy} onClick={() => void loadPreview()}>
                {t("market.retry")}
              </button>
              <button type="button" className={styles.cancel} onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : null}

        {stage === "done" && purchase ? (
          <div className={styles.body}>
            <p className={styles.successText}>{t("market.buy.success")}</p>
            <div className={styles.credentials}>
              {purchase.login ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.login")}</span>
                  <span className={styles.cellValue}>{purchase.login}</span>
                </div>
              ) : null}
              {purchase.password ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.password")}</span>
                  <span className={styles.cellValue}>{purchase.password}</span>
                </div>
              ) : null}
              {purchase.emailLogin ? (
                <div className={styles.cell}>
                  <span className={styles.cellLabel}>{t("market.buy.emailLogin")}</span>
                  <span className={styles.cellValue}>{purchase.emailLogin}</span>
                </div>
              ) : null}
            </div>
            {purchase.adviceToChangePassword ? (
              <p className={styles.notice}>{t("market.buy.changePassword")}</p>
            ) : null}
            <div className={styles.actions}>
              <button type="button" className={styles.buy} onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BuyModal;
