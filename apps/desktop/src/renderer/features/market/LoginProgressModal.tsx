import { useEffect } from 'react'
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLoginSession } from '~/stores/loginSession'
import styles from './MarketView.module.scss'

export const LoginProgressModal = () => {
  const { t } = useTranslation()
  const itemId = useLoginSession((s) => s.itemId)
  const accountTitle = useLoginSession((s) => s.accountTitle)
  const step = useLoginSession((s) => s.step)
  const detail = useLoginSession((s) => s.detail)
  const error = useLoginSession((s) => s.error)
  const isOpen = useLoginSession((s) => s.isOpen)
  const setStep = useLoginSession((s) => s.setStep)
  const close = useLoginSession((s) => s.close)

  useEffect(() => {
    const off = window.moderator.account.onLoginProgress((e) => {
      if (e.itemId !== itemId) return
      setStep(e.step, e.detail)
    })
    return off
  }, [itemId, setStep])

  if (!isOpen) return null

  const failed = error !== null
  const done = !failed && step === 'done'
  const busy = !failed && !done

  const cancel = () => {
    if (itemId !== null) void window.moderator.account.cancelLogin(itemId)
    close()
  }

  const stepLabel = failed
    ? error
    : done
      ? t('market.login.done')
      : t(`market.login.step.${step ?? 'fetching-credentials'}`)

  return (
    <div className={styles.loginOverlay} role="dialog" aria-modal="true">
      <div className={styles.loginModal}>
        <button
          type="button"
          className={styles.loginClose}
          onClick={close}
          aria-label={t('market.login.close')}
        >
          <X size={16} />
        </button>
        <div className={styles.loginTitle}>
          {t('market.login.title', { name: accountTitle })}
        </div>
        <div className={styles.loginStep}>
          {failed ? (
            <XCircle size={18} />
          ) : done ? (
            <CheckCircle2 size={18} />
          ) : (
            <Loader2 size={18} className={styles.spin} />
          )}
          <span>{stepLabel}</span>
        </div>
        {detail && !failed ? <div className={styles.loginDetail}>{detail}</div> : null}
        <div className={styles.loginActions}>
          {busy ? (
            <button type="button" className={styles.loginBtn} onClick={cancel}>
              {t('market.login.cancel')}
            </button>
          ) : (
            <button type="button" className={styles.loginBtn} onClick={close}>
              {t('market.login.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
