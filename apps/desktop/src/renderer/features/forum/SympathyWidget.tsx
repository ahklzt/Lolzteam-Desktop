
import { useTranslation } from "react-i18next";
import { Crown } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import { RichUsername } from "~/features/profile/RichUsername";
import { useMyProfile } from "./forum-hooks";
import styles from "./forum.module.scss";
import { useAvatarOverride } from "~/lib/avatar";

const GROUPS: Array<{ name: string; min: number }> = [
  { name: "Новорег", min: 0 },
  { name: "Искусственный интеллект", min: 10 },
  { name: "Местный", min: 20 },
  { name: "Эксперт", min: 1000 },
  { name: "Гуру", min: 4000 },
  { name: "Величайший", min: 111111 },
];

const upgradesUrl = (): string => `${getForumWebBase()}/account/upgrades`;

const statValue = (
  stats: Array<{ key: string; value: number }>,
  key: string,
): number => stats.find((s) => s.key === key)?.value ?? 0;

const nf = new Intl.NumberFormat("ru-RU");

export const SympathyWidget = () => {
  const avatarOverride = useAvatarOverride();
  const { t } = useTranslation();
  const profile = useMyProfile();
  const me = profile.data ?? null;
  if (!me) return null;

  const sympathies = statValue(me.stats, "sympathies");
  const messages = statValue(me.stats, "messages");
  const next = GROUPS.find((g) => g.min > sympathies) ?? null;
  const remaining = next ? next.min - sympathies : 0;
  const description = me.userTitle ?? me.description ?? "";

  return (
    <div className={styles.symWidget}>
      <div className={styles.symUser}>
        {(avatarOverride ?? me.avatarUrl) ? (
          <img className={styles.symAvatar} src={avatarOverride ?? me.avatarUrl} alt="" />
        ) : (
          <div className={styles.symAvatar}>
            {me.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className={styles.symUserInfo}>
          <RichUsername
            html={me.usernameHtml}
            fallback={me.username}
            userId={me.userId}
            className={styles.symNick}
          />
          {description && <span className={styles.symDesc}>{description}</span>}
        </div>
      </div>

      <div className={styles.symStats}>
        <span>
          {t("forum.sym.sympathies", { value: nf.format(sympathies) })}
        </span>
        <span className={styles.symDot}>•</span>
        <span>{t("forum.sym.messages", { value: nf.format(messages) })}</span>
      </div>

      {next ? (
        <p className={styles.symText}>
          {t("forum.sym.reachNext", {
            left: nf.format(remaining),
            group: next.name,
          })}
        </p>
      ) : (
        <p className={styles.symText}>{t("forum.sym.topGroup")}</p>
      )}

      <button
        type="button"
        className={styles.symUpgrade}
        onClick={() => window.open(upgradesUrl(), "_blank")}
      >
        <Crown size={14} />
        <span>{t("forum.sym.upgrade")}</span>
      </button>
    </div>
  );
};
