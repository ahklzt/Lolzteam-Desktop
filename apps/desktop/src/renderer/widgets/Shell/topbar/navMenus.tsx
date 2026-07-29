import {
  ShieldCheck,
  Eye,
  Rocket,
  Coins,
  Landmark,
  Apple,
  Smartphone,
  Wallet,
  LifeBuoy,
  HelpCircle,
  BookText,
  ArrowUpCircle,
  Megaphone,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LZT_CONFIG } from "@lzt/shared";
import { useViewStore } from "~/stores/view";
import { useFaqRoute } from "~/stores/faqRoute";
import type { FaqTab } from "~/features/faq/pages";
import { Popover } from "./Popover";
import styles from "./navBar.module.scss";

const WEB = LZT_CONFIG.webUrl;

const openExternal = (url: string) => {
  void window.moderator.app.openExternal(url);
};

interface IconMenuItem {
  label: string;
  url: string;
  icon: LucideIcon;
  dot?: boolean;
  internal?: "faq" | "ads";
  faqTab?: FaqTab;
}

interface SocialItem {
  label: string;
  url: string;
  img?: string;
  scam?: boolean;
}
interface SocialGroup {
  title: string;
  items: SocialItem[];
}

const SERVICES: IconMenuItem[] = [
  { label: "Гарант", url: `${WEB}/guarantor/`, icon: ShieldCheck },
  { label: "Antipublic", url: `${WEB}/antipublic/`, icon: Eye },
  { label: "Lolzteam Launcher", url: `${WEB}/threads/10024162/`, icon: Rocket },
  { label: "Задания за деньги", url: "https://zelenka.work", icon: Coins },
  { label: "Приём платежей", url: `${WEB}/pages/merchant/`, icon: Landmark },
  {
    label: "Приложение iOS",
    url: "https://apps.apple.com/us/app/lolzteam/id6759150707",
    icon: Apple,
  },
  {
    label: "Приложение Android",
    url: "https://play.google.com/store/apps/details?id=com.lolzteam",
    icon: Smartphone,
  },
];

const CDN = "https://nztcdn.com/files";
const SOCIALS: SocialGroup[] = [
  {
    title: "Официальные",
    items: [
      {
        label: "LOLZTEAM",
        url: "https://t.me/lolz_guru",
        img: `${CDN}/ce860c0d-3968-4f2d-8e8c-c6fcc713100f.webp`,
        scam: true,
      },
      {
        label: "LOLZTEAM LEGAL",
        url: "https://t.me/lolz_legal",
        img: `${CDN}/c945a738-f258-47b0-b682-adb3d19677f4.webp`,
      },
      {
        label: "LOLZTEAM DEV BLOG",
        url: "https://t.me/lolzteam_dev_blog",
        img: `${CDN}/99fdc163-c9b5-424e-88b2-c8e9892eca0d.webp`,
      },
      {
        label: "Группа ВКонтакте",
        url: "https://vk.com/thelztcrew",
        img: `${CDN}/9413d4bb-8a55-43fd-810f-d906a7c60e68.webp`,
      },
      {
        label: "YouTube канал",
        url: "https://www.youtube.com/@morpheus_lzt",
        img: `${CDN}/06ddd12c-98b2-4a0d-b412-39e8b2b32e6f.webp`,
      },
      {
        label: "LOLZTEAM TG чат",
        url: "https://t.me/+Lr_o08HwF8NkYTEy",
        img: `${CDN}/99fdc163-c9b5-424e-88b2-c8e9892eca0d.webp`,
      },
      {
        label: "Discord сервер",
        url: "https://discord.gg/zelenka",
        img: `${CDN}/2f254235-7314-42f3-b360-1d5f8f23eefa.webp`,
      },
      {
        label: "УЛЬТА",
        url: "https://t.me/ulta_games",
        img: `${CDN}/b005792f-7205-4245-b871-3209eccd4828.webp`,
      },
    ],
  },
  {
    title: "Сообщество",
    items: [
      {
        label: "LOLZTEAM NEWS",
        url: "https://t.me/lolz_news",
        img: `${CDN}/ab8fa6d5-f79c-4ca8-839e-b52e96aab974.webp`,
      },
      {
        label: "ХРОНИКИ LOLZ",
        url: "https://t.me/+e_mGvWWzQp40ZjMy",
        img: `${CDN}/bee1e9f4-49e8-4729-8eda-d93fe0e6537c.webp`,
      },
    ],
  },
];

const OTHER: IconMenuItem[] = [
  {
    label: "Не пришли деньги?",
    url: `${WEB}/payment/balance/deposit/problem`,
    icon: Wallet,
  },
  { label: "Нужна помощь", url: `${WEB}/support-tickets/open`, icon: LifeBuoy },
  {
    label: "FAQ",
    url: `${WEB}/help/faq`,
    icon: HelpCircle,
    internal: "faq",
    faqTab: "faq",
  },
  {
    label: "Правила форума",
    url: `${WEB}/rules/`,
    icon: BookText,
    internal: "faq",
    faqTab: "terms",
  },
  {
    label: "Изменения на сайте",
    url: "https://lolz.team/new-features/unread",
    icon: ArrowUpCircle,
    dot: true,
  },
  { label: "Реклама", url: `${WEB}/misc/ads`, icon: Megaphone, internal: "ads" },
];

const BRAND_PATHS: Record<string, { d: string; color: string }> = {
  telegram: {
    color: "#229ED9",
    d: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
  vk: {
    color: "#0077FF",
    d: "M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.808 0 1.126-.26 1.126-.668 0-.863-1.421-2.386-2.625-3.504-1.686-1.565-1.765-1.602-.313-3.486 1.801-2.339 4.157-5.336 2.073-5.336h-3.981c-.772 0-.828.435-1.103 1.083-.995 2.347-2.886 5.387-3.604 4.922-.751-.485-.407-2.406-.35-5.031.015-.696.011-1.16-1.017-1.399-.561-.13-1.104-.184-1.606-.184-2.001 0-3.377.874-2.595.925 1.377.088 1.242 3.001 1.242 3.001.293 4.28-1.516 3.442-3.256-.716-.36-.734-.665-1.482-1.516-1.482H1.786c-.788 0-1.14.36-.786 1.239 1.949 4.841 6.302 12.336 12.162 12.336z",
  },
  youtube: {
    color: "#FF0000",
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  discord: {
    color: "#5865F2",
    d: "M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z",
  },
};

const brandFor = (url: string): { d: string; color: string } => {
  if (url.includes("vk.com")) return BRAND_PATHS.vk!;
  if (url.includes("youtube")) return BRAND_PATHS.youtube!;
  if (url.includes("discord")) return BRAND_PATHS.discord!;
  return BRAND_PATHS.telegram!;
};

const BrandIcon = ({ url }: { url: string }) => {
  const { d, color } = brandFor(url);
  return (
    <svg
      className={styles.menuItemImg}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
};

const ScamBadge = () => (
  <svg
    className={styles.scamBadge}
    width="40"
    height="16"
    viewBox="0 0 40 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6.3916 10.0371H7.4707C7.50977 10.3854 7.68392 10.6654 7.99316 10.877C8.30241 11.0885 8.68978 11.1943 9.15527 11.1943C9.59798 11.1943 9.96257 11.0918 10.249 10.8867C10.5387 10.6816 10.6836 10.4212 10.6836 10.1055C10.6836 9.83203 10.5811 9.60905 10.376 9.43652C10.1709 9.26074 9.84049 9.11751 9.38477 9.00684L8.47168 8.78711C7.82389 8.63086 7.34538 8.39811 7.03613 8.08887C6.73014 7.77962 6.57715 7.37923 6.57715 6.8877C6.57715 6.28223 6.81478 5.78906 7.29004 5.4082C7.76855 5.02734 8.38542 4.83691 9.14062 4.83691C9.88281 4.83691 10.4883 5.02734 10.957 5.4082C11.4258 5.78581 11.6683 6.27897 11.6846 6.8877H10.6201C10.5876 6.53939 10.4362 6.26432 10.166 6.0625C9.89909 5.86068 9.55241 5.75977 9.12598 5.75977C8.7028 5.75977 8.35775 5.85742 8.09082 6.05273C7.82715 6.24805 7.69531 6.50195 7.69531 6.81445C7.69531 7.06185 7.7946 7.2653 7.99316 7.4248C8.19173 7.58105 8.51888 7.71615 8.97461 7.83008L9.75098 8.02051C10.4736 8.18978 10.9945 8.42904 11.3135 8.73828C11.6357 9.04427 11.7969 9.45605 11.7969 9.97363C11.7969 10.6312 11.5527 11.1536 11.0645 11.541C10.5762 11.9251 9.91374 12.1172 9.07715 12.1172C8.29264 12.1172 7.65625 11.93 7.16797 11.5557C6.68294 11.1781 6.42415 10.6719 6.3916 10.0371ZM15.752 12.1172C14.7624 12.1172 13.9762 11.79 13.3936 11.1357C12.8141 10.4814 12.5244 9.5944 12.5244 8.47461C12.5244 7.36133 12.8158 6.47754 13.3984 5.82324C13.9811 5.16569 14.7656 4.83691 15.752 4.83691C16.5527 4.83691 17.2282 5.06315 17.7783 5.51562C18.3285 5.96484 18.6491 6.55566 18.7402 7.28809H17.6562C17.5586 6.83561 17.3356 6.47428 16.9873 6.2041C16.6423 5.93066 16.2305 5.79395 15.752 5.79395C15.1107 5.79395 14.598 6.03809 14.2139 6.52637C13.833 7.01139 13.6426 7.66081 13.6426 8.47461C13.6426 9.29818 13.833 9.95247 14.2139 10.4375C14.5947 10.9193 15.109 11.1602 15.7568 11.1602C16.2451 11.1602 16.6553 11.0413 16.9873 10.8037C17.3226 10.5661 17.5456 10.234 17.6562 9.80762H18.7451C18.6117 10.5368 18.2812 11.1048 17.7539 11.5117C17.2298 11.9154 16.5625 12.1172 15.752 12.1172ZM24.2334 12L23.5889 10.0957H20.9033L20.2588 12H19.1211L21.665 4.9541H22.8467L25.3906 12H24.2334ZM22.2314 6.12598L21.1816 9.2168H23.3105L22.2607 6.12598H22.2314ZM33.2959 12H32.2949V6.81445H32.2607L30.1367 11.9463H29.3262L27.1973 6.81445H27.1631V12H26.167V4.9541H27.4316L29.7119 10.5156H29.751L32.0264 4.9541H33.2959V12Z"
      fill="#E06B6B"
    />
    <rect x="0.5" y="0.5" width="39" height="15" rx="7.5" stroke="#E06B6B" />
  </svg>
);

const NavTrigger = ({
  label,
  open,
  toggle,
}: {
  label: string;
  open: boolean;
  toggle: () => void;
}) => (
  <button
    type="button"
    className={`${styles.navBtn} ${open ? styles.navBtnActive : ""}`}
    onClick={toggle}
  >
    {label}
    <ChevronDown
      size={14}
      className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
    />
  </button>
);

export const ServicesDropdown = ({ label }: { label: string }) => (
  <Popover
    trigger={({ open, toggle }) => (
      <NavTrigger label={label} open={open} toggle={toggle} />
    )}
  >
    {({ close }) => (
      <>
        {SERVICES.map((it) => (
          <button
            key={it.url}
            type="button"
            className={styles.menuItem}
            onClick={() => {
              openExternal(it.url);
              close();
            }}
          >
            <it.icon size={18} className={styles.menuItemIcon} />
            <span className={styles.menuLabel}>{it.label}</span>
          </button>
        ))}
      </>
    )}
  </Popover>
);

export const SocialsDropdown = ({ label }: { label: string }) => (
  <Popover
    trigger={({ open, toggle }) => (
      <NavTrigger label={label} open={open} toggle={toggle} />
    )}
  >
    {({ close }) => (
      <>
        {SOCIALS.map((group) => (
          <div key={group.title} className={styles.menuSection}>
            <div className={styles.menuTitle}>{group.title}</div>
            {group.items.map((it) => (
              <button
                key={it.url}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  openExternal(it.url);
                  close();
                }}
              >
                {it.img ? (
                  <img
                    src={it.img}
                    className={styles.menuItemImg}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <BrandIcon url={it.url} />
                )}
                <span className={styles.menuLabel}>{it.label}</span>
                {it.scam && <ScamBadge />}
              </button>
            ))}
          </div>
        ))}
      </>
    )}
  </Popover>
);

export const OtherDropdown = ({ label }: { label: string }) => {
  const setView = useViewStore((s) => s.setView);
  const openFaq = useFaqRoute((s) => s.open);

  const handleClick = (it: IconMenuItem, close: () => void) => {
    if (it.internal === "faq") {
      if (it.faqTab) openFaq(it.faqTab);
      setView("faq");
    } else if (it.internal === "ads") {
      setView("ads");
    } else {
      openExternal(it.url);
    }
    close();
  };

  return (
    <Popover
      trigger={({ open, toggle }) => (
        <NavTrigger label={label} open={open} toggle={toggle} />
      )}
    >
      {({ close }) => (
        <>
          {OTHER.map((it) => (
            <button
              key={it.label}
              type="button"
              className={styles.menuItem}
              onClick={() => handleClick(it, close)}
            >
              <it.icon size={18} className={styles.menuItemIcon} />
              <span className={styles.menuLabel}>{it.label}</span>
              {it.dot && <span className={styles.greenDot} />}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
};
