import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BarChart3,
  Construction,
  Download,
  Home,
  LineChart,
  Repeat,
  Rocket,
  Store,
  Upload,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./LztMarketTool.module.scss";
import { HomePanel } from "./panels/HomePanel";
import { WalletPanel } from "./panels/WalletPanel";
import { AccountsPanel } from "./panels/AccountsPanel";
import { AnalyticsPanel } from "./panels/AnalyticsPanel";
import { AnalysisPanel } from "./panels/AnalysisPanel";
import { BulkUploadPanel } from "./panels/BulkUploadPanel";
import { AutomationPanel } from "./panels/AutomationPanel";
import { MarketAutoBumpPanel } from "./panels/MarketAutoBumpPanel";
import { SellAccountPanel } from "./panels/SellAccountPanel";
import { ExportPanel } from "./panels/ExportPanel";

type TabId =
  | "home"
  | "analytics"
  | "marketAnalysis"
  | "accounts"
  | "bulkUpload"
  | "sellAccount"
  | "wallet"
  | "automation"
  | "autoBump"
  | "export";

interface TabDef {
  id: TabId;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "home", icon: Home },
  { id: "analytics", icon: BarChart3 },
  { id: "marketAnalysis", icon: LineChart },
  { id: "accounts", icon: UsersRound },
  { id: "bulkUpload", icon: Upload },
  { id: "sellAccount", icon: Store },
  { id: "wallet", icon: Wallet },
  { id: "automation", icon: Repeat },
  { id: "autoBump", icon: Rocket },
  { id: "export", icon: Download },
];

export const LztMarketTool = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("home");

  const current = TABS.find((x) => x.id === tab);
  const activeId: TabId = current?.id ?? "home";
  const CurrentIcon = current?.icon ?? Home;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={18} />
          <span>{t("lztmarket.back")}</span>
        </button>
        <h1 className={styles.title}>{t("lztmarket.tile.title")}</h1>
      </header>

      <nav className={styles.tabs}>
        {TABS.map((x) => {
          const Icon = x.icon;
          const isActive = x.id === tab;
          return (
            <button
              key={x.id}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              onClick={() => setTab(x.id)}
            >
              <Icon size={15} />
              <span>{t(`lztmarket.tabs.${x.id}`)}</span>
            </button>
          );
        })}
      </nav>

      <section className={styles.panel}>
        {activeId === "home" ? (
          <HomePanel />
        ) : activeId === "wallet" ? (
          <WalletPanel />
        ) : activeId === "accounts" ? (
          <AccountsPanel />
        ) : activeId === "analytics" ? (
          <AnalyticsPanel />
        ) : activeId === "marketAnalysis" ? (
          <AnalysisPanel />
        ) : activeId === "bulkUpload" ? (
          <BulkUploadPanel />
        ) : activeId === "sellAccount" ? (
          <SellAccountPanel />
        ) : activeId === "automation" ? (
          <AutomationPanel />
        ) : activeId === "autoBump" ? (
          <MarketAutoBumpPanel />
        ) : activeId === "export" ? (
          <ExportPanel />
        ) : (
          <>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon}>
                <CurrentIcon size={20} />
              </span>
              <div className={styles.panelText}>
                <h2 className={styles.panelTitle}>{t(`lztmarket.tabs.${activeId}`)}</h2>
                <p className={styles.panelDesc}>{t(`lztmarket.desc.${activeId}`)}</p>
              </div>
            </div>

            <div className={styles.soon}>
              <Construction size={16} />
              <span>{t("lztmarket.soon")}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
