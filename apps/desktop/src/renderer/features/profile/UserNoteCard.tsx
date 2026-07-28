import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Loader2, StickyNote } from 'lucide-react'
import styles from './ProfileView.module.scss'

interface Props {
  userId: number
}

export const UserNoteCard = ({ userId }: Props) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void window.moderator.profile.getNote(userId).then((note) => {
      if (!alive) return
      setText(note.text)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [userId])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onChange = (value: string) => {
    setText(value)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void window.moderator.profile.setNote(userId, value).then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      })
    }, 600)
  }

  return (
    <div className={styles.sideCard}>
      {}
      <button
        type="button"
        className={styles.noteToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.sideCardTitle}>
          <StickyNote size={15} /> {t('profile.note.title')}
        </span>
        {saved && (
          <span className={styles.savedHint}>
            <Check size={13} /> {t('profile.note.saved')}
          </span>
        )}
        {}
        <ChevronDown
          size={16}
          className={`${styles.noteChevron} ${open ? styles.noteChevronOpen : ''}`}
        />
      </button>

      {}
      {open && (
        <div className={styles.noteBody}>
          {loading ? (
            <div className={styles.notePlaceholder}>
              <Loader2 className={styles.spin} size={16} />
            </div>
          ) : (
            <textarea
              className={styles.noteInput}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('profile.note.placeholder')}
              rows={3}
            />
          )}
          <div className={styles.noteHint}>{t('profile.note.hint')}</div>
        </div>
      )}
    </div>
  )
}
