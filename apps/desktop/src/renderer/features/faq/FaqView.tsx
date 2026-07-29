import { useEffect, useState } from "react";
import {
  FileText,
  FileSignature,
  ShieldCheck,
  HelpCircle,
  Smile,
  Code,
  Trophy,
  Cookie,
  Users,
  Tags,
  Send,
} from "lucide-react";
import { useFaqRoute } from "~/stores/faqRoute";
import { FaqSidebar, type FaqNavItem } from "./FaqSidebar";
import { HtmlPage } from "./HtmlPage";
import { FAQ_PAGES, FAQ_PAGE_STYLES, type FaqTab } from "./pages";
import styles from "./FaqView.module.scss";

const SUGGEST_KEYWORD_URL = "https" + "://t.me/jeff1939";

const NAV: FaqNavItem[] = [
  { id: "terms", label: "Условия и правила", icon: FileText },
  { id: "offer", label: "Договор оферты", icon: FileSignature },
  { id: "privacy", label: "Политика конфиденциальности", icon: ShieldCheck },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "smilies", label: "Смайлы", icon: Smile },
  { id: "bbcodes", label: "BB-коды", icon: Code },
  { id: "trophies", label: "Трофеи", icon: Trophy },
  { id: "cookies", label: "Использование файлов cookie", icon: Cookie },
  { id: "usergroups", label: "Группы пользователей", icon: Users },
  { id: "keywords", label: "Ключевые слова", icon: Tags },
];

export const FaqView = () => {
  const [tab, setTab] = useState<FaqTab>("faq");

  const routeTab = useFaqRoute((s) => s.tab);
  const routeNonce = useFaqRoute((s) => s.nonce);

  useEffect(() => {
    if (routeTab) {
      setTab(routeTab);
    }
  }, [routeNonce, routeTab]);

  const openExternal = (url: string) => void window.moderator.app.openExternal(url);

  return (
    <div className={styles.wrap}>
      <FaqSidebar items={NAV} active={tab} onSelect={setTab} />
      <section className={styles.content}>
        {tab === "keywords" && (
          <div className={styles.toolbar}>
            <span className={styles.toolbarText}>Не нашли нужное ключевое слово?</span>
            <button
              type="button"
              className={styles.suggestBtn}
              onClick={() => openExternal(SUGGEST_KEYWORD_URL)}
            >
              <Send size={15} />
              Предложить ключевое слово
            </button>
          </div>
        )}
        <HtmlPage
          html={FAQ_PAGES[tab]}
          extraCss={FAQ_PAGE_STYLES[tab]}
          className={styles.frame}
        />
      </section>
    </div>
  );
};
