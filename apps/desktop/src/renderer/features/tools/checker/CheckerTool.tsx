import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Construction, Send } from "lucide-react";
import { MARKET_ICONS } from "~/features/market/market-icons";
import { CHECKER_CATEGORIES, CHECKER_TG_CHANNEL } from "./checker-forms";
import { SteamCheckerPanel } from "./panels/SteamCheckerPanel";
import styles from "./CheckerTool.module.scss";

export const CheckerTool = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const [slug, setSlug] = useState<string | null>(null);

  const current = CHECKER_CATEGORIES.find((c) => c.slug === slug) ?? null;

  if (current && current.slug === "steam") {
    return <SteamCheckerPanel onBack={() => setSlug(null)} />;
  }

  if (current) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}>
          <button type="button" className={styles.back} onClick={() => setSlug(null)}>
            <ArrowLeft size={18} />
            <span>{t("checker.back")}</span>
          </button>
          <h1 className={styles.title}>{current.label}</h1>
        </header>

        <div className={styles.devCard}>
          <span className={styles.devIcon}>
            <Construction size={26} />
          </span>
          <h2 className={styles.devTitle}>{t("checker.dev.title")}</h2>
          <p className={styles.devText}>{t("checker.dev.text")}</p>
          <div className={styles.devActions}>
            <button
              type="button"
              className={styles.devPrimary}
              onClick={() =>
                void window.moderator.app.openExternal(CHECKER_TG_CHANNEL, {
                  forceExternal: true,
                })
              }
            >
              <Send size={16} />
              <span>{t("checker.dev.telegram")}</span>
            </button>
            <button type="button" className={styles.devGhost} onClick={() => setSlug(null)}>
              {t("checker.dev.back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={18} />
          <span>{t("checker.backTools")}</span>
        </button>
        <h1 className={styles.title}>{t("checker.tile.title")}</h1>
      </header>
      <p className={styles.lead}>{t("checker.lead")}</p>

      <div className={styles.grid}>
        {CHECKER_CATEGORIES.map((cat) => {
          const icon = cat.icon ?? MARKET_ICONS[cat.slug];
          return (
            <button
              key={cat.slug}
              type="button"
              className={styles.card}
              onClick={() => setSlug(cat.slug)}
            >
              {icon ? (
                <img className={styles.cardIcon} src={icon} alt="" />
              ) : (
                <span className={styles.cardIcon} />
              )}
              <span className={styles.cardName}>{cat.label}</span>
              {cat.implemented ? (
                <span className={styles.cardOk}>{t("checker.ready")}</span>
              ) : (
                <span className={styles.cardBadge}>{t("checker.soon")}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
