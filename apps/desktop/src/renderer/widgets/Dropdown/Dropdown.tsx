import { type ReactNode, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./Dropdown.module.scss";

export interface DropdownOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface DropdownProps<T extends string | number> {
  value: T;
  options: Array<DropdownOption<T>>;
  onChange: (value: T) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  size = "md",
  className,
  ariaLabel,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const selected = options.find((o) => o.value === value) ?? null;

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div
      className={`${styles.root} ${size === "sm" ? styles.rootSm : ""} ${
        className ?? ""
      }`}
      ref={rootRef}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={styles.value}>
          {selected?.icon}
          <span className={styles.valueLabel}>
            {selected ? selected.label : (placeholder ?? "")}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {options.map((o) => (
            <li key={String(o.value)}>
              <button
                type="button"
                className={`${styles.option} ${
                  o.value === value ? styles.optionActive : ""
                }`}
                onClick={() => pick(o.value)}
              >
                {o.icon}
                <span className={styles.optionLabel}>{o.label}</span>
                {o.value === value && <Check size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
