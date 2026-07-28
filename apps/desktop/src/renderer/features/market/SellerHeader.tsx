import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Package, Star, Store } from 'lucide-react'
import { RichUsername } from '../profile/RichUsername'
import { marketAvatarUrl } from './user-avatar'
import { useForumUser, useSellerMarketStats } from './market-hooks'
import { MessageModal } from './MessageModal'
import styles from './MarketView.module.scss'
import { useAvatarOverride } from '~/lib/avatar'

interface Props {
  userId: number
  username: string
  usernameHtml?: string | null
  usernameColor?: string | null
  avatarDate?: number
  variant?: 'sidebar' | 'page'
  showMessage?: boolean
}

const formatDate = (unix: number): string =>
  new Date(unix * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export const SellerHeader = ({
  userId,
  username,
  usernameHtml,
  usernameColor,
  avatarDate,
  variant = 'sidebar',
  showMessage = false,
}: Props) => {
  const { t } = useTranslation()
  const { profile } = useForumUser(username || null)
  const stats = useSellerMarketStats(userId)
  const [msgOpen, setMsgOpen] = useState(false)

  const avatarOverride = useAvatarOverride()
  const avatar = avatarOverride ?? (profile?.avatarUrl || marketAvatarUrl(userId, avatarDate))
  const html = profile?.usernameHtml ?? usernameHtml ?? null
  const color = profile?.usernameColor ?? usernameColor ?? null
  const wrapClass =
    variant === 'page'
      ? `${styles.sbSellerCard} ${styles.sbSellerCardPage}`
      : styles.sbSellerCard

  return (
    <section className={wrapClass}>
      <div className={styles.sbSellerTop}>
        <img
          className={styles.sbSellerAvatar}
          src={avatar}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        <div className={styles.sbSellerHead}>
          <RichUsername
            className={styles.sbSellerName}
            html={html}
            fallback={username || `#${userId}`}
            color={color}
            userId={userId}
          />
          <div className={styles.sbSellerStats}>
            {typeof stats.rating === 'number' ? (
              <span className={styles.sbSellerStat}>
                <Star size={13} className={styles.ratingStar} />
                {t('market.seller.rating', { percent: stats.rating })}
              </span>
            ) : null}
            {typeof profile?.registerDate === 'number' ? (
              <span className={styles.sbSellerStat}>
                {t('market.item.since', { date: formatDate(profile.registerDate) })}
              </span>
            ) : null}
            {typeof stats.sold === 'number' ? (
              <span className={styles.sbSellerStat}>
                <Store size={13} />
                {t('market.item.soldItems', { count: stats.sold })}
              </span>
            ) : null}
            {typeof stats.active === 'number' ? (
              <span className={styles.sbSellerStat}>
                <Package size={13} />
                {t('market.item.onSaleItems', { count: stats.active })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {showMessage ? (
        <button
          type="button"
          className={styles.sbSellerMsgBtn}
          onClick={() => setMsgOpen(true)}
        >
          <MessageSquare size={15} />
          {t('market.item.sendMessage')}
        </button>
      ) : null}

      <MessageModal
        open={msgOpen}
        userId={userId}
        username={username}
        onClose={() => setMsgOpen(false)}
      />
    </section>
  )
}
