import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, StickyNote, X } from 'lucide-react'
import { pushToast } from '~/stores/toast'
import styles from './MarketView.module.scss'

interface Props {
  open: boolean
  kind: 'item' | 'user'
  id: number
  onClose: () => void
}

export const LocalNoteModal = ({ open, kind, id, onClose }: Props) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !id) return
    let alive = true
    setLoading(true)
    const p =
      kind === 'item'
        ? window.moderator.market.getItemNote(id).then((n) => n.text)
        : window.moderator.profile.getNote(id).then((n) => n.text)
    void p.then((txt) => {
      if (!alive) return
      setText(txt)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [open, id, kind])

  if (!open) return null

  const save = async () => {
    if (saving) return
    setSaving(true)
    if (kind === 'item') await window.moderator.market.setItemNote(id, text)
    else await window.moderator.profile.setNote(id, text)
    setSaving(false)
    pushToast({
      kind: 'success',
      title: t('toast.savedTitle'),
      message: t('toast.noteSaved'),
    })
    onClose()
  }

  const titleKey = kind === 'item' ? 'market.note.title' : 'market.userNote.title'
  const phKey = kind === 'item' ? 'market.note.placeholder' : 'market.userNote.placeholder'

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>
            <StickyNote size={15} /> {t(titleKey)}
          </span>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {loading ? (
          <div className={styles.modalLoading}>
            <Loader2 className={styles.spin} size={18} />
          </div>
        ) : (
          <textarea
            className={styles.modalTextarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(phKey)}
            rows={4}
          />
        )}
        <div className={styles.modalHint}>{t('market.note.hint')}</div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalPrimary}
            disabled={saving || loading}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className={styles.spin} size={15} /> : null}
            {t('market.note.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
