import type { LucideIcon } from "lucide-react";
import type { FaqTab } from "./pages";
import styles from "./FaqSidebar.module.scss";

export interface FaqNavItem {
  id: FaqTab;
  label: string;
  icon: LucideIcon;
}

interface FaqSidebarProps {
  items: FaqNavItem[];
  active: FaqTab;
  onSelect: (id: FaqTab) => void;
}

export const FaqSidebar = ({ items, active, onSelect }: FaqSidebarProps) => (
  <nav className={styles.nav} aria-label="FAQ">
    {items.map(({ id, label, icon: Icon }) => {
      const isActive = active === id;
      return (
        <button
          key={id}
          type="button"
          className={`${styles.item} ${isActive ? styles.active : ""}`}
          onClick={() => onSelect(id)}
          aria-current={isActive ? "page" : undefined}
        >
          <span className={styles.itemIcon}>
            <Icon size={18} />
          </span>
          <span className={styles.itemLabel}>{label}</span>
        </button>
      );
    })}
  </nav>
);
