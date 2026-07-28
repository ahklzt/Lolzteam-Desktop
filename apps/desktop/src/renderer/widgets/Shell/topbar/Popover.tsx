import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./navBar.module.scss";

interface PopoverApi {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

interface PopoverProps {
  trigger: (api: PopoverApi) => ReactNode;
  children: (api: PopoverApi) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
  onOpen?: () => void;
}

export const Popover = ({
  trigger,
  children,
  align = "left",
  panelClassName,
  onOpen,
}: PopoverProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  useEffect(() => {
    if (open) onOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const api: PopoverApi = { open, toggle, close };

  return (
    <div className={styles.popover} ref={rootRef}>
      {trigger(api)}
      {open && (
        <div
          className={`${styles.panel} ${
            align === "right" ? styles.panelRight : ""
          } ${panelClassName ?? ""}`}
        >
          {children(api)}
        </div>
      )}
    </div>
  );
};
