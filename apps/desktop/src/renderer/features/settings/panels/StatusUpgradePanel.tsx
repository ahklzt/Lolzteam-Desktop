import { useTranslation } from 'react-i18next'

import { MARKET_LINKS } from '~/features/market/marketLinks'
import {
	STATUS_UPGRADES,
	STATUS_REFUND_PREFIX,
	STATUS_REFUND_LINK_TEXT,
	STATUS_REFUND_SUFFIX,
} from '~/features/market/pages/statusUpgradeContent'
import styles from '~/features/market/pages/StatusUpgrade.module.scss'

function RawIcon({ svg, className }: { svg: string; className?: string }) {
	return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function StatusUpgradePanel() {
	const { t } = useTranslation()

	const openSite = () => {
		void window.moderator.app.openExternal(MARKET_LINKS.statusUpgrade)
	}

	return (
		<div className={styles.main}>
			{}
			<div className={styles.alert}>
				{STATUS_REFUND_PREFIX}
				<button type="button" className={styles.alertLink} onClick={openSite}>
					{STATUS_REFUND_LINK_TEXT}
				</button>
				{STATUS_REFUND_SUFFIX}
			</div>

			{}
			<div className={styles.panel}>
				{STATUS_UPGRADES.map((u, ui) => (
					<section key={`${u.title}-${ui}`} className={styles.card}>
						<div className={styles.cardHead}>
							<span className={styles.cardTitle}>{u.title}</span>
							<span className={styles.price}>
								<span className={styles.priceNow}>{u.price} ₽</span>
								{u.oldPrice ? (
									<span className={styles.priceOld}>{u.oldPrice} ₽</span>
								) : null}
								{u.period ? (
									<span className={styles.pricePeriod}>/ {u.period}</span>
								) : null}
							</span>
						</div>

						{u.rights.length > 0 ? (
							<div className={styles.rights}>
								{u.rights.map((r, ri) => (
									<div key={ri} className={styles.rightItem}>
										<RawIcon svg={r.icon} className={styles.rightIcon} />
										<span>{r.text}</span>
									</div>
								))}
							</div>
						) : null}

						{}
						<button type="button" className={styles.buyBtn} onClick={openSite}>
							{t('settings.status.buy')}
						</button>
					</section>
				))}
			</div>
		</div>
	)
}

export default StatusUpgradePanel
