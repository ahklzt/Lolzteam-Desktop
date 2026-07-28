import { type ComponentType, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Binary,
  ChevronRight,
  Cookie,
  FileCode2,
  KeyRound,
  ListChecks,
  Mail,
  Replace,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MailPanel } from "../mail/MailPanel";
import { useMailTarget } from "~/stores/mailTarget";
import { ProxyCheckTool } from "./proxycheck/ProxyCheckTool";
import { LztMarketTool } from "./lztmarket/LztMarketTool";
import { CheckerTool } from "./checker/CheckerTool";
import { Base64DecodePanel } from "./panels/Base64Decode";
import { Base64EncodePanel } from "./panels/Base64Encode";
import { CookieFormatPanel } from "./panels/CookieFormat";
import { DedupePanel } from "./panels/Dedupe";
import { Netscape2JsonPanel } from "./panels/Netscape2Json";
import { ReplaceDelimPanel } from "./panels/ReplaceDelim";
import { SplitPanel } from "./panels/Split";
import { TwoFAPanel } from "./panels/TwoFA";
import styles from "./ToolsView.module.scss";

type ToolId =
  | "lztmarket"
  | "checker"
  | "mail"
  | "proxycheck"
  | "2fa"
  | "cookie-fmt"
  | "base64-decode"
  | "base64-encode"
  | "netscape"
  | "replace-delim"
  | "split"
  | "dedupe";

interface ToolDef {
  id: ToolId;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  Panel: ComponentType<{ onBack: () => void }>;
}

const TOOLS: ToolDef[] = [
  {
    id: "lztmarket",
    icon: Store,
    titleKey: "lztmarket.tile.title",
    descKey: "lztmarket.tile.desc",
    Panel: LztMarketTool,
  },
  {
    id: "checker",
    icon: ScanSearch,
    titleKey: "checker.tile.title",
    descKey: "checker.tile.desc",
    Panel: CheckerTool,
  },
  {
    id: "mail",
    icon: Mail,
    titleKey: "mail.title",
    descKey: "mail.tileDesc",
    Panel: MailPanel,
  },
  {
    id: "proxycheck",
    icon: ShieldCheck,
    titleKey: "proxycheck.tile.title",
    descKey: "proxycheck.tile.desc",
    Panel: ProxyCheckTool,
  },
  {
    id: "2fa",
    icon: KeyRound,
    titleKey: "tools.twofa.title",
    descKey: "tools.twofa.desc",
    Panel: TwoFAPanel,
  },
  {
    id: "cookie-fmt",
    icon: Cookie,
    titleKey: "tools.cookieFmt.title",
    descKey: "tools.cookieFmt.desc",
    Panel: CookieFormatPanel,
  },
  {
    id: "base64-decode",
    icon: Binary,
    titleKey: "tools.b64decode.title",
    descKey: "tools.b64decode.desc",
    Panel: Base64DecodePanel,
  },
  {
    id: "base64-encode",
    icon: FileCode2,
    titleKey: "tools.b64encode.title",
    descKey: "tools.b64encode.desc",
    Panel: Base64EncodePanel,
  },
  {
    id: "netscape",
    icon: Cookie,
    titleKey: "tools.netscape.title",
    descKey: "tools.netscape.desc",
    Panel: Netscape2JsonPanel,
  },
  {
    id: "replace-delim",
    icon: Replace,
    titleKey: "tools.replace.title",
    descKey: "tools.replace.desc",
    Panel: ReplaceDelimPanel,
  },
  {
    id: "split",
    icon: Scissors,
    titleKey: "tools.split.title",
    descKey: "tools.split.desc",
    Panel: SplitPanel,
  },
  {
    id: "dedupe",
    icon: ListChecks,
    titleKey: "tools.dedupe.title",
    descKey: "tools.dedupe.desc",
    Panel: DedupePanel,
  },
];

export const ToolsView = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<ToolId | null>(null);

  const mailPending = useMailTarget((s) => s.pending);
  useEffect(() => {
    if (mailPending && active !== "mail") setActive("mail");
  }, [mailPending, active]);

  const current = TOOLS.find((x) => x.id === active);
  if (current) {
    const { Panel } = current;
    return <Panel onBack={() => setActive(null)} />;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t("tools.heading")}</h1>
        <p className={styles.subtitle}>{t("tools.subheading")}</p>
      </header>

      <div className={styles.grid}>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              className={styles.card}
              onClick={() => setActive(tool.id)}
            >
              <span className={styles.cardIcon}>
                <Icon size={20} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>{t(tool.titleKey)}</span>
                <span className={styles.cardDesc}>{t(tool.descKey)}</span>
              </span>
              <ChevronRight size={18} className={styles.cardChevron} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
