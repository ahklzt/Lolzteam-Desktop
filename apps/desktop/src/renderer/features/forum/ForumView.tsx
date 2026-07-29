
import { useEffect, useRef } from "react";
import { useForumStore } from "./forum-store";
import { useReportPresence } from "~/stores/presence";
import { getDefaultForumTab } from "./forum-tabs-store";
import { useForumMiniProfile } from "~/stores/forumMiniProfile";
import { useProfileTarget } from "~/stores/profileTarget";
import { useViewStore } from "~/stores/view";
import { MiniProfileModal } from "~/features/profile/MiniProfileModal";
import { ForumSidebar } from "./ForumSidebar";
import { ThreadList } from "./ThreadList";
import { ThreadView } from "./ThreadView";
import { CreateThread } from "./CreateThread";
import styles from "./forum.module.scss";

export const ForumView = () => {
  const screen = useForumStore((s) => s.screen);
  const selectCustomTab = useForumStore((s) => s.selectCustomTab);
  const section = useForumStore((s) => s.section);
  const sectionName =
    section.type === "forum" || section.type === "customTab"
      ? section.title
      : section.type === "userThreads"
        ? `Темы: ${section.username}`
        : section.type === "all"
        ? "Все обсуждения"
        : section.type === "my"
          ? "Мои темы"
          : section.type === "userPosts"
            ? "Мои сообщения"
            : section.type === "bookmarks"
              ? "Закладки"
              : section.type === "scheduled"
                ? "Отложенные темы"
                : "Прочитанные темы";
  useReportPresence({ kind: "forum_section", name: sectionName });
  const appliedDefaultRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultRef.current) return;
    appliedDefaultRef.current = true;
    const def = getDefaultForumTab();
    if (def) {
      selectCustomTab({
        id: def.id,
        name: def.name,
        forumIds: def.forumIds,
        filters: def.filters,
      });
    }
  }, [selectCustomTab]);
  const miniUserId = useForumMiniProfile((s) => s.userId);
  const closeMini = useForumMiniProfile((s) => s.close);
  const openProfile = useProfileTarget((s) => s.openProfile);
  const setView = useViewStore((s) => s.setView);

  const isThread = screen.type === "thread";

  return (
    <div className={isThread ? styles.layoutThread : styles.layout}>
      {!isThread && <ForumSidebar />}
      <div className={styles.content}>
        {screen.type === "list" && <ThreadList />}
        {isThread && <ThreadView threadId={screen.threadId} />}
      </div>
      <CreateThread />
      <MiniProfileModal
        userId={miniUserId}
        onClose={closeMini}
        onOpenProfile={(userId) => {
          closeMini();
          openProfile(userId);
          setView("profile");
        }}
      />
    </div>
  );
};
