import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { LZT_CONFIG } from "@lzt/shared";
import { CURRENT_VERSION } from "~/data/changelog";
import { useSession } from "~/stores/session";
import { useViewStore } from "~/stores/view";
import { ChangelogModal } from "~/widgets/Changelog/ChangelogModal";
import { Logo } from "./Logo";
import { PingPill } from "./PingPill";
import {
  ServicesDropdown,
  SocialsDropdown,
  OtherDropdown,
} from "./topbar/navMenus";
import { SearchBox } from "./topbar/SearchBox";
import { MessagesMenu } from "./topbar/MessagesMenu";
import { NotificationsMenu } from "./topbar/NotificationsMenu";
import { ProfileMenu } from "./topbar/ProfileMenu";
import styles from "./topbar/navBar.module.scss";

export const TopBar = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const logout = useSession((s) => s.logout);
  const setView = useViewStore((s) => s.setView);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const profile =
    status?.authenticated && !status.offline ? status.profile : null;

  const openExternal = (url: string) =>
    void window.moderator.app.openExternal(url);

  const goHome = () => setView("forum");

  return (
    <header className={styles.bar}>
      {}
      <div className={styles.left}>
        <button
          type="button"
          className={styles.logoBtn}
          onClick={goHome}
          aria-label={LZT_CONFIG.appName}
        >
          <Logo size={28} />
        </button>
        <div className={styles.brand}>
          <button type="button" className={styles.name} onClick={goHome}>
            {LZT_CONFIG.appName}
          </button>
          <button
            type="button"
            className={styles.version}
            onClick={() => setChangelogOpen(true)}
            title={t("changelog.title")}
          >
            v{CURRENT_VERSION}
          </button>
        </div>

        <nav className={styles.navLinks}>
          {}
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setView("market")}
          >
            {t("navbar.market")}
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => openExternal(`${LZT_CONFIG.webUrl}/articles/`)}
          >
            {t("navbar.articles")}
          </button>
          <ServicesDropdown label={t("navbar.services")} />
          <SocialsDropdown label={t("navbar.socials")} />
          <OtherDropdown label={t("navbar.other")} />
        </nav>
      </div>

      {}
      <div className={styles.right}>
        <SearchBox />
        {profile && (
          <>
            <MessagesMenu />
            <NotificationsMenu />
          </>
        )}
        <PingPill />
        {profile ? (
          <ProfileMenu profile={profile} />
        ) : (
          <button
            type="button"
            className={styles.logout}
            onClick={() => void logout()}
            title={t("topbar.logout")}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      <ChangelogModal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />
    </header>
  );
};
