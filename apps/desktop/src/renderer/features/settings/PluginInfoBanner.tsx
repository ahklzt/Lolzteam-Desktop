import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import {
  getForumWebBase,
  profileSiteLinks,
  type FullProfile,
} from "@lzt/shared";
import { RichUsername } from "~/features/profile/RichUsername";
import styles from "./PluginInfoBanner.module.scss";

const DEFAULT_AUTHOR_NAME = "ahk_lzt";

interface PluginInfoBannerProps {
  icon: LucideIcon;
  title: string;
  description: string;
  authorName?: string;
  authorUserId?: number;
}

export const PluginInfoBanner = ({
  icon: Icon,
  title,
  description,
  authorName = DEFAULT_AUTHOR_NAME,
  authorUserId,
}: PluginInfoBannerProps) => {
  const [author, setAuthor] = useState<FullProfile | null>(null);

  useEffect(() => {
    setAuthor(null);
    if (!authorUserId) return;
    let cancelled = false;
    void window.moderator.profile.getUser(String(authorUserId)).then((res) => {
      if (cancelled || !res.ok) return;
      setAuthor(res.profile);
    });
    return () => {
      cancelled = true;
    };
  }, [authorUserId]);

  const authorUrl =
    author?.profileUrl ??
    (authorUserId
      ? profileSiteLinks.member(authorUserId)
      : `${getForumWebBase()}/${authorName}/`);

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>
        <Icon size={22} />
      </span>
      <div className={styles.text}>
        <div className={styles.top}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.author}
            onClick={() => void window.moderator.app.openExternal(authorUrl)}
          >
            {author ? (
              <RichUsername
                html={author.usernameHtml}
                fallback={author.username}
                color={author.usernameColor}
                userId={author.userId}
                className={styles.authorName}
              />
            ) : (
              authorName
            )}
            <ExternalLink size={12} />
          </button>
        </div>
        <p className={styles.desc}>{description}</p>
      </div>
    </div>
  );
};
