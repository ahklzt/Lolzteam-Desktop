import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { AccountLabel } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import styles from "./SubView.module.scss";

const PALETTE = [
  "#1EA360", "#2394BC", "#8152C6", "#E68C17",
  "#EA4C4C", "#0FA3B1", "#B5179E", "#606C76",
];

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `l_${Date.now()}_${Math.random().toString(36).slice(2)}`;

interface AccountLabelsViewProps {
  onBack: () => void;
}

export const AccountLabelsView = ({ onBack }: AccountLabelsViewProps) => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);
  const patch = useSettingsStore((s) => s.patch);
  const labels = snapshot?.settings.accountLabels ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]!);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setColor(PALETTE[0]!);
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const next: AccountLabel[] = editingId
      ? labels.map((l) => (l.id === editingId ? { ...l, title: trimmed, color } : l))
      : [...labels, { id: newId(), title: trimmed, color }];
    await patch({ accountLabels: next });
    resetForm();
  };

  const edit = (label: AccountLabel) => {
    setEditingId(label.id);
    setTitle(label.title);
    setColor(label.color);
  };

  const remove = async (id: string) => {
    await patch({ accountLabels: labels.filter((l) => l.id !== id) });
    if (editingId === id) resetForm();
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headText}>
          <h2 className={styles.title}>{t("settings.labels.title")}</h2>
          <p className={styles.subtitle}>{t("settings.labels.subtitle")}</p>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.formRow}>
          <span className={styles.swatchPreview} style={{ background: color }} />
          <input
            className={styles.input}
            value={title}
            maxLength={24}
            placeholder={t("settings.labels.placeholder")}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
          />
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void save()}
            disabled={!title.trim()}
          >
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {editingId ? t("settings.labels.saveBtn") : t("settings.labels.addBtn")}
          </button>
          {editingId && (
            <button type="button" className={styles.ghostBtn} onClick={resetForm} aria-label={t("common.close")}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className={styles.palette}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.swatch} ${color === c ? styles.swatchActive : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {labels.length === 0 ? (
        <p className={styles.empty}>{t("settings.labels.empty")}</p>
      ) : (
        <div className={styles.card}>
          {labels.map((label) => (
            <div key={label.id} className={styles.labelRow}>
              <span className={styles.chip} style={{ background: label.color }}>
                {label.title}
              </span>
              <div className={styles.labelActions}>
                <button type="button" className={styles.iconBtn} onClick={() => edit(label)} aria-label={t("settings.labels.editBtn")}>
                  <Pencil size={16} />
                </button>
                <button type="button" className={styles.iconBtnDanger} onClick={() => void remove(label.id)} aria-label={t("settings.labels.deleteBtn")}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
