
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "~/stores/settings";
import { askConfirm } from "~/widgets/ConfirmDialog/confirm-store";
import { applySendDelay } from "~/lib/sendDelay";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderTree,
  Gift,
  Hash,
  Minus,
  Plus,
  Search,
  Tag,
  Vote,
  X,
} from "lucide-react";
import type { ForumNode, ForumPrefixOption } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { Modal } from "~/widgets/Modal/Modal";
import { Dropdown } from "~/widgets/Dropdown/Dropdown";
import { Toggle } from "~/widgets/Toggle/Toggle";
import {
  useForumStore,
  CONTEST_FORUM_ID,
  CONTEST_HIDDEN_IDS,
} from "./forum-store";
import { useForumTree, useForumPrefixes } from "./forum-hooks";
import { sortForumTree } from "./forum-order";
import { ForumEditor } from "./ForumEditor";
import styles from "./forum.module.scss";

const TITLE_SOFT_LIMIT = 120;

export const REPLY_GROUPS: Array<{ value: number; key: string }> = [
  { value: 0, key: "staff" },
  { value: 2, key: "all" },
  { value: 21, key: "local" },
  { value: 22, key: "resident" },
  { value: 23, key: "expert" },
  { value: 60, key: "guru" },
  { value: 351, key: "ai" },
];

const CONTEST_LENGTH_OPTIONS = [
  { value: "minutes", key: "minutes" },
  { value: "hours", key: "hours" },
  { value: "days", key: "days" },
] as const;

const CONTEST_PRIZE_TYPES = [
  { value: "money", key: "money" },
  { value: "upgrades", key: "upgrades" },
] as const;

const CONTEST_UPGRADES: Array<{ value: number; key: string }> = [
  { value: 1, key: "supreme" },
  { value: 6, key: "legend" },
  { value: 12, key: "antipublicPlus" },
  { value: 14, key: "uniq" },
  { value: 17, key: "photoleaks" },
  { value: 19, key: "autoGiveaway" },
  { value: 20, key: "antipublicPremium5000" },
  { value: 21, key: "antipublicPremium500" },
  { value: 22, key: "autoBuyMarket" },
];

const findPath = (
  nodes: ForumNode[],
  id: number,
  trail: ForumNode[],
): ForumNode[] | null => {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.forumId === id) return next;
    const deep = findPath(node.children, id, next);
    if (deep) return deep;
  }
  return null;
};

const flattenForums = (nodes: ForumNode[], out: ForumNode[]): void => {
  for (const node of nodes) {
    if (!node.isCategory) out.push(node);
    flattenForums(node.children, out);
  }
};

const pickIconNode = (node: ForumNode, size: number) =>
  node.iconContent ? (
    <span className={styles.pickGlyph} style={{ fontSize: size }}>
      {node.iconContent}
    </span>
  ) : node.children.length > 0 ? (
    <FolderTree size={size} />
  ) : (
    <Hash size={size} />
  );

const pad2 = (n: number) => String(n).padStart(2, "0");
const nowDate = () => {
  const d = new Date();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const PrefixSelect = ({
  forumId,
  value,
  onChange,
}: {
  forumId: number;
  value: number[];
  onChange: (next: number[]) => void;
}) => {
  const { t } = useTranslation();
  const prefixes = useForumPrefixes(forumId);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const groups = prefixes.data?.ok ? prefixes.data.info.groups : [];

  const byId = useMemo(() => {
    const map = new Map<number, ForumPrefixOption>();
    for (const g of groups) for (const p of g.prefixes) map.set(p.prefixId, p);
    return map;
  }, [groups]);

  const hasAny = groups.some((g) => g.prefixes.length > 0);
  if (!prefixes.isLoading && !hasAny) return null;

  const toggle = (id: number) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  return (
    <div className={styles.composeField}>
      <div className={styles.composeLabel}>{t("forum.form.prefix")}</div>
      <div className={styles.composeHint}>{t("forum.form.prefixHint")}</div>
      <div className={styles.prefixBox} ref={boxRef}>
        <button
          type="button"
          className={styles.prefixControl}
          onClick={() => setOpen((v) => !v)}
        >
          {value.length === 0 ? (
            <span className={styles.prefixPlaceholder}>
              {t("forum.form.prefixPlaceholder")}
            </span>
          ) : (
            <span className={styles.prefixChips}>
              {value.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <span
                    key={id}
                    className={styles.prefixChip}
                    style={p.color ? { color: p.color } : undefined}
                  >
                    {p.title}
                    <span
                      className={styles.prefixChipX}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(id);
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

        {open && (
          <div className={styles.prefixMenu}>
            {groups.map((g, gi) => (
              <div key={gi} className={styles.prefixGroup}>
                {g.groupTitle && (
                  <div className={styles.prefixGroupTitle}>{g.groupTitle}</div>
                )}
                {g.prefixes.map((p) => (
                  <button
                    key={p.prefixId}
                    type="button"
                    className={`${styles.prefixOption} ${
                      value.includes(p.prefixId)
                        ? styles.prefixOptionActive
                        : ""
                    }`}
                    style={p.color ? { color: p.color } : undefined}
                    onClick={() => toggle(p.prefixId)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CreateThread = () => {
  const { t } = useTranslation();
  const createOpen = useForumStore((s) => s.createOpen);
  const createForumId = useForumStore((s) => s.createForumId);
  const closeCreate = useForumStore((s) => s.closeCreate);
  const openThread = useForumStore((s) => s.openThread);
  const tree = useForumTree();

  const [step, setStep] = useState<"select" | "compose">("select");
  const [forumId, setForumId] = useState<number | null>(createForumId);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [prefixIds, setPrefixIds] = useState<number[]>([]);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [replyGroup, setReplyGroup] = useState(2);
  const [commentIgnore, setCommentIgnore] = useState(false);
  const [maxReplyOn, setMaxReplyOn] = useState(false);
  const [maxReplyCount, setMaxReplyCount] = useState(10);
  const [delayOn, setDelayOn] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(1);
  const [dontAlert, setDontAlert] = useState(false);
  const [hideContacts, setHideContacts] = useState(false);
  const [watchThread, setWatchThread] = useState(false);
  const [watchEmail, setWatchEmail] = useState(false);

  const [mode, setMode] = useState<"thread" | "contest">("thread");
  const [lengthValue, setLengthValue] = useState(1);
  const [lengthOption, setLengthOption] = useState<
    "minutes" | "hours" | "days"
  >("days");
  const [prizeType, setPrizeType] = useState<"money" | "upgrades">("money");
  const [countWinners, setCountWinners] = useState(1);
  const [prizeMoney, setPrizeMoney] = useState(0);
  const [isMoneyPlaces, setIsMoneyPlaces] = useState(false);
  const [prizePlaces, setPrizePlaces] = useState<number[]>([]);
  const [prizeUpgrade, setPrizeUpgrade] = useState(1);
  const [requireLikeCount, setRequireLikeCount] = useState(0);
  const [requireTotalLikeCount, setRequireTotalLikeCount] = useState(0);
  const [secretAnswer, setSecretAnswer] = useState("");
  const [allowAskHidden, setAllowAskHidden] = useState(false);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    setForumId(createForumId);
    setStep(createForumId ? "compose" : "select");
    setExpanded(new Set());
    setQuery("");
    setTitle("");
    setBody("");
    setTags("");
    setPrefixIds([]);
    setScheduleOn(false);
    setScheduleDate("");
    setScheduleTime("");
    setReplyGroup(2);
    setCommentIgnore(false);
    setMaxReplyOn(false);
    setMaxReplyCount(10);
    setDelayOn(false);
    setDelayMinutes(1);
    setDontAlert(false);
    setHideContacts(false);
    setWatchThread(false);
    setWatchEmail(false);
    setMode("thread");
    setLengthValue(1);
    setLengthOption("days");
    setPrizeType("money");
    setCountWinners(1);
    setPrizeMoney(0);
    setIsMoneyPlaces(false);
    setPrizePlaces([]);
    setPrizeUpgrade(1);
    setRequireLikeCount(0);
    setRequireTotalLikeCount(0);
    setSecretAnswer("");
    setAllowAskHidden(false);
  }, [createOpen, createForumId]);

  const roots = useMemo(
    () => (tree.data?.ok ? sortForumTree(tree.data.forums) : []),
    [tree.data],
  );

  const categoryGroups = useMemo(
    () => roots.filter((n) => n.isCategory && n.children.length > 0),
    [roots],
  );
  const miscForums = useMemo(() => roots.filter((n) => !n.isCategory), [roots]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const all: ForumNode[] = [];
    flattenForums(roots, all);
    return all.filter(
      (f) =>
        !CONTEST_HIDDEN_IDS.has(f.forumId) && f.title.toLowerCase().includes(q),
    );
  }, [roots, query]);

  const selectedPath = useMemo(
    () => (forumId === null ? null : findPath(roots, forumId, [])),
    [roots, forumId],
  );
  const selected = selectedPath ? selectedPath[selectedPath.length - 1] : null;
  const breadcrumb = selectedPath
    ? selectedPath.map((n) => n.title).join(" / ")
    : "";

  const canSubmit = Boolean(forumId && title.trim() && body.trim());
  const canSubmitContest = Boolean(
    title.trim() && body.trim() && lengthValue >= 1,
  );

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickForum = (node: ForumNode) => {
    setForumId(node.forumId);
    if (node.children.length > 0) toggle(node.forumId);
  };

  const toggleSchedule = (on: boolean) => {
    setScheduleOn(on);
    if (on && !scheduleDate) {
      setScheduleDate(nowDate());
      setScheduleTime(nowTime());
    }
  };

  const submit = async () => {
    if (!canSubmit || !forumId) {
      pushToast({ kind: "error", title: t("forum.form.validation") });
      return;
    }
    if (sending) return;
    const warn = useSettingsStore.getState().snapshot?.settings.warnSendThread;
    if (warn) {
      const confirmed = await askConfirm({
        message: "Вы точно хотите отправить данную тему?",
      });
      if (!confirmed) return;
    }
    setSending(true);
    try {
      await applySendDelay();
      const res = await window.moderator.forum.createThread({
        forumId,
        title: title.trim(),
        body: body.trim(),
        tags: tags.trim() || undefined,
        prefixIds: prefixIds.length > 0 ? prefixIds : undefined,
        replyGroup,
        commentIgnoreGroup: commentIgnore || undefined,
        hideContacts: hideContacts || undefined,
        dontAlertFollowers: dontAlert || undefined,
        watchThread: watchThread || undefined,
        watchThreadEmail: watchThread && watchEmail ? true : undefined,
        scheduleDate: scheduleOn && scheduleDate ? scheduleDate : undefined,
        scheduleTime: scheduleOn && scheduleTime ? scheduleTime : undefined,
        maxReplyCount: maxReplyOn ? maxReplyCount : undefined,
        replyDelay: delayOn ? delayMinutes : undefined,
      });
      if (res.ok) {
        pushToast({ kind: "success", title: t("forum.form.created") });
        closeCreate();
        if (res.threadId) openThread(res.threadId);
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setSending(false);
    }
  };

  const submitContest = async () => {
    if (!canSubmitContest) {
      pushToast({ kind: "error", title: t("forum.form.validation") });
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      const res = await window.moderator.forum.createContest({
        forumId: CONTEST_FORUM_ID,
        title: title.trim(),
        body: body.trim(),
        contestType: "by_finish_date",
        lengthValue,
        lengthOption,
        prizeType,
        countWinners,
        prizeMoney: prizeType === "money" ? prizeMoney : undefined,
        isMoneyPlaces:
          prizeType === "money" && isMoneyPlaces ? true : undefined,
        prizePlaces:
          prizeType === "money" && isMoneyPlaces
            ? prizePlaces.slice(0, countWinners).map((n) => n || 0)
            : undefined,
        prizeUpgrade: prizeType === "upgrades" ? prizeUpgrade : undefined,
        requireLikeCount,
        requireTotalLikeCount,
        secretAnswer: secretAnswer.trim() || undefined,
        tags: tags.trim() || undefined,
        replyGroup,
        commentIgnoreGroup: commentIgnore || undefined,
        dontAlertFollowers: dontAlert || undefined,
        hideContacts: hideContacts || undefined,
        allowAskHiddenContent: allowAskHidden || undefined,
        watchThread: watchThread || undefined,
        watchThreadEmail: watchThread && watchEmail ? true : undefined,
        scheduleDate: scheduleOn && scheduleDate ? scheduleDate : undefined,
        scheduleTime: scheduleOn && scheduleTime ? scheduleTime : undefined,
      });
      if (res.ok) {
        pushToast({ kind: "success", title: t("forum.contest.created") });
        closeCreate();
        if (res.threadId) openThread(res.threadId);
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setSending(false);
    }
  };

  const renderNode = (node: ForumNode) => {
    if (CONTEST_HIDDEN_IDS.has(node.forumId)) return null;
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.forumId);
    const active = forumId === node.forumId;
    return (
      <Fragment key={node.forumId}>
        <button
          type="button"
          className={`${styles.pickItem} ${active ? styles.pickItemActive : ""}`}
          onClick={() => pickForum(node)}
        >
          <span className={styles.pickIcon}>{pickIconNode(node, 17)}</span>
          <b className={styles.pickItemTitle}>{node.title}</b>
          {hasChildren && (
            <span className={styles.pickChevron}>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
        </button>
        {hasChildren && isOpen && (
          <div className={styles.pickSub}>
            <div className={styles.pickGrid}>
              {node.children.map((child) => renderNode(child))}
            </div>
          </div>
        )}
      </Fragment>
    );
  };

  const modalTitle =
    step === "select"
      ? t("forum.form.selectTitle")
      : mode === "contest"
        ? t("forum.contest.entry")
        : selected
          ? t("forum.form.composeTitle", { forum: selected.title })
          : t("forum.createThread");

  return (
    <Modal open={createOpen} onClose={closeCreate} wide title={modalTitle}>
      {step === "select" ? (
        <div className={styles.pickRoot}>
          <p className={styles.pickDescription}>
            {t("forum.form.selectDescription")}
          </p>

          {}
          <button
            type="button"
            className={styles.pollBtn}
            onClick={() => {
              setMode("contest");
              setForumId(CONTEST_FORUM_ID);
              setStep("compose");
            }}
          >
            <Gift size={16} />
            <span>{t("forum.contest.entry")}</span>
            <ChevronRight size={16} />
          </button>

          <div className={styles.pickSearch}>
            <Search size={15} />
            <input
              value={query}
              autoFocus
              placeholder={t("forum.form.searchForum")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className={styles.pickScroll}>
            {tree.isLoading && (
              <div className={styles.pickHint}>{t("forum.loading")}</div>
            )}
            {tree.data && !tree.data.ok && (
              <div className={styles.pickHint}>{t("forum.loadError")}</div>
            )}

            {}
            {searchResults !== null ? (
              searchResults.length === 0 ? (
                <div className={styles.pickHint}>
                  {t("forum.form.noForums")}
                </div>
              ) : (
                <div className={styles.pickGrid}>
                  {searchResults.map((forum) => (
                    <button
                      key={forum.forumId}
                      type="button"
                      className={`${styles.pickItem} ${
                        forumId === forum.forumId ? styles.pickItemActive : ""
                      }`}
                      onClick={() => setForumId(forum.forumId)}
                    >
                      <span className={styles.pickIcon}>
                        {pickIconNode(forum, 17)}
                      </span>
                      <b className={styles.pickItemTitle}>{forum.title}</b>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <>
                {categoryGroups.map((cat) => (
                  <div key={cat.forumId} className={styles.pickGroup}>
                    <div className={styles.pickGroupTitle}>{cat.title}</div>
                    <div className={styles.pickGrid}>
                      {cat.children.map((child) => renderNode(child))}
                    </div>
                  </div>
                ))}
                {miscForums.length > 0 && (
                  <div className={styles.pickGroup}>
                    <div className={styles.pickGroupTitle}>
                      {t("forum.form.other")}
                    </div>
                    <div className={styles.pickGrid}>
                      {miscForums.map((forum) => renderNode(forum))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {}
          {selected && (
            <div className={styles.pickFooter}>
              <span className={styles.pickFooterIcon}>
                {pickIconNode(selected, 22)}
              </span>
              <div className={styles.pickFooterInfo}>
                <div className={styles.pickFooterName}>{breadcrumb}</div>
                <div className={styles.pickFooterDesc}>
                  {selected.description ?? t("forum.form.noDescription")}
                </div>
              </div>
              <button
                type="button"
                className={styles.pickFooterBtn}
                onClick={() => setStep("compose")}
              >
                {t("forum.createThread")}
              </button>
            </div>
          )}
        </div>
      ) : mode === "contest" ? (
        <div className={styles.composeForm}>
          {}
          <button
            type="button"
            className={styles.pickBack}
            onClick={() => {
              setMode("thread");
              setStep("select");
            }}
          >
            <ChevronLeft size={15} />
            <span>{t("forum.contest.back")}</span>
          </button>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              <FileText size={13} />
              {t("forum.contest.title")}
            </div>
            <input
              className={`${styles.fieldInput} ${styles.createTitleInput}`}
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <ForumEditor
              value={body}
              onChange={setBody}
              placeholder={t("forum.contest.bodyPlaceholder")}
              rows={7}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.duration")}
            </div>
            <div className={styles.scheduleRow}>
              <input
                className={styles.stepperInput}
                type="number"
                min={1}
                value={lengthValue}
                onChange={(e) =>
                  setLengthValue(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <Dropdown
                value={lengthOption}
                onChange={setLengthOption}
                options={CONTEST_LENGTH_OPTIONS.map((o) => ({
                  value: o.value,
                  label: t(`forum.contest.length.${o.key}`),
                }))}
              />
            </div>
            <div className={styles.composeHint}>
              {t("forum.contest.durationHint")}
            </div>
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.prizeType")}
            </div>
            <Dropdown
              value={prizeType}
              onChange={setPrizeType}
              options={CONTEST_PRIZE_TYPES.map((o) => ({
                value: o.value,
                label: t(`forum.contest.prize.${o.key}`),
              }))}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.winners")}
            </div>
            <input
              className={styles.stepperInput}
              type="number"
              min={1}
              max={100}
              value={countWinners}
              onChange={(e) =>
                setCountWinners(
                  Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                )
              }
            />
          </div>

          {}
          {prizeType === "money" ? (
            <div className={styles.composeField}>
              <div className={styles.composeLabel}>
                {t("forum.contest.prizeMoney")}
              </div>
              <input
                className={styles.stepperInput}
                type="number"
                min={0}
                value={prizeMoney}
                onChange={(e) =>
                  setPrizeMoney(Math.max(0, Number(e.target.value) || 0))
                }
              />
              <Toggle
                checked={isMoneyPlaces}
                onChange={setIsMoneyPlaces}
                label={t("forum.contest.moneyPlaces")}
              />
              {isMoneyPlaces &&
                Array.from({ length: countWinners }).map((_, i) => (
                  <div key={i} className={styles.scheduleRow}>
                    <span className={styles.composeHint}>
                      {t("forum.contest.place", { n: i + 1 })}
                    </span>
                    <input
                      className={styles.stepperInput}
                      type="number"
                      min={0}
                      value={prizePlaces[i] ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setPrizePlaces((prev) => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        });
                      }}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.composeField}>
              <div className={styles.composeLabel}>
                {t("forum.contest.prizeUpgrade")}
              </div>
              <Dropdown
                value={prizeUpgrade}
                onChange={setPrizeUpgrade}
                options={CONTEST_UPGRADES.map((u) => ({
                  value: u.value,
                  label: t(`forum.contest.upgrades.${u.key}`),
                }))}
              />
            </div>
          )}

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.requireWeek")}
            </div>
            <input
              className={styles.stepperInput}
              type="number"
              min={0}
              value={requireLikeCount}
              onChange={(e) =>
                setRequireLikeCount(Math.max(0, Number(e.target.value) || 0))
              }
            />
          </div>
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.requireTotal")}
            </div>
            <input
              className={styles.stepperInput}
              type="number"
              min={0}
              value={requireTotalLikeCount}
              onChange={(e) =>
                setRequireTotalLikeCount(
                  Math.max(0, Number(e.target.value) || 0),
                )
              }
            />
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              <Tag size={13} />
              {t("forum.form.tags")}
            </div>
            <input
              className={styles.fieldInput}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.contest.secret")}
            </div>
            <div className={styles.composeHint}>
              {t("forum.contest.secretHint")}
            </div>
            <input
              className={styles.fieldInput}
              value={secretAnswer}
              onChange={(event) => setSecretAnswer(event.target.value)}
            />
          </div>

          {}
          <div className={styles.composeActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={sending || !canSubmitContest}
              onClick={() => void submitContest()}
            >
              {t("forum.contest.submit")}
            </button>
          </div>

          {}
          <div className={styles.radioGroup}>
            {REPLY_GROUPS.map((g) => (
              <label key={g.value} className={styles.radioRow}>
                <input
                  type="radio"
                  name="contestReplyGroup"
                  checked={replyGroup === g.value}
                  onChange={() => setReplyGroup(g.value)}
                />
                <span>{t(`forum.form.replyGroups.${g.key}`)}</span>
              </label>
            ))}
          </div>

          {}
          <div className={styles.composeField}>
            <Toggle
              checked={scheduleOn}
              onChange={toggleSchedule}
              label={t("forum.form.scheduleToggle")}
            />
            {scheduleOn && (
              <div className={styles.scheduleRow}>
                <input
                  className={styles.scheduleDate}
                  value={scheduleDate}
                  placeholder={t("forum.form.scheduleDatePlaceholder")}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <input
                  className={styles.scheduleTime}
                  value={scheduleTime}
                  placeholder={t("forum.form.scheduleTimePlaceholder")}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.form.settingsTitle")}
            </div>
            <Toggle
              checked={commentIgnore}
              onChange={setCommentIgnore}
              label={t("forum.form.commentIgnore")}
            />
            <Toggle
              checked={allowAskHidden}
              onChange={setAllowAskHidden}
              label={t("forum.contest.allowAskHidden")}
            />
            <Toggle
              checked={dontAlert}
              onChange={setDontAlert}
              label={t("forum.form.settingDontAlert")}
            />
            <Toggle
              checked={hideContacts}
              onChange={setHideContacts}
              label={t("forum.form.settingHideContacts")}
            />
            <Toggle
              checked={watchThread}
              onChange={setWatchThread}
              label={t("forum.form.settingWatch")}
            />
          </div>
        </div>
      ) : (
        <div className={styles.composeForm}>
          {}
          <button
            type="button"
            className={styles.pickBack}
            onClick={() => setStep("select")}
          >
            <ChevronLeft size={15} />
            <span>{t("forum.form.backToSelect")}</span>
            {selected && (
              <span className={styles.pickBackForum}>{selected.title}</span>
            )}
          </button>

          {}
          {forumId !== null && (
            <PrefixSelect
              forumId={forumId}
              value={prefixIds}
              onChange={setPrefixIds}
            />
          )}

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              <FileText size={13} />
              {t("forum.form.title")}
              <span className={styles.fieldCount}>
                {title.length}/{TITLE_SOFT_LIMIT}
              </span>
            </div>
            <div className={styles.composeHint}>
              {t("forum.form.titleHint")}
            </div>
            <input
              className={`${styles.fieldInput} ${styles.createTitleInput}`}
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <ForumEditor
              value={body}
              onChange={setBody}
              placeholder={t("forum.form.bodyPlaceholder")}
              rows={9}
            />
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              <Tag size={13} />
              {t("forum.form.tags")}
            </div>
            <div className={styles.composeHint}>{t("forum.form.tagsHint")}</div>
            <input
              className={styles.fieldInput}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>

          {}
          <div className={styles.composeActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={sending || !canSubmit}
              onClick={() => void submit()}
            >
              {t("forum.form.submit")}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() =>
                pushToast({ kind: "info", title: t("forum.form.previewSoon") })
              }
            >
              {t("forum.form.preview")}
            </button>
          </div>

          {}
          <div className={styles.composeField}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={scheduleOn}
                onChange={(e) => toggleSchedule(e.target.checked)}
              />
              <span>{t("forum.form.scheduleToggle")}</span>
            </label>
            {scheduleOn && (
              <div className={styles.scheduleRow}>
                <input
                  className={styles.scheduleDate}
                  value={scheduleDate}
                  placeholder={t("forum.form.scheduleDatePlaceholder")}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <input
                  className={styles.scheduleTime}
                  value={scheduleTime}
                  placeholder={t("forum.form.scheduleTimePlaceholder")}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {}
          <div className={styles.radioGroup}>
            {REPLY_GROUPS.map((g) => (
              <label key={g.value} className={styles.radioRow}>
                <input
                  type="radio"
                  name="replyGroup"
                  checked={replyGroup === g.value}
                  onChange={() => setReplyGroup(g.value)}
                />
                <span>{t(`forum.form.replyGroups.${g.key}`)}</span>
              </label>
            ))}
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={commentIgnore}
                onChange={(e) => setCommentIgnore(e.target.checked)}
              />
              <span>{t("forum.form.commentIgnore")}</span>
            </label>
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.form.maxRepliesTitle")}
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={maxReplyOn}
                onChange={(e) => setMaxReplyOn(e.target.checked)}
              />
              <span>{t("forum.form.maxRepliesToggle")}</span>
            </label>
            <div className={styles.stepper}>
              <input
                className={styles.stepperInput}
                type="number"
                min={1}
                value={maxReplyCount}
                disabled={!maxReplyOn}
                onChange={(e) =>
                  setMaxReplyCount(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <button
                type="button"
                className={styles.stepperBtn}
                disabled={!maxReplyOn}
                onClick={() => setMaxReplyCount((n) => n + 1)}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className={styles.stepperBtn}
                disabled={!maxReplyOn}
                onClick={() => setMaxReplyCount((n) => Math.max(1, n - 1))}
              >
                <Minus size={14} />
              </button>
            </div>
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.form.delayTitle")}
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={delayOn}
                onChange={(e) => setDelayOn(e.target.checked)}
              />
              <span>{t("forum.form.delayToggle")}</span>
            </label>
            <div className={styles.delayRow}>
              <input
                className={styles.stepperInput}
                type="number"
                min={1}
                value={delayMinutes}
                disabled={!delayOn}
                onChange={(e) =>
                  setDelayMinutes(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <span className={styles.delayUnit}>
                {t("forum.form.delayUnit")}
              </span>
            </div>
          </div>

          {}
          <div className={styles.composeField}>
            <div className={styles.composeLabel}>
              {t("forum.form.settingsTitle")}
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={dontAlert}
                onChange={(e) => setDontAlert(e.target.checked)}
              />
              <span>{t("forum.form.settingDontAlert")}</span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={hideContacts}
                onChange={(e) => setHideContacts(e.target.checked)}
              />
              <span>{t("forum.form.settingHideContacts")}</span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={watchThread}
                onChange={(e) => setWatchThread(e.target.checked)}
              />
              <span>{t("forum.form.settingWatch")}</span>
            </label>
            <label
              className={`${styles.checkRow} ${styles.checkRowSub} ${
                watchThread ? "" : styles.checkRowDisabled
              }`}
            >
              <input
                type="checkbox"
                checked={watchEmail}
                disabled={!watchThread}
                onChange={(e) => setWatchEmail(e.target.checked)}
              />
              <span>{t("forum.form.settingWatchEmail")}</span>
            </label>
          </div>

          {}
          <button
            type="button"
            className={styles.pollBtn}
            onClick={() =>
              pushToast({ kind: "info", title: t("forum.form.pollSoon") })
            }
          >
            <Vote size={16} />
            <span>{t("forum.form.addPoll")}</span>
          </button>
        </div>
      )}
    </Modal>
  );
};
