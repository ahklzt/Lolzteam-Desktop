import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import styles from "./Modal.module.scss";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closable?: boolean;
  wide?: boolean;
  maxWidth?: number;
  headerless?: boolean;
}

export const Modal = ({
  title,
  open,
  onClose,
  children,
  closable = true,
  wide = false,
  maxWidth,
  headerless = false,
}: ModalProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closable, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (closable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ""} ${
          headerless ? styles.modalHeaderless : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
      >
        {headerless ? (
          closable && (
            <button
              type="button"
              className={styles.closeFloating}
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <X size={18} />
            </button>
            )
          ) : (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {closable && (
              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className={`${styles.body} ${headerless ? styles.bodyFlush : ""}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
