import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { mailProviderOptions } from "@lzt/shared";
import { providerIcon } from "./provider-icons";
import styles from "./MailPanel.module.scss";

interface ProviderSelectProps {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

export const ProviderSelect = ({
  value,
  onChange,
  disabled,
}: ProviderSelectProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = mailProviderOptions();

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.key === value) ?? null;
  const selectedIcon = selected ? providerIcon(selected.key) : null;

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className={styles.select} ref={rootRef}>
      <button
        type="button"
        className={styles.selectTrigger}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.selectValue}>
          {selectedIcon ? (
            <img className={styles.selectIcon} src={selectedIcon} alt="" />
          ) : (
            <Globe size={16} className={styles.selectGlobe} />
          )}
          <span>{selected ? selected.label : t("mail.providerAuto")}</span>
        </span>
        <ChevronDown
          size={16}
          className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ""}`}
        />
      </button>

      {open && (
        <ul className={styles.selectMenu} role="listbox">
          <li>
            <button
              type="button"
              className={`${styles.selectOption} ${value === "" ? styles.selectOptionActive : ""}`}
              onClick={() => pick("")}
            >
              <Globe size={16} className={styles.selectGlobe} />
              <span className={styles.selectOptionLabel}>
                {t("mail.providerAuto")}
              </span>
              {value === "" && <Check size={15} />}
            </button>
          </li>
          {options.map((o) => {
            const icon = providerIcon(o.key);
            return (
              <li key={o.key}>
                <button
                  type="button"
                  className={`${styles.selectOption} ${value === o.key ? styles.selectOptionActive : ""}`}
                  onClick={() => pick(o.key)}
                >
                  {icon ? (
                    <img className={styles.selectIcon} src={icon} alt="" />
                  ) : (
                    <Globe size={16} className={styles.selectGlobe} />
                  )}
                  <span className={styles.selectOptionLabel}>{o.label}</span>
                  {value === o.key && <Check size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
