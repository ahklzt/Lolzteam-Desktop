
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BookOpen, Plus, RefreshCw, Search } from "lucide-react";
import { pushToast } from "~/stores/toast";
import { RichUsername } from "~/features/profile/RichUsername";
import { Avatar } from "./Avatar";
import { type ForumFilters, type ForumOrder, useForumStore } from "./forum-store";
import { useForumPrefixes, useForumSection } from "./forum-hooks";
import { CreateTabModal } from "./CreateTabModal";
import styles from "./forum.module.scss";

interface Props {
  forumId: number;
  displayTitle: string;
  loadedPages: number;
  total: number | null;
  onGoToPage: (page: number) => void;
  onRefresh: () => void;
}

const ORDER_OPTIONS: Array<{ value: ForumOrder; key: string }> = [
  { value: "last_post_date", key: "forum.filter.byLastReply" },
  { value: "thread_create_date", key: "forum.filter.byCreateDate" },
  { value: "thread_post_count", key: "forum.filter.byReplies" },
  { value: "first_post_likes", key: "forum.filter.byLikes" },
];

const THREADS_PER_PAGE = 20;
const MAX_NUMBERED = 6;

export const ForumSectionHeader = ({
  forumId,
  displayTitle,
  loadedPages,
  total,
  onGoToPage,
  onRefresh,
}: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sectionQ = useForumSection(forumId);
  const prefixesQ = useForumPrefixes(forumId);
  const filters = useForumStore((s) => s.filters);
  const setFilters = useForumStore((s) => s.setFilters);
  const openThread = useForumStore((s) => s.openThread);

  const [createTabOpen, setCreateTabOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(filters.title);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    setTitleDraft(filters.title);
  }, [filters.title]);
  useEffect(() => {
    setFollowOverride(null);
  }, [forumId]);

  const section = sectionQ.data?.ok ? sectionQ.data.section : null;
  const description = section?.description ?? "";
  const isFollowed = followOverride ?? section?.isFollowed ?? false;
  const threadCount = total ?? section?.threadCount ?? null;

  const prefixOptions = useMemo(() => {
    if (!prefixesQ.data?.ok) return [];
    return prefixesQ.data.info.groups.flatMap((g) => g.prefixes);
  }, [prefixesQ.data]);

  const totalPages = threadCount
    ? Math.max(1, Math.ceil(threadCount / THREADS_PER_PAGE))
    : 1;
  const numbered = Array.from(
    { length: Math.min(MAX_NUMBERED, totalPages) },
    (_, i) => i + 1,
  );
  const showLast = totalPages > MAX_NUMBERED;

  const openRules = () => {
    if (section?.rulesThreadId) {
      openThread(section.rulesThreadId);
      return;
    }
    if (section?.permalink) {
      window.open(section.permalink, "_blank");
      return;
    }
    pushToast({ kind: "info", title: t("forum.section.noRules") });
  };

  const toggleFollow = async () => {
    if (followBusy) return;
    setFollowBusy(true);
    const next = !isFollowed;
    setFollowOverride(next);
    const res = next
      ? await window.moderator.forum.follow(forumId)
      : await window.moderator.forum.unfollow(forumId);
    setFollowBusy(false);
    if (res.ok) {
      pushToast({
        kind: "success",
        title: next
          ? t("forum.section.followed")
          : t("forum.section.unfollowed"),
      });
      void queryClient.invalidateQueries({
        queryKey: ["forum", "section", forumId],
      });
    } else {
      setFollowOverride(!next);
      pushToast({ kind: "error", title: res.message ?? t("forum.loadError") });
    }
  };

  const applyTitle = () => {
    if (titleDraft !== filters.title) setFilters({ title: titleDraft });
  };

  const prefixValue = (v: number | null) => (v === null ? "" : String(v));
  const parsePrefix = (raw: string): number | null =>
    raw === "" ? null : Number(raw);

  return (
    <div className={styles.sectionHeader}>
      <div className={styles.secTitleRow}>
        <div>
          <h2 className={styles.secTitle}>{displayTitle}</h2>
          {description && <p className={styles.secDesc}>{description}</p>}
        </div>
      </div>

      <div className={styles.sectionNavRow}>
        <div className={styles.secActions}>
          <button type="button" className={styles.secBtn} onClick={openRules}>
            <BookOpen size={14} />
            <span>{t("forum.section.rules")}</span>
          </button>
          <button
            type="button"
            className={`${styles.secBtn} ${isFollowed ? styles.secBtnOn : ""}`}
            onClick={() => void toggleFollow()}
            disabled={followBusy}
          >
            {isFollowed ? <BellOff size={14} /> : <Bell size={14} />}
            <span>
              {isFollowed
                ? t("forum.section.unfollow")
                : t("forum.section.follow")}
            </span>
          </button>
          <button
            type="button"
            className={styles.secIconBtn}
            onClick={onRefresh}
            title={t("forum.section.refresh")}
            aria-label={t("forum.section.refresh")}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {totalPages > 1 && (
          <div className={styles.sectionPager}>
            {numbered.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.pagerBtn} ${
                  p === loadedPages ? styles.pagerBtnActive : ""
                }`}
                onClick={() => onGoToPage(p)}
              >
                {p}
              </button>
            ))}
            {showLast && (
              <>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() =>
                    onGoToPage(Math.min(loadedPages + 1, totalPages))
                  }
                  title={t("forum.nextPage")}
                >
                  ❯
                </button>
                <button
                  type="button"
                  className={`${styles.pagerBtn} ${
                    totalPages === loadedPages ? styles.pagerBtnActive : ""
                  }`}
                  onClick={() => onGoToPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {section && section.moderators.length > 0 && (
        <div className={styles.secModerators}>
          <span className={styles.secModLabel}>
            {t("forum.section.moderators")}
          </span>
          {section.moderators.map((m) => (
            <span key={m.userId} className={styles.secMod}>
              <Avatar
                url={m.avatarUrl}
                name={m.username}
                className={styles.secModAvatar}
              />
              <RichUsername
                html={m.usernameHtml}
                fallback={m.username}
                userId={m.userId}
                className={styles.secModNick}
              />
            </span>
          ))}
        </div>
      )}

      <div className={styles.filtersGrid}>
        <select
          className={styles.sfSelect}
          value={prefixValue(filters.prefixId)}
          onChange={(event) =>
            setFilters({ prefixId: parsePrefix(event.target.value) })
          }
          aria-label={t("forum.section.prefixAny")}
        >
          <option value="">{t("forum.section.prefixAny")}</option>
          {prefixOptions.map((prefix) => (
            <option key={prefix.prefixId} value={prefix.prefixId}>
              {prefix.title}
            </option>
          ))}
        </select>

        <select
          className={styles.sfSelect}
          value={prefixValue(filters.excludePrefixId)}
          onChange={(event) =>
            setFilters({ excludePrefixId: parsePrefix(event.target.value) })
          }
          aria-label={t("forum.section.prefixExclude")}
        >
          <option value="">{t("forum.section.prefixExclude")}</option>
          {prefixOptions.map((prefix) => (
            <option key={prefix.prefixId} value={prefix.prefixId}>
              {prefix.title}
            </option>
          ))}
        </select>

        <select
          className={styles.sfSelect}
          value={filters.order}
          onChange={(event) =>
            setFilters({ order: event.target.value as ForumOrder })
          }
          aria-label={t("forum.filter.label")}
        >
          {ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </select>

        <select
          className={styles.sfSelect}
          value={filters.direction}
          onChange={(event) =>
            setFilters({ direction: event.target.value as "asc" | "desc" })
          }
          aria-label={t("forum.section.desc")}
        >
          <option value="desc">{t("forum.section.desc")}</option>
          <option value="asc">{t("forum.section.asc")}</option>
        </select>

        <select
          className={styles.sfSelect}
          value={filters.period}
          onChange={(event) =>
            setFilters({ period: event.target.value as ForumFilters["period"] })
          }
          aria-label={t("forum.section.periodAny")}
        >
          <option value="">{t("forum.section.periodAny")}</option>
          <option value="day">{t("forum.section.periodDay")}</option>
          <option value="week">{t("forum.section.periodWeek")}</option>
          <option value="month">{t("forum.section.periodMonth")}</option>
          <option value="year">{t("forum.section.periodYear")}</option>
        </select>

        <select
          className={styles.sfSelect}
          value={filters.state}
          onChange={(event) =>
            setFilters({ state: event.target.value as ForumFilters["state"] })
          }
          aria-label={t("forum.section.stateAll")}
        >
          <option value="">{t("forum.section.stateAll")}</option>
          <option value="active">{t("forum.section.stateActive")}</option>
          <option value="closed">{t("forum.section.stateClosed")}</option>
        </select>

        <div className={styles.sfRange}>
          <span className={styles.sfRangeLabel}>
            {t("forum.section.createDate")}
          </span>
          <input
            type="date"
            className={styles.sfDate}
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
          />
          <span className={styles.sfRangeLabel}>{t("forum.section.to")}</span>
          <input
            type="date"
            className={styles.sfDate}
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters({ dateTo: e.target.value || null })}
          />
        </div>
      </div>

      <div className={styles.sfBottom}>
        <button
          type="button"
          className={styles.sfCreateTab}
          onClick={() => setCreateTabOpen(true)}
        >
          <Plus size={14} />
          <span>{t("forum.section.createTab")}</span>
        </button>

        <div className={styles.sfSearchRow}>
          <Search size={14} className={styles.sfSearchIcon} />
          <input
            className={styles.sfSearchInput}
            value={titleDraft}
            placeholder={t("forum.section.searchThreads")}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyTitle();
            }}
            onBlur={applyTitle}
          />
        </div>

        <label className={styles.sfCheck}>
          <input
            type="checkbox"
            checked={filters.titleOnly}
            onChange={(event) =>
              setFilters({ titleOnly: event.target.checked })
            }
          />
          <span>{t("forum.section.titleOnly")}</span>
        </label>
      </div>

      <CreateTabModal
        open={createTabOpen}
        onClose={() => setCreateTabOpen(false)}
        forumId={forumId}
        forumTitle={displayTitle}
      />
    </div>
  );
};
