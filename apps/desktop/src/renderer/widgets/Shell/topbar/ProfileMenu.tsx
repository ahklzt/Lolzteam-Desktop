import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  User,
  ShoppingBag,
  MessageSquareText,
  FileText,
  LifeBuoy,
  Bookmark,
  TrendingUp,
  HelpCircle,
  Languages,
  Settings,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LZT_CONFIG, type UserProfile } from "@lzt/shared";
import { useSession } from "~/stores/session";
import { useViewStore } from "~/stores/view";
import { useMarketRoute } from "~/stores/marketRoute";
import { useForumStore } from "~/features/forum/forum-store";
import { useSettingsRoute } from "~/stores/settingsRoute";
import { useFaqRoute } from "~/stores/faqRoute";
import { TransferModal } from "~/features/market/TransferModal";
import { Popover } from "./Popover";
import { AnimatedBalance } from "~/lib/AnimatedBalance";
import styles from "./navBar.module.scss";
import { useAvatarOverride } from "~/lib/avatar";
import { useLocalUniq } from "~/lib/localUniq";

const WEB = LZT_CONFIG.webUrl;
const MARKET = LZT_CONFIG.marketWebUrl;

const formatBalance = (profile: UserProfile, locale: string): string | null => {
  if (profile.balance == null) return null;
  const currency = profile.currency ?? "RUB";
  try {
    return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(profile.balance);
  } catch {
    return `${profile.balance.toFixed(2)} ${currency}`;
  }
};

const ManageRow = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) => (
  <button type="button" className={styles.menuItem} onClick={onClick}>
    <Icon size={18} className={styles.menuItemIcon} />
    <span className={styles.menuLabel}>{label}</span>
  </button>
);

export const ProfileMenu = ({ profile }: { profile: UserProfile }) => {
  const avatarOverride = useAvatarOverride();
  const localUniq = useLocalUniq();
  const { t, i18n } = useTranslation();
  const logout = useSession((s) => s.logout);
  const setView = useViewStore((s) => s.setView);
  const openMarketPage = useMarketRoute((s) => s.open);
  const selectForumSection = useForumStore((s) => s.selectSection);
  const openSettingsTab = useSettingsRoute((s) => s.open);
  const openFaq = useFaqRoute((s) => s.open);
  const [transferOpen, setTransferOpen] = useState(false);

  const openExternal = (url: string) => void window.moderator.app.openExternal(url);
  const balance = formatBalance(profile, i18n.language);

  const goMarket = (page: "myAccounts" | "myPurchases") => {
    setView("market");
    openMarketPage(page);
  };

  const toggleLang = () => {
    void i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");
  };

  return (
    <>
      <Popover
        align="right"
        panelClassName={styles.profilePanel}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className={styles.profileTrigger}
            onClick={toggle}
          >
            {(avatarOverride ?? profile.avatarUrl) ? (
              <img className={styles.avatar} src={avatarOverride ?? profile.avatarUrl} alt="" />
            ) : (
              <span className={styles.avatarFallback}>
                {profile.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span
              className={styles.username}
              style={
                localUniq
                  ? localUniq.usernameStyle
                  : profile.usernameColor
                    ? { color: profile.usernameColor }
                    : undefined
              }
            >
              {profile.username}
            </span>
            <ChevronDown
              size={14}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            />
          </button>
        )}
      >
        {({ close }) => (
          <>
            {}
            <div className={styles.profHeader}>
              {(avatarOverride ?? profile.avatarUrl) ? (
                <img className={styles.profAvatar} src={avatarOverride ?? profile.avatarUrl} alt="" />
              ) : (
                <span className={styles.profAvatarFallback}>
                  {profile.username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className={styles.profInfo}>
                <span
                  className={styles.profName}
                  style={
                    localUniq
                      ? localUniq.usernameStyle
                      : profile.usernameColor
                        ? { color: profile.usernameColor }
                        : undefined
                  }
                >
                  {profile.username}
                </span>
                <button
                  type="button"
                  className={styles.profStatus}
                  onClick={() => {
                    openExternal(`${WEB}/members/${profile.userId}/`);
                    close();
                  }}
                >
                  {t("topbar.profile.goProfile")}
                </button>
              </div>
            </div>

            {}
            {balance && profile.balance != null && (
              <div className={styles.profBalanceRow} data-streamer="hideBalance">
                <span className={styles.profBalanceLabel}>
                  {t("topbar.profile.balance")}
                </span>
                <AnimatedBalance
                  className={styles.profBalanceVal}
                  value={profile.balance}
                  currency={profile.currency ?? "RUB"}
                  locale={i18n.language === "ru" ? "ru-RU" : "en-US"}
                />
              </div>
            )}
            <div className={styles.profActions} data-streamer="hideBalance">
              <button
                type="button"
                className={`${styles.profActionBtn} ${styles.profActionPrimary}`}
                onClick={() => {
                  openExternal(`${MARKET}/payment/balance/deposit`);
                  close();
                }}
              >
                {t("topbar.profile.deposit")}
              </button>
              <button
                type="button"
                className={styles.profActionBtn}
                onClick={() => {
                  openExternal(`${MARKET}/balance/payout`);
                  close();
                }}
              >
                {t("topbar.profile.payout")}
              </button>
              <button
                type="button"
                className={styles.profActionBtn}
                onClick={() => {
                  setTransferOpen(true);
                  close();
                }}
              >
                {t("topbar.profile.transfer")}
              </button>
            </div>

            {}
            <div className={styles.manageList}>
              <ManageRow
                icon={User}
                label={t("topbar.menu.myAccounts")}
                onClick={() => {
                  goMarket("myAccounts");
                  close();
                }}
              />
              <ManageRow
                icon={ShoppingBag}
                label={t("topbar.menu.myPurchases")}
                onClick={() => {
                  goMarket("myPurchases");
                  close();
                }}
              />
              <ManageRow
                icon={FileText}
                label={t("topbar.menu.myThreads")}
                onClick={() => {
                  setView("forum");
                  selectForumSection({ type: "my" });
                  close();
                }}
              />
              <ManageRow
                icon={MessageSquareText}
                label={t("topbar.menu.myMessages")}
                onClick={() => {
                  setView("forum");
                  selectForumSection({ type: "userPosts" });
                  close();
                }}
              />
              <ManageRow
                icon={LifeBuoy}
                label={t("topbar.menu.myTickets")}
                onClick={() => {
                  openExternal(`${WEB}/support-tickets/`);
                  close();
                }}
              />
              <ManageRow
                icon={Bookmark}
                label={t("topbar.menu.myBookmarks")}
                onClick={() => {
                  setView("forum");
                  selectForumSection({ type: "bookmarks" });
                  close();
                }}
              />
              <ManageRow
                icon={TrendingUp}
                label={t("topbar.menu.statusUp")}
                onClick={() => {
                  setView("settings");
                  openSettingsTab("status");
                  close();
                }}
              />
              <ManageRow
                icon={HelpCircle}
                label={t("topbar.menu.faq")}
                onClick={() => {
                  openFaq("faq");
                  setView("faq");
                  close();
                }}
              />
              <ManageRow
                icon={Languages}
                label={t("topbar.menu.switchLang")}
                onClick={() => {
                  toggleLang();
                  close();
                }}
              />
            </div>

            {}
            <div className={styles.profFooter}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setView("settings");
                  close();
                }}
              >
                <Settings size={18} className={styles.menuItemIcon} />
                <span className={styles.menuLabel}>
                  {t("topbar.profile.settings")}
                </span>
              </button>
              <button
                type="button"
                className={styles.logout}
                onClick={() => void logout()}
                title={t("topbar.logout")}
              >
                <LogOut size={16} />
              </button>
            </div>
          </>
        )}
      </Popover>

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
};
