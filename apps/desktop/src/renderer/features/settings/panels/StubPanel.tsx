import { useTranslation } from "react-i18next";
import { ExternalLink, Info } from "lucide-react";
import { LZT_CONFIG } from "@lzt/shared";
import styles from "./StubPanel.module.scss";

interface StubPanelProps {
  variant: "planned" | "web";
  url?: string;
}

export const StubPanel = ({ variant, url }: StubPanelProps) => {
  const { t } = useTranslation();
  const isWeb = variant === "web";

  return (
    <div className={styles.stub}>
      <span className={styles.icon}>
        <Info size={22} />
      </span>
      <h3 className={styles.title}>
        {t(isWeb ? "settings.stub.webTitle" : "settings.stub.plannedTitle")}
      </h3>
      <p className={styles.body}>
        {t(isWeb ? "settings.stub.webBody" : "settings.stub.plannedBody")}
      </p>
      {isWeb && (
        <button
          type="button"
          className={styles.link}
          onClick={() =>
            void window.moderator.app.openExternal(url ?? LZT_CONFIG.webUrl)
          }
        >
          <ExternalLink size={16} /> {t("settings.stub.openSite")}
        </button>
      )}
    </div>
  );
};
