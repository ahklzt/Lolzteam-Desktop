
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, X } from "lucide-react";
import type { ForumNode } from "@lzt/shared";
import {
  CONTEST_HIDDEN_IDS,
  DEFAULT_FORUM_FILTERS,
  type ForumFilters,
  type ForumOrder,
  useForumStore,
} from "./forum-store";
import { useForumPrefixes, useForumTree } from "./forum-hooks";
import { useForumTabsStore } from "./forum-tabs-store";
import styles from "./forum.module.scss";

interface Props {
  open: boolean;
  onClose: () => void;
  forumId: number;
  forumTitle: string;
}

const ORDER_OPTIONS: Array<{ value: ForumOrder; key: string }> = [
  { value: "last_post_date", key: "forum.filter.byLastReply" },
  { value: "thread_create_date", key: "forum.filter.byCreateDate" },
  { value: "thread_post_count", key: "forum.filter.byReplies" },
  { value: "first_post_likes", key: "forum.filter.byLikes" },
];

const flattenForums = (
  nodes: ForumNode[],
  depth = 0,
): Array<{ forumId: number; title: string; depth: number }> => {
  const out: Array<{ forumId: number; title: string; depth: number }> = [];
  for (const node of nodes) {
    if (CONTEST_HIDDEN_IDS.has(node.forumId)) continue;
    out.push({ forumId: node.forumId, title: node.title, depth });
    if (node.children.length > 0) {
      out.push(...flattenForums(node.children, depth + 1));
    }
  }
  return out;
};

export const CreateTabModal = ({
  open,
  onClose,
  forumId,
  forumTitle,
}: Props) => {
  const { t } = useTranslation();
  const treeQ = useForumTree();
  const prefixesQ = useForumPrefixes(forumId);
  const addTab = useForumTabsStore((s) => s.addTab);
  const selectCustomTab = useForumStore((s) => s.selectCustomTab);

  const [selectedIds, setSelectedIds] = useState<number[]>([forumId]);
  const [name, setName] = useState(forumTitle);
  const [filters, setLocalFilters] = useState<ForumFilters>({
    ...DEFAULT_FORUM_FILTERS,
  });
  const [isDefault, setIsDefault] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedIds([forumId]);
      setName(forumTitle);
      setLocalFilters({ ...DEFAULT_FORUM_FILTERS });
      setIsDefault(false);
    }
  }, [open, forumId, forumTitle]);

  const forumList = useMemo(
    () => (treeQ.data?.ok ? flattenForums(treeQ.data.forums) : []),
    [treeQ.data],
  );

  const forumById = useMemo(() => {
    const m = new Map<
      number,
      { forumId: number; title: string; depth: number }
    >();
    for (const f of forumList) m.set(f.forumId, f);
    return m;
  }, [forumList]);

  useEffect(() => {
    if (!sectionsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        sectionsRef.current &&
        !sectionsRef.current.contains(e.target as Node)
      ) {
        setSectionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sectionsOpen]);

  const prefixOptions = useMemo(() => {
    if (!prefixesQ.data?.ok) return [];
    return prefixesQ.data.info.groups.flatMap((g) => g.prefixes);
  }, [prefixesQ.data]);

  if (!open) return null;

  const toggleForum = (id: number) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const patch = (p: Partial<ForumFilters>) =>
    setLocalFilters((f) => ({ ...f, ...p }));

  const prefixValue = (v: number | null) => (v === null ? "" : String(v));
  const parsePrefix = (raw: string): number | null =>
    raw === "" ? null : Number(raw);

  const submit = () => {
    const forumIds = [...new Set(selectedIds)];
    if (forumIds.length === 0) return;
    const tab = addTab({
      name: name.trim() || forumTitle,
      forumIds,
      filters,
      isDefault,
    });
    selectCustomTab(tab);
    onClose();
  };

  return (
    <div className={styles.tabModalBackdrop} onClick={onClose}>
      <div className={styles.tabModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.tabModalHead}>
          <span>{t("forum.tab.title")}</span>
          <button
            type="button"
            className={styles.tabModalClose}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        <form
          className={styles.tabModalForm}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className={styles.tabModalBody}>
            <div className={styles.tabField}>
            <label className={styles.tabLabel}>
              {t("forum.tab.sectionsLabel")}
            </label>
            <div className={styles.prefixBox} ref={sectionsRef}>
              <button
                type="button"
                className={styles.prefixControl}
                onClick={() => setSectionsOpen((v) => !v)}
              >
                {selectedIds.length === 0 ? (
                  <span className={styles.prefixPlaceholder}>
                    {t("forum.tab.sectionsPlaceholder")}
                  </span>
                ) : (
                  <span className={styles.prefixChips}>
                    {selectedIds.map((id) => {
                      const f = forumById.get(id);
                      if (!f) return null;
                      return (
                        <span key={id} className={styles.prefixChip}>
                          {f.title}
                          <span
                            className={styles.prefixChipX}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleForum(id);
                            }}
                          >
                            <X size={12} />
                          </span>
                        </span>
                      );
                    })}
                  </span>
                )}
                <ChevronDown size={16} className={styles.prefixCaret} />
              </button>

              {sectionsOpen && (
                <div className={styles.prefixMenu}>
                  {forumList.map((f) => (
                    <button
                      key={f.forumId}
                      type="button"
                      className={`${styles.prefixOption} ${
                        selectedIds.includes(f.forumId)
                          ? styles.prefixOptionActive
                          : ""
                      }`}
                      style={{ paddingLeft: 12 + f.depth * 14 }}
                      onClick={() => toggleForum(f.forumId)}
                    >
                      {f.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>

            <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.tab.nameLabel")}
              </label>
              <input
                className={styles.tabInput}
                value={name}
                maxLength={32}
                placeholder={t("forum.tab.namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <details className={styles.tabAdvanced}>
            <summary>{t("forum.filter.label")}</summary>
            <div className={styles.tabAdvancedBody}>
              <div className={styles.tabRow}>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.prefixAny")}
              </label>
              <select
                className={styles.tabInput}
                value={prefixValue(filters.prefixId)}
                onChange={(e) =>
                  patch({ prefixId: parsePrefix(e.target.value) })
                }
              >
                <option value="">{t("forum.section.prefixAny")}</option>
                {prefixOptions.map((p) => (
                  <option key={p.prefixId} value={p.prefixId}>
                    {p.title}
                  </option>
                ))}
              </select>
                </div>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.prefixExclude")}
              </label>
              <select
                className={styles.tabInput}
                value={prefixValue(filters.excludePrefixId)}
                onChange={(e) =>
                  patch({ excludePrefixId: parsePrefix(e.target.value) })
                }
              >
                <option value="">{t("forum.section.prefixExclude")}</option>
                {prefixOptions.map((p) => (
                  <option key={p.prefixId} value={p.prefixId}>
                    {p.title}
                  </option>
                ))}
              </select>
                </div>
              </div>

              <div className={styles.tabRow}>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.filter.label")}
              </label>
              <select
                className={styles.tabInput}
                value={filters.order}
                onChange={(e) =>
                  patch({ order: e.target.value as ForumOrder })
                }
              >
                {ORDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.key)}
                  </option>
                ))}
              </select>
                </div>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.direction")}
              </label>
              <select
                className={styles.tabInput}
                value={filters.direction}
                onChange={(e) =>
                  patch({ direction: e.target.value as "asc" | "desc" })
                }
              >
                <option value="desc">{t("forum.section.desc")}</option>
                <option value="asc">{t("forum.section.asc")}</option>
              </select>
                </div>
              </div>

              <div className={styles.tabRow}>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.periodAny")}
              </label>
              <select
                className={styles.tabInput}
                value={filters.period}
                onChange={(e) =>
                  patch({ period: e.target.value as ForumFilters["period"] })
                }
              >
                <option value="">{t("forum.section.periodAny")}</option>
                <option value="day">{t("forum.section.periodDay")}</option>
                <option value="week">{t("forum.section.periodWeek")}</option>
                <option value="month">{t("forum.section.periodMonth")}</option>
                <option value="year">{t("forum.section.periodYear")}</option>
              </select>
                </div>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.stateAll")}
              </label>
              <select
                className={styles.tabInput}
                value={filters.state}
                onChange={(e) =>
                  patch({ state: e.target.value as ForumFilters["state"] })
                }
              >
                <option value="">{t("forum.section.stateAll")}</option>
                <option value="active">{t("forum.section.stateActive")}</option>
                <option value="closed">{t("forum.section.stateClosed")}</option>
              </select>
                </div>
              </div>

              <div className={styles.tabRow}>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>
                {t("forum.section.from")}
              </label>
              <input
                type="date"
                className={styles.tabInput}
                value={filters.dateFrom ?? ""}
                onChange={(e) => patch({ dateFrom: e.target.value || null })}
              />
                </div>
                <div className={styles.tabField}>
              <label className={styles.tabLabel}>{t("forum.section.to")}</label>
              <input
                type="date"
                className={styles.tabInput}
                value={filters.dateTo ?? ""}
                onChange={(e) => patch({ dateTo: e.target.value || null })}
              />
                </div>
              </div>
            </div>
            </details>

            <label className={styles.tabToggle}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span className={styles.tabToggleText}>
                <span className={styles.tabToggleTitle}>
                  {t("forum.tab.makeDefault")}
                </span>
                <span className={styles.tabToggleDesc}>
                  {t("forum.tab.makeDefaultDesc")}
                </span>
              </span>
            </label>

            <div className={styles.tabSubmitContainer}>
              <button
                type="submit"
                className={styles.tabSubmitBtn}
                disabled={selectedIds.length === 0}
              >
                {t("forum.tab.create")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
