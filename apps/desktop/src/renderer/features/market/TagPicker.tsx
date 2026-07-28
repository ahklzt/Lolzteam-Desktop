import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import type { MarketTag } from '@lzt/shared'
import styles from './MarketView.module.scss'

type Props = {
  itemId: number
  appliedTagIds?: number[]
  onClose: () => void
  onManage?: () => void
}

const DEFAULT_COLOR = '#555665'

export const TagPicker = ({ itemId, appliedTagIds, onClose, onManage }: Props) => {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [tags, setTags] = useState<MarketTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [applied, setApplied] = useState<Set<number>>(new Set(appliedTagIds ?? []))
  const [pending, setPending] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await window.moderator.market.getTags()
      if (!alive) return
      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }
      setTags(res.tags)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  const toggle = useCallback(
    async (tag: MarketTag) => {
      if (pending !== null) return
      const isOn = applied.has(tag.tag_id)
      setPending(tag.tag_id)
      const res = isOn
        ? await window.moderator.market.removeItemTag(itemId, tag.tag_id)
        : await window.moderator.market.addItemTag(itemId, tag.tag_id)
      setPending(null)
      if (!res.ok) {
        setError(true)
        return
      }
      setApplied((prev) => {
        const next = new Set(prev)
        if (isOn) next.delete(tag.tag_id)
        else next.add(tag.tag_id)
        return next
      })
    },
    [applied, itemId, pending],
  )

  return (
    <div className={styles.tagPicker} ref={rootRef}>
      <span className={styles.tagPickerTitle}>{t('market.tags.set')}</span>
      {error ? <p className={styles.errorText}>{t('market.tags.error')}</p> : null}
      {loading ? (
        <div className={styles.modalLoading}>
          <Loader2 className={styles.spin} size={18} />
        </div>
      ) : tags.length === 0 ? (
        <p className={styles.modalHint}>{t('market.tags.noTags')}</p>
      ) : (
        <ul className={styles.tagPickerList}>
          {tags.map((tag) => {
            const on = applied.has(tag.tag_id)
            return (
              <li key={tag.tag_id}>
                <button
                  type="button"
                  className={styles.tagPickerItem}
                  onClick={() => void toggle(tag)}
                  disabled={pending !== null}
                >
                  <span
                    className={styles.tagDot}
                    style={{ background: tag.background_color || DEFAULT_COLOR }}
                  />
                  <span className={styles.tagPickerLabel}>{tag.title}</span>
                  {pending === tag.tag_id ? (
                    <Loader2 className={styles.spin} size={14} />
                  ) : on ? (
                    <Check size={14} />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {onManage ? (
        <button type="button" className={styles.tagPickerManage} onClick={onManage}>
          {t('market.tags.title')}
        </button>
      ) : null}
    </div>
  )
}

export default TagPicker
