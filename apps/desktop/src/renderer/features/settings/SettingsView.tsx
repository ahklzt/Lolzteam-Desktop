import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  EyeOff,
  Gamepad2,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Puzzle,
  Rocket,
  Settings2,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { useSettingsRoute } from "~/stores/settingsRoute";
import { ProxyView } from "./ProxyView";
import { LoginMethodsView } from "./LoginMethodsView";
import { AccountLabelsView } from "./AccountLabelsView";
import { AutoBumpView } from "./AutoBumpView";
import { DiscordRpcView } from "./DiscordRpcView";
import { StreamerView } from "./StreamerView";
import { LocalUniqEditor } from "./LocalUniqEditor";
import { HistoryView } from "./HistoryView";
import { SettingsSidebar } from "./SettingsSidebar";
import { PersonalInfoPanel } from "./panels/PersonalInfoPanel";
import { ContactInfoPanel } from "./panels/ContactInfoPanel";
import { PreferencesPanel } from "./panels/PreferencesPanel";
import { PrivacyPanel } from "./panels/PrivacyPanel";
import { NotesPanel } from "./panels/NotesPanel";
import { BlacklistPanel } from "./panels/BlacklistPanel";
import { AlertsPanel } from "./panels/AlertsPanel";
import { SecretPhrasePanel } from "./panels/SecretPhrasePanel";
import { AppPanel } from "./panels/AppPanel";
import { PluginsPanel } from "~/features/plugins/PluginsPanel";
import { StatusUpgradePanel } from "./panels/StatusUpgradePanel";
import { StubPanel } from "./panels/StubPanel";
import { GeneralSettingsPanel } from "./panels/GeneralSettingsPanel";
import { PluginInfoBanner } from "./PluginInfoBanner";
import { AppearanceSettingsPanel } from "./panels/AppearanceSettingsPanel";
import { ChatSettingsPanel } from "./panels/ChatSettingsPanel";
import { OtherSettingsPanel } from "./panels/OtherSettingsPanel";
import { SystemPanel } from "./panels/SystemPanel";
import {
  IconAlerts,
  IconAuthorizations,
  IconBlacklist,
  IconContact,
  IconDeveloperApi,
  IconExternalAccounts,
  IconLinkedAccounts,
  IconMarketSettings,
  IconMerchants,
  IconNotes,
  IconPersonal,
  IconPreferences,
  IconPrivacy,
  IconSecretPhrase,
  IconSecurity,
  IconStatus,
  IconTwoFactor,
  type SettingsIcon,
} from "./icons";
import { LZT_CONFIG } from "@lzt/shared";
import styles from "./SettingsView.module.scss";

export type SettingsTab =
  | "personal"
  | "contact"
  | "preferences"
  | "privacy"
  | "blacklist"
  | "status"
  | "notes"
  | "alerts"
  | "security"
  | "secret"
  | "twofactor"
  | "authorizations"
  | "external"
  | "linked"
  | "devapi"
  | "integrations"
  | "merchants"
  | "market"
  | "app"
  | "general"
  | "appearance"
  | "chats"
  | "system"
  | "other"
  | "autobump"
  | "discord"
  | "streamer"
  | "plugins";

export interface SettingsNavItem {
  id: SettingsTab;
  icon: SettingsIcon;
  labelKey: string;
}

export interface SettingsNavSection {
  id: string;
  labelKey: string;
  items: SettingsNavItem[];
}

const NAV_SECTIONS: SettingsNavSection[] = [
  {
    id: "app",
    labelKey: "settings.sections.app",
    items: [
      {
        id: "general",
        icon: SlidersHorizontal,
        labelKey: "settings.general.title",
      },
      {
        id: "appearance",
        icon: Palette,
        labelKey: "settings.appearance.title",
      },
      { id: "chats", icon: MessageSquare, labelKey: "settings.chats.title" },
      { id: "system", icon: Cpu, labelKey: "settings.system.title" },
    ],
  },
  {
    id: "plugins",
    labelKey: "settings.plugins.title",
    items: [
      { id: "autobump", icon: Rocket, labelKey: "settings.autobump.title" },
      { id: "streamer", icon: EyeOff, labelKey: "settings.streamer.title" },
      { id: "discord", icon: Gamepad2, labelKey: "settings.discord.title" },
      { id: "plugins", icon: Puzzle, labelKey: "settings.plugins.navManager" },
    ],
  },
  {
    id: "other",
    labelKey: "settings.other.title",
    items: [
      {
        id: "other",
        icon: MoreHorizontal,
        labelKey: "settings.other.navLabel",
      },
      { id: "app", icon: Wrench, labelKey: "settings.app.navLabel" },
    ],
  },
  {
    id: "main",
    labelKey: "settings.sections.main",
    items: [
      {
        id: "personal",
        icon: IconPersonal,
        labelKey: "settings.personal.title",
      },
      { id: "contact", icon: IconContact, labelKey: "settings.contact.title" },
      {
        id: "preferences",
        icon: IconPreferences,
        labelKey: "settings.preferences.title",
      },
      { id: "privacy", icon: IconPrivacy, labelKey: "settings.privacy.title" },
      {
        id: "blacklist",
        icon: IconBlacklist,
        labelKey: "settings.blacklist.title",
      },
      { id: "status", icon: IconStatus, labelKey: "settings.status.title" },
      { id: "notes", icon: IconNotes, labelKey: "settings.notes.title" },
    ],
  },
  {
    id: "notifications",
    labelKey: "settings.sections.notifications",
    items: [
      { id: "alerts", icon: IconAlerts, labelKey: "settings.alerts.title" },
    ],
  },
  {
    id: "security",
    labelKey: "settings.sections.security",
    items: [
      {
        id: "security",
        icon: IconSecurity,
        labelKey: "settings.security.title",
      },
      {
        id: "secret",
        icon: IconSecretPhrase,
        labelKey: "settings.secret.title",
      },
      {
        id: "twofactor",
        icon: IconTwoFactor,
        labelKey: "settings.twofactor.title",
      },
      {
        id: "authorizations",
        icon: IconAuthorizations,
        labelKey: "settings.authorizations.title",
      },
      {
        id: "integrations",
        icon: IconExternalAccounts,
        labelKey: "settings.integrations.title",
      },
    ],
  },
  {
    id: "external",
    labelKey: "settings.sections.external",
    items: [
      {
        id: "linked",
        icon: IconLinkedAccounts,
        labelKey: "settings.linked.title",
      },
      {
        id: "devapi",
        icon: IconDeveloperApi,
        labelKey: "settings.devapi.title",
      },
    ],
  },
  {
    id: "market",
    labelKey: "settings.sections.market",
    items: [
      {
        id: "merchants",
        icon: IconMerchants,
        labelKey: "settings.merchants.title",
      },
      {
        id: "market",
        icon: IconMarketSettings,
        labelKey: "settings.market.title",
      },
    ],
  },
];

const STUB_VARIANT: Partial<Record<SettingsTab, "planned" | "web">> = {
  security: "web",
  twofactor: "web",
  authorizations: "web",
  integrations: "web",
  external: "web",
  linked: "web",
  devapi: "web",
  merchants: "web",
  market: "web",
};

const STUB_WEB_URL: Partial<Record<SettingsTab, string>> = {
  security: `${LZT_CONFIG.webUrl}/account/security`,
  twofactor: `${LZT_CONFIG.webUrl}/account/two-step`,
  authorizations: `${LZT_CONFIG.webUrl}/account/authorizations`,
  integrations: `${LZT_CONFIG.webUrl}/account/connected-accounts`,
  linked: `${LZT_CONFIG.webUrl}/account/linked-accounts`,
  devapi: `${LZT_CONFIG.webUrl}/account/api`,
  merchants: `${LZT_CONFIG.marketWebUrl}/merchants`,
  market: `${LZT_CONFIG.webUrl}/account/market`,
};

export const SettingsView = () => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);

  const [tab, setTab] = useState<SettingsTab>("general");
  const [subview, setSubview] = useState<
    "proxy" | "loginMethods" | "labels" | "localUniq" | "history" | null
  >(null);

  const routeTab = useSettingsRoute((s) => s.tab);
  const routeNonce = useSettingsRoute((s) => s.nonce);
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    if (routeTab) {
      setTab(routeTab);
      setSubview(null);
    }
  }, [routeNonce, routeTab]);

  const settings = snapshot?.settings;
  if (!settings) return null;

  if (subview === "proxy") return <ProxyView onBack={() => setSubview(null)} />;
  if (subview === "loginMethods")
    return <LoginMethodsView onBack={() => setSubview(null)} />;
  if (subview === "labels")
    return <AccountLabelsView onBack={() => setSubview(null)} />;
  if (subview === "localUniq")
    return <LocalUniqEditor onBack={() => setSubview(null)} />;
  if (subview === "history")
    return <HistoryView onBack={() => setSubview(null)} />;

  const stub = STUB_VARIANT[tab];

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headIcon}>
          <Settings2 size={22} />
        </div>
        <div className={styles.headText}>
          <h1 className={styles.title}>{t("settings.heading")}</h1>
          <p className={styles.subtitle}>{t("settings.subheading")}</p>
        </div>
      </header>

      <div className={styles.body}>
        <SettingsSidebar
          sections={NAV_SECTIONS}
          active={tab}
          onSelect={setTab}
        />

        <section className={styles.content}>
          {
}
          {tab !== "autobump" &&
            tab !== "discord" &&
            tab !== "streamer" && (
              <header className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  {t(`settings.${tab}.title`)}
                </h2>
                <p className={styles.panelSubtitle}>
                  {t(`settings.${tab}.subtitle`)}
                </p>
              </header>
            )}

          {tab === "personal" && <PersonalInfoPanel />}
          {tab === "contact" && <ContactInfoPanel />}
          {tab === "preferences" && <PreferencesPanel />}
          {tab === "privacy" && <PrivacyPanel />}
          {tab === "notes" && <NotesPanel />}
          {tab === "blacklist" && <BlacklistPanel />}
          {tab === "alerts" && <AlertsPanel />}
          {tab === "secret" && <SecretPhrasePanel />}
          {tab === "app" && (
            <AppPanel
              onOpenProxy={() => setSubview("proxy")}
              onOpenLoginMethods={() => setSubview("loginMethods")}
              onOpenLabels={() => setSubview("labels")}
            />
          )}
          {tab === "general" && (
            <GeneralSettingsPanel
              onOpenLocalUniq={() => setSubview("localUniq")}
              onOpenHistory={() => setSubview("history")}
            />
          )}
          {tab === "appearance" && <AppearanceSettingsPanel />}
          {tab === "chats" && <ChatSettingsPanel />}
          {tab === "system" && <SystemPanel />}
          {tab === "other" && <OtherSettingsPanel />}
          {tab === "autobump" && (
            <>
              <PluginInfoBanner
                icon={Rocket}
                title="AutoBump"
                description="Автоматическое поднятие тем на lolz.team"
              />
              <AutoBumpView />
            </>
          )}
          {tab === "discord" && (
            <>
              <PluginInfoBanner
                icon={Gamepad2}
                title="Discord RPC"
                description="Отображайте пользователям свою активность приложения в Discord!"
              />
              <DiscordRpcView />
            </>
          )}
          {tab === "streamer" && (
            <>
              <PluginInfoBanner
                icon={EyeOff}
                title="StreamMode"
                description="Скрывает конфиденциальную информацию для стримеров."
              />
              <StreamerView />
            </>
          )}
          {tab === "plugins" && <PluginsPanel />}
          {tab === "status" && <StatusUpgradePanel />}
          {stub && <StubPanel variant={stub} url={STUB_WEB_URL[tab]} />}
        </section>
      </div>
    </div>
  );
};
