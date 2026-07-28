import { type ReactNode } from "react";
import styles from "./Toggle.module.scss";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  ariaLabel?: string;
}

export const Toggle = ({
  checked,
  onChange,
  disabled,
  label,
  ariaLabel,
}: ToggleProps) => {
  return (
    <label className={`${styles.root} ${disabled ? styles.disabled : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={`${styles.track} ${checked ? styles.trackOn : ""}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className={styles.thumb} />
      </button>
      {label != null && <span className={styles.label}>{label}</span>}
    </label>
  );
};
