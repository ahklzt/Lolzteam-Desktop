import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  FileText,
  Gift,
  Heart,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Send,
  ShieldCheck,
  Store,
  Trophy,
  ThumbsUp,
  Wallet,
} from 'lucide-react'
import { profileSiteLinks, type FullProfile } from '@lzt/shared'
import { Modal } from '~/widgets/Modal/Modal'
import { RichUsername } from './RichUsername'
import { useSettingsStore } from '~/stores/settings'
import { useAvatarOverride } from '~/lib/avatar'
import { useViewStore } from '~/stores/view'
import { useForumStore } from '~/features/forum/forum-store'
import { useMarketRoute } from '~/stores/marketRoute'
import styles from './ProfileView.module.scss'

const STAT_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  sympathies: Heart,
  likes: ThumbsUp,
  messages: MessageSquare,
  trophies: Trophy,
  giveaways: Gift,
}

const STAT_ORDER = ['sympathies', 'likes', 'messages', 'trophies', 'giveaways'] as const

interface Props {
  userId: string | number | null
  onClose: () => void
  onOpenProfile: (userId: number) => void
}

const fmtDeposit = (v: number | null, lang: string): string => {
  const amount = v ?? 0
  return amount.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US') + ' \u20bd'
}

const fmtDate = (unix: number | null, lang: string): string | null => {
  if (!unix) return null
  try {
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(unix * 1000))
  } catch {
    return null
  }
}

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '').trim()

export const MiniProfileModal = ({ userId, onClose, onOpenProfile }: Props) => {
  const avatarOverride = useAvatarOverride()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [profile, setProfile] = useState<FullProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [following, setFollowing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const disableProfileBg = useSettingsStore(
    (s) => s.snapshot?.settings.disableProfileBackgrounds ?? false,
  )

  useEffect(() => {
    setMenuOpen(false)
    if (userId === null) {
      setProfile(null)
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    setProfile(null)
    void window.moderator.profile.getUser(String(userId)).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setProfile(res.profile)
        setFollowing(Boolean(res.profile.isFollowed))
      } else setError(true)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const openLink = (url: string) => void window.moderator.app.openExternal(url)

  const openUserThreads = () => {
    if (!profile) return
    onClose()
    useViewStore.getState().setView('forum')
    useForumStore.getState().selectSection({
      type: 'userThreads',
      userId: profile.userId,
      username: plainName,
    })
  }

  const openSellerItems = () => {
    if (!profile) return
    onClose()
    useViewStore.getState().setView('market')
    useMarketRoute.getState().openSeller({
      userId: profile.userId,
      username: plainName,
      usernameHtml: profile.usernameHtml,
      usernameColor: profile.usernameColor,
    })
  }

  const toggleFollow = () => {
    if (!profile) return
    setMenuOpen(false)
    const next = !following
    setFollowing(next)
    if (next) void window.moderator.profile.follow(profile.userId)
    else void window.moderator.profile.unfollow(profile.userId)
  }

  const plainName = profile ? stripTags(profile.username) || profile.username : ''
  const memberLink = profile ? profile.profileUrl ?? profileSiteLinks.member(profile.userId) : ''
  const deposit = profile?.deposit ?? 0
  const registered = profile ? fmtDate(profile.registerDate, lang) : null
  const lastSeen = profile ? fmtDate(profile.lastSeenDate, lang) : null
  const activityText = profile?.isOnline
    ? t('profile.card.lastSeenOnline')
    : lastSeen ?? '\u2014'
  const orderedStats = profile
    ? STAT_ORDER.map((key) => profile.stats.find((s) => s.key === key)).filter(
        (s): s is NonNullable<typeof s> => Boolean(s),
      )
    : []

  const copyLink = () => {
    if (!memberLink) return
    void navigator.clipboard.writeText(memberLink)
    setMenuOpen(false)
  }

  return (
    <Modal title="" open={userId !== null} onClose={onClose} maxWidth={577}>
      <div className={styles.mini}>
        {loading && (
          <div className={styles.miniCenter}>
            <Loader2 className={styles.spin} size={24} />
            <span>{t('profile.mini.loading')}</span>
          </div>
        )}
        {error && <div className={styles.miniCenter}>{t('profile.mini.error')}</div>}

        {profile && (
          <>
            {}
            <div
              className={styles.miniBanner}
              style={
                profile.bannerUrl && !disableProfileBg
                  ? { backgroundImage: `url(${profile.bannerUrl})` }
                  : undefined
              }
            />

            {}
            <div className={styles.miniHead}>
              <div className={styles.miniAvatarBox}>
                {(avatarOverride ?? profile.avatarUrl) ? (
                  <img
                    className={styles.miniAvatar}
                    src={avatarOverride ?? profile.avatarUrl ?? undefined}
                    alt={plainName}
                  />
                ) : (
                  <div className={styles.miniAvatarFallback}>
                    {plainName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className={styles.miniHeadActions}>
                <button
                  type="button"
                  className={styles.miniMoneyBtn}
                  onClick={() => openLink(profileSiteLinks.balanceTransfer(profile.userId))}
                  title={t('profile.actions.balanceTransfer')}
                  aria-label={t('profile.actions.balanceTransfer')}
                >
                  <Wallet size={16} />
                </button>
                <button
                  type="button"
                  className={styles.miniMsgBtn}
                  onClick={() => openLink(profileSiteLinks.conversation(plainName))}
                >
                  <Send size={15} /> {t('profile.mini.sendMessage')}
                </button>

                <div className={styles.miniMenuWrap} ref={menuRef}>
                  <button
                    type="button"
                    className={styles.miniMenuBtn}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label={t('profile.menu.more')}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <div className={styles.miniMenu}>
                      <button
                        type="button"
                        className={styles.miniMenuItem}
                        onClick={() => {
                          setMenuOpen(false)
                          onOpenProfile(profile.userId)
                        }}
                      >
                        {t('profile.mini.openProfile')}
                      </button>
                      <button
                        type="button"
                        className={styles.miniMenuItem}
                        onClick={() => {
                          setMenuOpen(false)
                          void window.moderator.app.openExternal(memberLink, {
                            forceExternal: true,
                          })
                        }}
                      >
                        {t('profile.actions.openOnSite')}
                      </button>
                      <button type="button" className={styles.miniMenuItem} onClick={copyLink}>
                        {t('profile.mini.copyLink')}
                      </button>
                      <button type="button" className={styles.miniMenuItem} onClick={toggleFollow}>
                        {following ? t('profile.actions.unfollow') : t('profile.actions.follow')}
                      </button>
                      <button
                        type="button"
                        className={styles.miniMenuItem}
                        onClick={() => {
                          setMenuOpen(false)
                          openLink(profileSiteLinks.moneyDispute(profile.userId))
                        }}
                      >
                        {t('profile.actions.moneyDispute')}
                      </button>
                      <button
                        type="button"
                        className={styles.miniMenuItem}
                        onClick={() => {
                          setMenuOpen(false)
                          openLink(profileSiteLinks.complaint(profile.userId, plainName))
                        }}
                      >
                        {t('profile.actions.complaint')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {}
            <div className={styles.miniUserBlock}>
              <button
                type="button"
                className={styles.miniNameBtn}
                onClick={() => onOpenProfile(profile.userId)}
                title={t('profile.mini.openProfile')}
              >
                <RichUsername
                  className={styles.miniName}
                  html={profile.usernameHtml}
                  fallback={plainName}
                  color={profile.usernameColor}
                  userId={profile.userId}
                />
              </button>
              {profile.userTitle && <span className={styles.miniTitle}>{profile.userTitle}</span>}
              {profile.description && <p className={styles.miniDesc}>{profile.description}</p>}
            </div>

            {}
            <div className={styles.miniControls}>
              <button type="button" className={styles.miniControlBtn} onClick={openUserThreads}>
                <span className={styles.miniControlIcon}>
                  <FileText size={18} />
                </span>
                {t('profile.mini.threadsFrom', { name: plainName })}
              </button>
              <button type="button" className={styles.miniControlBtn} onClick={openSellerItems}>
                <span className={styles.miniControlIcon}>
                  <Store size={18} />
                </span>
                {t('profile.mini.market')}
              </button>
              <span
                className={styles.miniDepositBtn}
                style={deposit > 0 ? { color: 'rgb(0, 186, 120)' } : undefined}
              >
                <span className={styles.miniControlIcon}>
                  <ShieldCheck size={18} />
                </span>
                {deposit > 0
                  ? t('profile.mini.depositAmount', { amount: fmtDeposit(profile.deposit, lang) })
                  : t('profile.mini.noDeposit')}
              </span>
            </div>

            {}
            <div className={styles.miniInfoBlock}>
              <span className={styles.miniInfoTitle}>{t('profile.mini.activityTitle')}</span>
              <span className={styles.miniActivity}>{activityText}</span>
            </div>

            {}
            {(orderedStats.length > 0 || registered) && (
              <div className={styles.miniInfoBlock}>
                <span className={styles.miniInfoTitle}>{t('profile.mini.statsTitle')}</span>
                <div className={styles.miniCounters}>
                  {orderedStats.map((stat) => {
                    const Icon = STAT_ICONS[stat.key]
                    return (
                      <span
                        key={stat.key}
                        className={styles.miniCounter}
                        title={t(`profile.stats.${stat.key}`, { defaultValue: stat.key })}
                      >
                        {Icon && (
                          <span className={styles.miniCounterIcon}>
                            <Icon size={16} />
                          </span>
                        )}
                        <span className={styles.miniCounterValue}>
                          {stat.value.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                        </span>
                      </span>
                    )
                  })}
                  {registered && (
                    <span className={styles.miniCounter} title={t('profile.card.meta.registered')}>
                      <span className={styles.miniCounterIcon}>
                        <Calendar size={16} />
                      </span>
                      <span className={styles.miniCounterValue}>{registered}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
