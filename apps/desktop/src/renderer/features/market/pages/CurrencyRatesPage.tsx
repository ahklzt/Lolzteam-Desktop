import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { MarketCurrencyRate } from '@lzt/shared'
import styles from './MarketPages.module.scss'

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; rates: MarketCurrencyRate[]; updated: string | null }

export const CurrencyRatesPage = () => {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.moderator.market.getCurrencyRates()
      if (cancelled) return
      if (!res.ok) {
        setState({ kind: 'error' })
        return
      }
      const updated =
        res.lastUpdate !== null ? new Date(res.lastUpdate * 1000).toLocaleString() : null
      setState({ kind: 'ready', rates: res.rates, updated })
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>{t('market.pages.rates.title')}</h2>
      {state.kind === 'loading' && (
        <div className={styles.state}>
          <Loader2 size={18} className={styles.spin} />
        </div>
      )}
      {state.kind === 'error' && <p className={styles.error}>{t('market.pages.rates.error')}</p>}
      {state.kind === 'ready' && (
        <>
          {state.updated && (
            <p className={styles.note}>{t('market.pages.rates.updated', { date: state.updated })}</p>
          )}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('market.pages.rates.currency')}</th>
                <th className={styles.right}>{t('market.pages.rates.symbol')}</th>
                <th className={styles.right}>{t('market.pages.rates.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {state.rates.map((r) => (
                <tr key={r.code}>
                  <td>{r.code} · {r.title}</td>
                  <td className={styles.right}><span className={styles.sym}>{r.symbol}</span></td>
                  <td className={styles.right}>{r.formattedRate || r.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
