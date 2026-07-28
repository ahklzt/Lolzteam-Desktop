import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { LOCALE_OPTIONS, type LocalePreference } from '@lzt/shared'
import { LOCALE_FLAG, localeFlagUrl } from '~/lib/flags'
import { useSettingsStore } from '~/stores/settings'
import { Modal } from '~/widgets/Modal/Modal'
import styles from './SelectorModal.module.scss'

interface LanguageModalProps {
  open: boolean
  onClose: () => void
  current: LocalePreference
}

export const LanguageModal = ({ open, onClose, current }: LanguageModalProps) => {
  const { t } = useTranslation()
  const patch = useSettingsStore((s) => s.patch)

  const select = async (locale: LocalePreference) => {
    await patch({ locale })
    onClose()
  }

  return (
    <Modal title={t('settings.language.modalTitle')} open={open} onClose={onClose}>
      <div className={styles.list}>
        {LOCALE_OPTIONS.map((locale) => {
          const active = current === locale
          return (
            <button
              key={locale}
              type="button"
              className={`${styles.option} ${active ? styles.active : ''}`}
              onClick={() => void select(locale)}
            >
              <img className={styles.flag} src={localeFlagUrl(locale)} alt={LOCALE_FLAG[locale]} />
              <span className={styles.labels}>
                <span className={styles.name}>{t(`settings.language.${locale}`)}</span>
                <span className={styles.code}>{locale}</span>
              </span>
              {active && <Check size={18} className={styles.check} />}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
