import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, RefreshCw, RotateCcw, Search } from "lucide-react";
import { getForumWebBase } from "@lzt/shared";
import {
  DEFAULT_FORUM_FILTERS,
  type ForumFilters,
  type ForumOrder,
  useForumStore,
} from "./forum-store";
import styles from "./forum.module.scss";

type SpecialSectionType = "my" | "read" | "bookmarks" | "scheduled";

interface Props {
  sectionType: SpecialSectionType;
  title: string;
  total: number | null;
  loadedCount: number;
  onRefresh: () => void;
}

const BASE_ORDER_OPTIONS: Array<{ value: ForumOrder; key: string }> = [
  { value: "last_post_date", key: "forum.filter.byLastReply" },
  { value: "thread_create_date", key: "forum.filter.byCreateDate" },
  { value: "thread_post_count", key: "forum.filter.byReplies" },
  { value: "first_post_likes", key: "forum.filter.byLikes" },
  { value: "noReply", key: "forum.filter.noReplies" },
];

const defaultOrderFor = (sectionType: SpecialSectionType): ForumOrder => {
  if (sectionType === "read") return "last_read_date";
  if (sectionType === "bookmarks") return "bookmark_date";
  return "last_post_date";
};

export const ForumListHeader = ({
  sectionType,
  title,
  total,
  loadedCount,
  onRefresh,
}: Props) => {
  const { t } = useTranslation();
  const filters = useForumStore((state) => state.filters);
  const setFilters = useForumStore((state) => state.setFilters);
  const [titleDraft, setTitleDraft] = useState(filters.title);

  useEffect(() => {
    setTitleDraft(filters.title);
  }, [filters.title]);

  const orderOptions = useMemo(() => {
    if (sectionType === "read") {
      return [
        ...BASE_ORDER_OPTIONS,
        { value: "last_read_date" as ForumOrder, key: "forum.filter.byReadDate" },
      ];
    }
    if (sectionType === "bookmarks") {
      return [
        ...BASE_ORDER_OPTIONS,
        {
          value: "bookmark_date" as ForumOrder,
          key: "forum.filter.byBookmarkDate",
        },
      ];
    }
    return BASE_ORDER_OPTIONS;
  }, [sectionType]);

  const applyTitle = () => {
    const next = titleDraft.trim();
    if (next !== filters.title) setFilters({ title: next });
  };

  const reset = () => {
    const order = defaultOrderFor(sectionType);
    setTitleDraft("");
    setFilters({ ...DEFAULT_FORUM_FILTERS, order });
  };

  const openSavedMessages = () => {
    window.open(`${getForumWebBase()}/conversations/saved-messages`, "_blank");
  };

  const foundCount = total ?? loadedCount;

  return (
    <section className={styles.specialListHeader}>
      <div className={styles.specialTitleRow}>
        <h2 className={styles.specialTitle}>{title}</h2>
        <button
          type="button"
          className={styles.specialRefresh}
          onClick={onRefresh}
          title={t("forum.refreshFeed")}
          aria-label={t("forum.refreshFeed")}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {sectionType === "bookmarks" && (
        <div className={styles.bookmarkHelp}>
          <div className={styles.bookmarkHelpText}>
            <strong>
              {t("forum.bookmarksHelpTitle", {
                defaultValue: "Где найти Избранное?",
              })}
            </strong>
            <span>
              {t("forum.bookmarksHelpDescription", {
                defaultValue:
                  "Все избранные сообщения сохраняются в личном чате с собой. Быстро перейти к ним можно по кнопке ниже.",
              })}
            </span>
          </div>
          <button
            type="button"
            className={styles.bookmarkHelpButton}
            onClick={openSavedMessages}
          >
            {t("forum.openSavedMessages", {
              defaultValue: "Перейти в Избранное",
            })}
          </button>
        </div>
      )}

      <div className={styles.specialFilters}>
        <div className={styles.specialFilterRow}>
          <select
            className={styles.sfSelect}
            value={filters.order}
            onChange={(event) =>
              setFilters({ order: event.target.value as ForumOrder })
            }
            aria-label={t("forum.filter.label")}
          >
            {orderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key, {
                  defaultValue:
                    option.value === "last_read_date"
                      ? "По дате прочтения темы"
                      : option.value === "bookmark_date"
                        ? "По дате добавления в закладки"
                        : undefined,
                })}
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
              setFilters({
                period: event.target.value as ForumFilters["period"],
              })
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
        </div>

        <div className={styles.specialFilterBottom}>
          <div className={styles.specialDateRange}>
            <CalendarDays size={15} />
            <input
              type="date"
              className={styles.sfDate}
              value={filters.dateFrom ?? ""}
              onChange={(event) =>
                setFilters({ dateFrom: event.target.value || null })
              }
              aria-label={t("forum.section.createDate")}
            />
            <span>{t("forum.section.to")}</span>
            <input
              type="date"
              className={styles.sfDate}
              value={filters.dateTo ?? ""}
              onChange={(event) =>
                setFilters({ dateTo: event.target.value || null })
              }
              aria-label={t("forum.section.to")}
            />
          </div>

          <div className={styles.specialSearch}>
            <Search size={15} />
            <input
              value={titleDraft}
              placeholder={t("forum.section.searchThreads")}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={applyTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyTitle();
              }}
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

          <button type="button" className={styles.specialReset} onClick={reset}>
            <RotateCcw size={14} />
            <span>{t("forum.filter.reset", { defaultValue: "Сбросить" })}</span>
          </button>
        </div>
      </div>

      {sectionType === "my" && (
        <div className={styles.matchedThreadCount}>
          {t("forum.foundThreads", {
            count: foundCount,
            defaultValue: `Найдено тем: ${foundCount}.`,
          })}
        </div>
      )}
    </section>
  );
};
