import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { LEGAL_DOCS, type LegalDocKey } from './legalContent'
import { MARKET_LINKS } from '../marketLinks'
import styles from './MarketPages.module.scss'

const TABS: LegalDocKey[] = ['rules', 'offer', 'privacy']

export const RulesPage = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<LegalDocKey>('rules')
  const blocks = LEGAL_DOCS[tab]
  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>{t('market.pages.rules.title')}</h2>
      <div className={styles.tabs}>
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            className={k === tab ? styles.tabActive : styles.tab}
            onClick={() => setTab(k)}
          >
            {t('market.pages.rules.tabs.' + k)}
          </button>
        ))}
      </div>
      <div className={styles.doc}>
        {blocks.map((b, i) =>
          b.type === 'h' ? (
            <h3 key={i} className={styles.docH}>{b.text}</h3>
          ) : b.type === 'li' ? (
            <li key={i} className={styles.docLi}>{b.text}</li>
          ) : (
            <p key={i} className={styles.docP}>{b.text}</p>
          ),
        )}
      </div>
      <button
        type="button"
        className={styles.siteBtn}
        onClick={() => void window.moderator.app.openExternal(MARKET_LINKS.terms)}
      >
        <ExternalLink size={16} />
        {t('market.pages.rules.openSite')}
      </button>
    </div>
  )
}
