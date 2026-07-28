import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastItem } from "~/stores/toast";
import styles from "./Toaster.module.scss";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const ToastCard = ({ toast }: { toast: ToastItem }) => {
  const dismiss = useToastStore((s) => s.dismiss);
  const [leaving, setLeaving] = useState(false);
  const Icon = ICONS[toast.kind];

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 2800);
    const removeTimer = setTimeout(() => dismiss(toast.id), 3200);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, dismiss]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.kind]} ${leaving ? styles.leaving : ""}`}
      role="status"
    >
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{toast.title}</div>
        {toast.message && <div className={styles.message}>{toast.message}</div>}
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={() => dismiss(toast.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.wrap}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
