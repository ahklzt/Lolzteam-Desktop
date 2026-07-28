
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bookmark,
  Building2,
  ChevronDown,
  Eye,
  FileText,
  Hash,
  Heart,
  Info,
  Mail,
  Megaphone,
  MessagesSquare,
  MessageSquare,
  Palette,
  Plus,
  Search,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { getForumWebBase, type ForumNode } from "@lzt/shared";
import {
  type ForumSection,
  useForumStore,
  CONTEST_HIDDEN_IDS,
} from "./forum-store";
import { useForumTabsStore } from "./forum-tabs-store";
import { useForumTree } from "./forum-hooks";
import { sortForumTree } from "./forum-order";
import { SympathyWidget } from "./SympathyWidget";
import { CreateTabModal } from "./CreateTabModal";
import styles from "./forum.module.scss";

const NodeSvgIcon = ({
  glyph,
  Fallback,
}: {
  glyph?: string | null;
  Fallback: LucideIcon;
}) => (
  <span className={styles.nodeSvgIcon}>
    {glyph ? glyph : <Fallback size={16} />}
  </span>
);

const matchNodes = (nodes: ForumNode[], needle: string): ForumNode[] => {
  const result: ForumNode[] = [];
  for (const node of nodes) {
    const hit = node.title.toLowerCase().includes(needle);
    const children = matchNodes(node.children, needle);
    if (hit || children.length > 0) {
      result.push({ ...node, children: hit ? node.children : children });
    }
  }
  return result;
};

const ForumNodeRow = ({
  node,
  depth,
  expanded,
}: {
  node: ForumNode;
  depth: number;
  expanded: boolean;
}) => {
  const section = useForumStore((s) => s.section);
  const selectSection = useForumStore((s) => s.selectSection);
  const [open, setOpen] = useState(false);
  const visibleChildren = node.children.filter(
    (child) => !CONTEST_HIDDEN_IDS.has(child.forumId),
  );
  const hasChildren = visibleChildren.length > 0;
  const showChildren = hasChildren && (expanded || open);
  const active = section.type === "forum" && section.forumId === node.forumId;

  if (depth > 0) {
    return (
      <li className={styles.subNode}>
        <div className={styles.subLine}>
          {hasChildren ? (
            <button
              type="button"
              className={`${styles.subChevron} ${
                showChildren ? styles.chevronOpen : ""
              }`}
              onClick={() => setOpen(!open)}
              aria-label={showChildren ? "Свернуть" : "Развернуть"}
            >
              <ChevronDown size={12} />
            </button>
          ) : (
            <span className={styles.subChevron} />
          )}
          <button
            type="button"
            className={`${styles.subRow} ${active ? styles.subRowActive : ""}`}
            onClick={() =>
              selectSection({
                type: "forum",
                forumId: node.forumId,
                title: node.title,
              })
            }
          >
            {node.title}
          </button>
        </div>
        {showChildren && (
          <ol className={styles.subForumList}>
            {visibleChildren.map((child) => (
              <ForumNodeRow
                key={child.forumId}
                node={child}
                depth={depth + 1}
                expanded={expanded}
              />
            ))}
          </ol>
        )}
      </li>
    );
  }

  return (
    <li>
      <div className={`${styles.nodeRow} ${active ? styles.nodeRowActive : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className={`${styles.nodeChevron} ${
              showChildren ? styles.chevronOpen : ""
            }`}
            onClick={() => setOpen(!open)}
            aria-label={showChildren ? "Свернуть" : "Развернуть"}
          >
            <ChevronDown size={14} />
          </button>
        ) : (
          <span className={styles.nodeChevron} />
        )}
        <button
          type="button"
          className={styles.nodeLink}
          onClick={() =>
            selectSection({
              type: "forum",
              forumId: node.forumId,
              title: node.title,
            })
          }
        >
          <NodeSvgIcon glyph={node.iconContent} Fallback={Hash} />
          <span className={styles.forumTitle}>{node.title}</span>
        </button>
      </div>
      {showChildren && (
        <ol className={styles.subForumList}>
          {visibleChildren.map((child) => (
            <ForumNodeRow
              key={child.forumId}
              node={child}
              depth={depth + 1}
              expanded={expanded}
            />
          ))}
        </ol>
      )}
    </li>
  );
};

const TopNode = ({
  node,
  expanded,
}: {
  node: ForumNode;
  expanded: boolean;
}) => {
  if (node.isCategory) {
    const children = node.children.filter(
      (child) => !CONTEST_HIDDEN_IDS.has(child.forumId),
    );
    if (children.length === 0) return null;
    return (
      <li className={styles.categoryBlock}>
        <div className={styles.categoryStrip}>
          <span className={styles.categoryText}>{node.title}</span>
        </div>
        <ol className={styles.nodeChildren}>
          {children.map((child) => (
            <ForumNodeRow
              key={child.forumId}
              node={child}
              depth={0}
              expanded={expanded}
            />
          ))}
        </ol>
      </li>
    );
  }
  return <ForumNodeRow node={node} depth={0} expanded={expanded} />;
};

const MISC_LINKS: Array<{ key: string; path: string; Icon: LucideIcon }> = [
  { key: "about", path: "/misc/about", Icon: Info },
  { key: "contact", path: "/support-tickets/open", Icon: Mail },
  { key: "ads", path: "/misc/ads", Icon: Megaphone },
  { key: "branding", path: "/pages/brand", Icon: Palette },
  { key: "tournaments", path: "/misc/tournaments", Icon: Trophy },
  { key: "charity", path: "/misc/charity", Icon: Heart },
  { key: "company", path: "/pages/legal", Icon: Building2 },
];

export const ForumSidebar = () => {
  const { t } = useTranslation();
  const section = useForumStore((s) => s.section);
  const selectSection = useForumStore((s) => s.selectSection);
  const openCreate = useForumStore((s) => s.openCreate);
  const [query, setQuery] = useState("");
  const selectCustomTab = useForumStore((s) => s.selectCustomTab);
  const tabs = useForumTabsStore((s) => s.tabs);
  const removeTab = useForumTabsStore((s) => s.removeTab);
  const tree = useForumTree();
  const [createTabOpen, setCreateTabOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const filtering = needle.length > 0;
  const visibleTree = useMemo(() => {
    if (!tree.data?.ok) return [] as ForumNode[];
    const roots = tree.data.forums.filter(
      (node) => !CONTEST_HIDDEN_IDS.has(node.forumId),
    );
    const ordered = sortForumTree(roots);
    return filtering ? matchNodes(ordered, needle) : ordered;
  }, [tree.data, needle, filtering]);

  const personalRow = (
    target: ForumSection,
    Icon: LucideIcon,
    label: string,
  ) => {
    const active = section.type === target.type;
    return (
      <li>
        <div
          className={`${styles.nodeRow} ${active ? styles.nodeRowActive : ""}`}
        >
          <span className={styles.nodeChevron} />
          <button
            type="button"
            className={styles.nodeLink}
            onClick={() => selectSection(target)}
          >
            <NodeSvgIcon Fallback={Icon} />
            <span className={styles.forumTitle}>{label}</span>
          </button>
        </div>
      </li>
    );
  };

  return (
    <aside className={styles.sidebar}>
      {}
      <div className={styles.sidebarWrapper}>
        <button
          type="button"
          className={styles.createBtnFull}
          onClick={openCreate}
        >
          {t("forum.createThread")}
        </button>

        <ol className={styles.nodeList}>
          <li className={styles.searchInline}>
            <Search size={15} className={styles.searchInlineIcon} />
            <input
              className={styles.searchInlineInput}
              value={query}
              placeholder={t("forum.searchPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
            />
            {filtering && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setQuery("")}
                aria-label={t("forum.search")}
              >
                <X size={14} />
              </button>
            )}
          </li>
          {}
          <li>
            <div
              className={`${styles.nodeRow} ${
                section.type === "all" ? styles.nodeRowActive : ""
              }`}
            >
              <span className={styles.nodeChevron} />
              <button
                type="button"
                className={styles.nodeLink}
                onClick={() => selectSection({ type: "all" })}
              >
                <NodeSvgIcon Fallback={MessagesSquare} />
                <span className={styles.forumTitle}>
                  {t("forum.allDiscussions")}
                </span>
              </button>
            </div>
          </li>

          {}
          {personalRow({ type: "my" }, FileText, t("forum.myThreads"))}
          {personalRow(
            { type: "userPosts" },
            MessageSquare,
            t("forum.myMessages"),
          )}
          {personalRow({ type: "read" }, Eye, t("forum.readThreads"))}
          {personalRow({ type: "bookmarks" }, Bookmark, t("forum.bookmarks"))}

          {}
          {tabs.map((tab) => {
            const active =
              section.type === "customTab" && section.tabId === tab.id;
            return (
              <li key={tab.id}>
                <div
                  className={`${styles.nodeRow} ${
                    active ? styles.nodeRowActive : ""
                  }`}
                >
                  <span className={styles.nodeChevron} />
                  <button
                    type="button"
                    className={styles.nodeLink}
                    onClick={() =>
                      selectCustomTab({
                        id: tab.id,
                        name: tab.name,
                        forumIds: tab.forumIds,
                        filters: tab.filters,
                      })
                    }
                  >
                    <NodeSvgIcon Fallback={Bookmark} />
                    <span className={styles.forumTitle}>{tab.name}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.nodeRemove}
                    title={t("forum.tab.remove")}
                    aria-label={t("forum.tab.remove")}
                    onClick={() => removeTab(tab.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              </li>
            );
          })}

          {}
          <li>
            <div className={styles.nodeRow}>
              <span className={styles.nodeChevron} />
              <button
                type="button"
                className={styles.nodeLink}
                onClick={() => setCreateTabOpen(true)}
              >
                <NodeSvgIcon Fallback={Plus} />
                <span className={styles.forumTitle}>
                  {t("forum.tab.create")}
                </span>
              </button>
            </div>
          </li>

          {}
          {tree.isLoading && (
            <li className={styles.sideHint}>{t("forum.loading")}</li>
          )}
          {tree.data && !tree.data.ok && (
            <li className={styles.sideHint}>{t("forum.loadError")}</li>
          )}
          {tree.data?.ok &&
            visibleTree.map((node) => (
              <TopNode key={node.forumId} node={node} expanded={filtering} />
            ))}
          {tree.data?.ok && filtering && visibleTree.length === 0 && (
            <li className={styles.sideHint}>{t("forum.searchEmpty")}</li>
          )}
        </ol>
      </div>

      {}
      <SympathyWidget />

      {}
      <div className={styles.sidebarWrapper}>
        <div className={styles.categoryStrip}>{t("forum.misc.title")}</div>
        <nav className={styles.miscList}>
          {MISC_LINKS.map(({ key, path, Icon }) => (
            <button
              key={key}
              type="button"
              className={styles.miscItem}
              onClick={() => window.open(getForumWebBase() + path, "_blank")}
            >
              <Icon size={16} />
              <span>{t(`forum.misc.${key}`)}</span>
            </button>
          ))}
        </nav>
      </div>

      {}
      <div className={styles.sideFooter}>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>
            {t("forum.misc.complaintsEmail")}
          </span>
          <span>admin@lolz.team</span>
        </div>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>Mobile App Support:</span>
          <span>mobile@lolz.team</span>
        </div>
        <div className={styles.footerRow}>
          <button
            type="button"
            className={styles.footerLink}
            onClick={() =>
              window.open("https" + "://" + "xenforo.com", "_blank")
            }
          >
            Forum software by XenForo
          </button>
          <span className={styles.footerMuted}>2010-2019 XenForo Ltd.</span>
        </div>
        <div className={styles.footerMuted}>
          Fitvana Limited, Company No. 79698379, 18 Harbour Road, 35/F, Central
          Plaza, Wanchai, Hong Kong Island, Hong Kong
        </div>
      </div>

      <CreateTabModal
        open={createTabOpen}
        forumId={
          section.type === "forum" || section.type === "customTab"
            ? section.forumId
            : 0
        }
        forumTitle={
          section.type === "forum" || section.type === "customTab"
            ? section.title
            : t("forum.allDiscussions")
        }
        onClose={() => setCreateTabOpen(false)}
      />
    </aside>
  );
};
