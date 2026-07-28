import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { Modal } from '~/widgets/Modal/Modal'
import styles from './SiteAccessModal.module.scss'

interface SiteAccessModalProps {
  open: boolean
  onClose: () => void
  url: string
}

export const SiteAccessModal = ({ open, onClose, url }: SiteAccessModalProps) => {
  const { t } = useTranslation()
  const openSite = () => {
    if (url) void window.moderator.app.openExternal(url)
    onClose()
  }
  return (
    <Modal title={t('market.siteAccess.title')} open={open} onClose={onClose}>
      <div className={styles.body}>
        <p className={styles.text}>{t('market.siteAccess.text')}</p>
        <button type="button" className={styles.primary} onClick={openSite}>
          <ExternalLink size={16} />
          {t('market.siteAccess.openBtn')}
        </button>
      </div>
    </Modal>
  )
}
