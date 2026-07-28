import { Clock } from "lucide-react";
import styles from "./PlannedSettingsPanel.module.scss";

export interface PlannedItem {
  title: string;
  desc: string;
}

interface PlannedSettingsPanelProps {
  items: PlannedItem[];
}

export const PlannedSettingsPanel = ({ items }: PlannedSettingsPanelProps) => {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.title} className={styles.row}>
          <div className={styles.text}>
            <span className={styles.title}>{item.title}</span>
            <span className={styles.desc}>{item.desc}</span>
          </div>
          <span className={styles.badge}>
            <Clock size={13} />
            Скоро
          </span>
        </li>
      ))}
    </ul>
  );
};
