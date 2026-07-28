import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import styles from "./PluginInfoBanner.module.scss";

const AUTHOR_NAME = "ahk_lzt";
const AUTHOR_URL = `${getForumWebBase()}/${AUTHOR_NAME}/`;

interface PluginInfoBannerProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PluginInfoBanner = ({
  icon: Icon,
  title,
  description,
}: PluginInfoBannerProps) => {
  return (
    <div className={styles.banner}>
      <span className={styles.icon}>
        <Icon size={22} />
      </span>
      <div className={styles.text}>
        <div className={styles.top}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.author}
            onClick={() => void window.moderator.app.openExternal(AUTHOR_URL)}
          >
            {AUTHOR_NAME}
            <ExternalLink size={12} />
          </button>
        </div>
        <p className={styles.desc}>{description}</p>
      </div>
    </div>
  );
};
