import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIpTab } from './CheckIpTab'
import { CheckProxyTab } from './CheckProxyTab'
import { ConvertTab } from './ConvertTab'
import styles from './ProxyCheckTool.module.scss'

type TabId = 'check' | 'convert' | 'ip'

interface TabDef {
  id: TabId
  labelKey: string
}

const TABS: TabDef[] = [
  { id: 'check', labelKey: 'proxycheck.tabs.check' },
  { id: 'convert', labelKey: 'proxycheck.tabs.convert' },
  { id: 'ip', labelKey: 'proxycheck.tabs.ip' },
]

export const ProxyCheckTool = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabId>('check')

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs}>
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`${styles.tab} ${tab === x.id ? styles.tabActive : ''}`}
            onClick={() => setTab(x.id)}
          >
            {t(x.labelKey)}
          </button>
        ))}
      </nav>

      {tab === 'check' && <CheckProxyTab onExit={onBack} />}
      {tab === 'convert' && <ConvertTab onExit={onBack} />}
      {tab === 'ip' && <CheckIpTab onExit={onBack} />}
    </div>
  )
}
