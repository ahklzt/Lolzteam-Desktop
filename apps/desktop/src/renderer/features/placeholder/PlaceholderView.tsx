import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'
import styles from './PlaceholderView.module.scss'

export const PlaceholderView = ({ titleKey }: { titleKey: string }) => {
  const { t } = useTranslation()
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>
        <Construction size={40} />
      </div>
      <h2 className={styles.title}>{t(titleKey)}</h2>
      <p className={styles.body}>{t('placeholder.body')}</p>
    </div>
  )
}
