
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { ForumThreadEditable } from "@lzt/shared";
import { pushToast } from "~/stores/toast";
import { Modal } from "~/widgets/Modal/Modal";
import { Dropdown } from "~/widgets/Dropdown/Dropdown";
import { Toggle } from "~/widgets/Toggle/Toggle";
import { PrefixSelect, REPLY_GROUPS } from "./CreateThread";
import { formatAbsoluteDate, useForumModeratorLog } from "./forum-hooks";
import styles from "./forum.module.scss";


interface EditThreadModalProps {
  threadId: number;
  forumId: number;
  editable: ForumThreadEditable;
  open: boolean;
  onClose: () => void;
}

export const EditThreadModal = ({
  threadId,
  forumId,
  editable,
  open,
  onClose,
}: EditThreadModalProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(editable.title);
  const [prefixIds, setPrefixIds] = useState<number[]>(editable.prefixIds);
  const [tags, setTags] = useState(editable.tags.join(", "));
  const [replyGroup, setReplyGroup] = useState<number>(
    editable.replyGroup ?? 2,
  );
  const [discussionOpen, setDiscussionOpen] = useState(editable.discussionOpen);
  const [hideContacts, setHideContacts] = useState(editable.hideContacts);
  const [allowAskHidden, setAllowAskHidden] = useState(
    editable.allowAskHiddenContent,
  );
  const [commentIgnore, setCommentIgnore] = useState(
    editable.commentIgnoreGroup,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editable.title);
    setPrefixIds(editable.prefixIds);
    setTags(editable.tags.join(", "));
    setReplyGroup(editable.replyGroup ?? 2);
    setDiscussionOpen(editable.discussionOpen);
    setHideContacts(editable.hideContacts);
    setAllowAskHidden(editable.allowAskHiddenContent);
    setCommentIgnore(editable.commentIgnoreGroup);
  }, [open, editable]);

  const replyGroupOptions = useMemo(
    () =>
      REPLY_GROUPS.map((g) => ({
        value: g.value,
        label: t(`forum.form.replyGroups.${g.key}`),
      })),
    [t],
  );

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const tagList = tags
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const res = await window.moderator.forum.editThread({
        threadId,
        title: trimmed,
        prefixIds,
        tags: tagList,
        discussionOpen,
        hideContacts,
        allowAskHiddenContent: allowAskHidden,
        replyGroup,
        commentIgnoreGroup: commentIgnore,
      });
      if (res.ok) {
        pushToast({ kind: "success", title: t("forum.manage.editSaved") });
        await queryClient.invalidateQueries({
          queryKey: ["forum", "thread", threadId],
        });
        onClose();
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("forum.manage.editTitle")} open={open} onClose={onClose}>
      <div className={styles.editThreadForm}>
        <div className={styles.composeField}>
          <div className={styles.composeLabel}>
            {t("forum.manage.editTitleField")}
          </div>
          <input
            className={styles.composeInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("forum.form.titlePlaceholder")}
          />
        </div>

        <PrefixSelect
          forumId={forumId}
          value={prefixIds}
          onChange={setPrefixIds}
        />

        <div className={styles.composeField}>
          <div className={styles.composeLabel}>{t("forum.manage.editTags")}</div>
          <input
            className={styles.composeInput}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("forum.form.tagsPlaceholder")}
          />
        </div>

        <div className={styles.composeField}>
          <div className={styles.composeLabel}>
            {t("forum.manage.editReplyGroup")}
          </div>
          <Dropdown
            value={replyGroup}
            options={replyGroupOptions}
            onChange={setReplyGroup}
          />
        </div>

        <div className={styles.editThreadToggles}>
          <Toggle
            checked={discussionOpen}
            onChange={setDiscussionOpen}
            label={t("forum.manage.editDiscussionOpen")}
          />
          <Toggle
            checked={hideContacts}
            onChange={setHideContacts}
            label={t("forum.manage.editHideContacts")}
          />
          <Toggle
            checked={allowAskHidden}
            onChange={setAllowAskHidden}
            label={t("forum.manage.editAllowAskHidden")}
          />
          <Toggle
            checked={commentIgnore}
            onChange={setCommentIgnore}
            label={t("forum.manage.editCommentIgnore")}
          />
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onClose}
            disabled={saving}
          >
            {t("forum.manage.deleteNo")}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void submit()}
            disabled={saving || title.trim().length === 0}
          >
            {t("forum.manage.editSave")}
          </button>
        </div>
      </div>
    </Modal>
  );
};


interface DeleteThreadModalProps {
  threadId: number;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteThreadModal = ({
  threadId,
  open,
  onClose,
  onDeleted,
}: DeleteThreadModalProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await window.moderator.forum.deleteThread(
        threadId,
        reason.trim() || undefined,
      );
      if (res.ok) {
        pushToast({ kind: "success", title: t("forum.manage.deleted") });
        onClose();
        onDeleted();
      } else {
        pushToast({
          kind: "error",
          title: res.message ?? t("forum.loadError"),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("forum.manage.deleteTitle")} open={open} onClose={onClose}>
      <div className={styles.confirmBody}>
        <p className={styles.confirmText}>{t("forum.manage.deleteConfirm")}</p>
        <input
          className={styles.composeInput}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("forum.manage.deleteReasonPlaceholder")}
        />
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onClose}
            disabled={busy}
          >
            {t("forum.manage.deleteNo")}
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={() => void submit()}
            disabled={busy}
          >
            {t("forum.manage.deleteYes")}
          </button>
        </div>
      </div>
    </Modal>
  );
};


interface ModeratorLogModalProps {
  threadId: number;
  open: boolean;
  onClose: () => void;
}

export const ModeratorLogModal = ({
  threadId,
  open,
  onClose,
}: ModeratorLogModalProps) => {
  const { t } = useTranslation();
  const logQuery = useForumModeratorLog(threadId, open);
  const entries = logQuery.data?.ok ? logQuery.data.entries : [];

  return (
    <Modal title={t("forum.manage.logTitle")} open={open} onClose={onClose}>
      <div className={styles.modLogWrap}>
        {logQuery.isLoading && (
          <div className={styles.hint}>{t("forum.loading")}</div>
        )}
        {!logQuery.isLoading && entries.length === 0 && (
          <div className={styles.hint}>{t("forum.manage.logEmpty")}</div>
        )}
        {entries.length > 0 && (
          <table className={styles.modLogTable}>
            <thead>
              <tr>
                <th>{t("forum.manage.logModerator")}</th>
                <th>{t("forum.manage.logAction")}</th>
                <th>{t("forum.manage.logDate")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td>{e.moderator || "—"}</td>
                  <td>{e.action || "—"}</td>
                  <td>{e.date ? formatAbsoluteDate(e.date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
};
