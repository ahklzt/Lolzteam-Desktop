import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Send, X } from 'lucide-react'
import { pushToast } from '~/stores/toast'
import styles from './MarketView.module.scss'

interface Props {
  open: boolean
  userId: number
  username: string
  onClose: () => void
}

export const MessageModal = ({ open, userId, username, onClose }: Props) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  if (!open) return null

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    const res = await window.moderator.profile.sendMessage(userId, body)
    setSending(false)
    if (res.ok) {
      pushToast({
        kind: 'success',
        title: t('market.message.sentTitle'),
        message: t('market.message.sent'),
      })
      setText('')
      onClose()
    } else {
      pushToast({
        kind: 'error',
        title: t('toast.errorTitle'),
        message: t('market.message.error'),
      })
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>{t('market.message.title', { username })}</span>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <textarea
          className={styles.modalTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('market.message.placeholder')}
          rows={4}
        />
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalPrimary}
            disabled={!text.trim() || sending}
            onClick={() => void send()}
          >
            {sending ? <Loader2 className={styles.spin} size={15} /> : <Send size={15} />}
            {t('market.message.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
