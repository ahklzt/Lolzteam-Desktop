import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import styles from "./TitleBar.module.scss";

export const TitleBar = () => {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const wc = window.moderator?.window;
    if (!wc) return;
    void wc.isMaximized().then(setMaximized);
    return wc.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className={styles.bar}>
      <div className={styles.drag} />
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => void window.moderator?.window?.minimize()}
          aria-label="Свернуть"
          title="Свернуть"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => void window.moderator?.window?.toggleMaximize()}
          aria-label={maximized ? "Восстановить" : "Развернуть"}
          title={maximized ? "Восстановить" : "Развернуть"}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.close}`}
          onClick={() => void window.moderator?.window?.close()}
          aria-label="Закрыть"
          title="Закрыть"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
