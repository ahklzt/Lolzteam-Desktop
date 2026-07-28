import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { MarketTag } from '@lzt/shared'
import styles from './MarketView.module.scss'

const PALETTE = [
  '#555665',
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e84393',
  '#34495e',
]

const DEFAULT_COLOR = '#555665'
const MAX_LEN = 16
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

type Props = {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export const TagsModal = ({ open, onClose, onChanged }: Props) => {
  const { t } = useTranslation()
  const [tags, setTags] = useState<MarketTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [formOpen, setFormOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(false)
    const res = await window.moderator.market.getTags()
    if (!res.ok) {
      setError(true)
      setLoading(false)
      return
    }
    setTags(res.tags)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  if (!open) return null

  const resetForm = () => {
    setEditId(null)
    setName('')
    setColor(DEFAULT_COLOR)
    setFormOpen(false)
  }

  const startCreate = () => {
    setEditId(null)
    setName('')
    setColor(DEFAULT_COLOR)
    setFormOpen(true)
  }

  const startEdit = (tag: MarketTag) => {
    setEditId(tag.tag_id)
    setName(tag.title)
    setColor(tag.background_color || DEFAULT_COLOR)
    setFormOpen(true)
  }

  const nameValid = name.trim().length > 0 && name.trim().length <= MAX_LEN
  const colorValid = HEX_RE.test(color)
  const canSave = nameValid && colorValid && !busy

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    const input = { title: name.trim().slice(0, MAX_LEN), backgroundColor: color }
    const res =
      editId === null
        ? await window.moderator.market.createTag(input)
        : await window.moderator.market.updateTag(editId, input)
    setBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    resetForm()
    await reload()
    onChanged?.()
  }

  const remove = async (tag: MarketTag) => {
    if (busy) return
    if (!window.confirm(t('market.tags.deleteConfirm', { title: tag.title }))) return
    setBusy(true)
    const res = await window.moderator.market.deleteTag(tag.tag_id)
    setBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    if (editId === tag.tag_id) resetForm()
    await reload()
    onChanged?.()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (busy || target < 0 || target >= tags.length) return
    const next = [...tags]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    setTags(next)
    setBusy(true)
    const res = await window.moderator.market.reorderTags(next.map((tg) => tg.tag_id))
    setBusy(false)
    if (!res.ok) {
      setError(true)
      await reload()
      return
    }
    onChanged?.()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>{t('market.tags.title')}</span>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {error ? <p className={styles.errorText}>{t('market.tags.error')}</p> : null}

        {loading ? (
          <div className={styles.modalLoading}>
            <Loader2 className={styles.spin} size={22} />
          </div>
        ) : (
          <>
            {tags.length === 0 ? (
              <p className={styles.modalHint}>{t('market.tags.empty')}</p>
            ) : (
              <ul className={styles.tagList}>
                {tags.map((tag, i) => (
                  <li key={tag.tag_id} className={styles.tagRow}>
                    <span
                      className={styles.tagChip}
                      style={{ background: tag.background_color || DEFAULT_COLOR }}
                    >
                      {tag.title}
                    </span>
                    <span className={styles.tagRowSpacer} />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('market.tags.moveUp')}
                      disabled={i === 0 || busy}
                      onClick={() => void move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('market.tags.moveDown')}
                      disabled={i === tags.length - 1 || busy}
                      onClick={() => void move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('market.tags.edit')}
                      disabled={busy}
                      onClick={() => startEdit(tag)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('market.tags.delete')}
                      disabled={busy}
                      onClick={() => void remove(tag)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {formOpen ? (
              <div className={styles.tagForm}>
                <span className={styles.modalTitle}>
                  {editId === null ? t('market.tags.create') : t('market.tags.edit')}
                </span>
                <input
                  className={styles.fieldInput}
                  value={name}
                  maxLength={MAX_LEN}
                  placeholder={t('market.tags.namePlaceholder')}
                  onChange={(e) => setName(e.target.value)}
                />
                <span className={styles.modalHint}>
                  {t('market.tags.nameHint')} — {name.trim().length}/{MAX_LEN}
                </span>

                <span className={styles.fieldLabel}>{t('market.tags.color')}</span>
                <div className={styles.tagPalette}>
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={
                        c.toLowerCase() === color.toLowerCase()
                          ? `${styles.tagSwatch} ${styles.tagSwatchActive}`
                          : styles.tagSwatch
                      }
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className={styles.tagHexRow}>
                  <span
                    className={styles.tagSwatch}
                    style={{ background: colorValid ? color : 'transparent' }}
                  />
                  <input
                    className={styles.fieldInput}
                    value={color}
                    placeholder={t('market.tags.colorHex')}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>

                <span className={styles.fieldLabel}>{t('market.tags.preview')}</span>
                <span
                  className={styles.tagChip}
                  style={{ background: colorValid ? color : DEFAULT_COLOR }}
                >
                  {name.trim() || t('market.tags.namePlaceholder')}
                </span>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.resetBtn} onClick={resetForm}>
                    {t('market.tags.cancel')}
                  </button>
                  <button
                    type="button"
                    className={styles.modalPrimary}
                    disabled={!canSave}
                    onClick={() => void save()}
                  >
                    {busy ? <Loader2 className={styles.spin} size={16} /> : t('market.tags.save')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.sbWideBtn} onClick={startCreate}>
                <Plus size={16} />
                {t('market.tags.create')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TagsModal
