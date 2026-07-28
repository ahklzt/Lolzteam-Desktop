import { useTranslation } from 'react-i18next'
import type { Locale } from '@lzt/shared'
import { CHANGELOG, CURRENT_VERSION, formatDate } from '~/data/changelog'
import { Modal } from '~/widgets/Modal/Modal'
import styles from './ChangelogModal.module.scss'

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

export const ChangelogModal = ({ open, onClose }: ChangelogModalProps) => {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language === 'ru' ? 'ru' : 'en') as Locale

  return (
    <Modal title={t('changelog.title')} open={open} onClose={onClose}>
      {CHANGELOG.map((entry) => (
        <div key={entry.version} className={styles.entry}>
          <div className={styles.head}>
            <span className={styles.version}>v{entry.version}</span>
            {entry.version === CURRENT_VERSION && (
              <span className={styles.badge}>{t('changelog.current')}</span>
            )}
            <span className={styles.date}>{formatDate(entry.date, locale)}</span>
          </div>
          <ul className={styles.list}>
            {entry.changes[locale].map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </Modal>
  )
}
