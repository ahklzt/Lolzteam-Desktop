import { Modal } from "~/widgets/Modal/Modal";
import { useConfirmStore } from "./confirm-store";
import styles from "./ConfirmDialog.module.scss";

export const ConfirmDialog = () => {
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmText = useConfirmStore((s) => s.confirmText);
  const cancelText = useConfirmStore((s) => s.cancelText);
  const close = useConfirmStore((s) => s.close);

  return (
    <Modal title={title} open={open} onClose={() => close(false)}>
      <p className={styles.message}>{message}</p>
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => close(false)}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => close(true)}
          autoFocus
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
