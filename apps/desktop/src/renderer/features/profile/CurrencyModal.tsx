import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { MARKET_CURRENCIES, type MarketCurrency } from '@lzt/shared'
import { CURRENCY_FLAG, currencyFlagUrl } from '~/lib/flags'
import { useSession } from '~/stores/session'
import { Modal } from '~/widgets/Modal/Modal'
import styles from './SelectorModal.module.scss'

interface CurrencyModalProps {
  open: boolean
  onClose: () => void
  current: string | null
}

export const CurrencyModal = ({ open, onClose, current }: CurrencyModalProps) => {
  const { t } = useTranslation()
  const refresh = useSession((s) => s.refresh)
  const [pending, setPending] = useState<MarketCurrency | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentLower = current?.toLowerCase() ?? null

  const select = async (code: MarketCurrency) => {
    setPending(code)
    setError(null)
    const res = await window.moderator.profile.setCurrency(code)
    setPending(null)
    if (res.ok) {
      await refresh()
      onClose()
    } else {
      setError(t('settings.currency.failed'))
    }
  }

  return (
    <Modal title={t('settings.currency.modalTitle')} open={open} onClose={onClose}>
      <div className={styles.list}>
        {MARKET_CURRENCIES.map((code) => {
          const active = currentLower === code
          return (
            <button
              key={code}
              type="button"
              className={`${styles.option} ${active ? styles.active : ''}`}
              onClick={() => void select(code)}
              disabled={pending !== null}
            >
              <img className={styles.flag} src={currencyFlagUrl(code)} alt={CURRENCY_FLAG[code]} />
              <span className={styles.labels}>
                <span className={styles.name}>{t(`settings.currency.names.${code}`)}</span>
                <span className={styles.code}>{code}</span>
              </span>
              {(active || pending === code) && <Check size={18} className={styles.check} />}
            </button>
          )
        })}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  )
}
