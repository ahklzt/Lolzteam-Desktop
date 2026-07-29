import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { FullProfile, ProfileTrophy } from '@lzt/shared'
import { pushToast } from '~/stores/toast'
import { EnrichedUsername } from './EnrichedUsername'
import { UserNoteCard } from './UserNoteCard'
import { ProfileWall } from './ProfileWall'
import './profile-site.css'
import './profile-legacy.css'
import './profile-reference.css'
import { useAvatarOverride } from '~/lib/avatar'
import { formatAgo } from '~/lib/time'
import { useViewStore } from '~/stores/view'
import { useForumStore } from '~/features/forum/forum-store'
import { useMarketRoute } from '~/stores/marketRoute'
import telegramIcon from '~/assets/profile-contact-icons/telegram.svg'
import vkIcon from '~/assets/profile-contact-icons/vk.svg'
import discordIcon from '~/assets/profile-contact-icons/discord.svg'
import steamIcon from '~/assets/profile-contact-icons/steam.svg'
import matrixIcon from '~/assets/profile-contact-icons/matrix.svg'
import jabberIcon from '~/assets/profile-contact-icons/jabber.svg'
import githubIcon from '~/assets/profile-contact-icons/github.svg'

const SCHEME = 'https' + '://'

type Mini = Record<string, unknown>

const asList = (v: unknown): Mini[] => (Array.isArray(v) ? (v as Mini[]) : [])

const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''

const pick = (o: Mini, ...keys: string[]): string => {
  for (const k of keys) {
    const val = str(o[k])
    if (val) return val
  }
  return ''
}

const stripHtml = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

const fmtDate = (unix: unknown): string => {
  const n = typeof unix === 'number' ? unix : Number(unix)
  if (!n) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(n * 1000))
  } catch {
    return ''
  }
}

const fmtAgo = (unix: unknown): string => {
  const n = typeof unix === 'number' ? unix : Number(unix)
  if (!n) return ''
  return formatAgo(n * 1000, 'ru')
}

const fmtThreadDate = (v: unknown): string => {
  if (typeof v === 'number' || /^\d+$/.test(str(v))) return fmtDate(v)
  return stripHtml(str(v))
}

const STAT_LABELS: Record<string, string> = {
  sympathies: 'симпатии',
  likes: 'лайков',
  messages: 'сообщений',
  trophies: 'трофеев',
  giveaways: 'розыгрышей',
  followings: 'подписок',
  following: 'подписок',
  followers: 'подписчиков',
  reputation: 'репутация',
  posts: 'сообщений',
}

type ContactKind = 'telegram' | 'vk' | 'discord' | 'steam' | 'matrix' | 'jabber' | 'github'

const CONTACT_ICONS: Record<ContactKind, string> = {
  telegram: telegramIcon,
  vk: vkIcon,
  discord: discordIcon,
  steam: steamIcon,
  matrix: matrixIcon,
  jabber: jabberIcon,
  github: githubIcon,
}

const fieldIdentity = (field: Mini): string =>
  `${pick(field, 'key', 'id')} ${pick(field, 'label', 'title', 'name')}`.toLowerCase()

const getContactKind = (field: Mini): ContactKind | null => {
  const identity = fieldIdentity(field)
  if (identity.includes('telegram')) return 'telegram'
  if (identity.includes('вконтакте') || identity.includes(' vk')) return 'vk'
  if (identity.includes('discord')) return 'discord'
  if (identity.includes('steam')) return 'steam'
  if (identity.includes('matrix')) return 'matrix'
  if (identity.includes('jabber')) return 'jabber'
  if (identity.includes('github')) return 'github'
  return null
}

const INFO_FIELD_ORDER = [
  ['homepage', 'website', 'сайт'],
  ['occupation', 'род занятий'],
  ['location', 'адрес'],
  ['interests', 'интересы'],
  ['porn', 'порно'],
  ['anime', 'аниме'],
  ['ашкудиш'],
]

const infoFieldWeight = (field: Mini): number => {
  const identity = fieldIdentity(field)
  const index = INFO_FIELD_ORDER.findIndex((aliases) =>
    aliases.some((alias) => identity.includes(alias)),
  )
  return index === -1 ? INFO_FIELD_ORDER.length : index
}

const findStatCount = (stats: Mini[], ...keys: string[]): number | null => {
  const wanted = new Set(keys.map((key) => key.toLowerCase()))
  for (const stat of stats) {
    const key = pick(stat, 'key', 'label', 'title').toLowerCase()
    if (!wanted.has(key)) continue
    const value = Number(pick(stat, 'value', 'count'))
    if (Number.isFinite(value)) return value
  }
  return null
}

type TabId =
  | 'profilePosts'
  | 'profilePostsSelf'
  | 'recentActivity'
  | 'postings'
  | 'claims'
  | 'warnings'
  | 'change-logs'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'profilePosts', label: 'Стена' },
  { id: 'profilePostsSelf', label: 'Собственные посты' },
  { id: 'recentActivity', label: 'Лента' },
  { id: 'postings', label: 'Недавние сообщения' },
  { id: 'claims', label: 'Споры' },
  { id: 'warnings', label: 'Предупреждения' },
  { id: 'change-logs', label: 'История блокировок' },
]

const DepositPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM12 7C12.5523 7 13 7.44772 13 8V11H16C16.5523 11 17 11.4477 17 12C17 12.5523 16.5523 13 16 13H13V16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16V13H8C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11H11V8C11 7.44772 11.4477 7 12 7Z"
    />
  </svg>
)

const DepositMinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM12 7C12.5523 7 13 7.44772 13 8V13.5858L15.2929 11.2929C15.6834 10.9024 16.3166 10.9024 16.7071 11.2929C17.0976 11.6834 17.0976 12.3166 16.7071 12.7071L12.7071 16.7071C12.3166 17.0976 11.6834 17.0976 11.2929 16.7071L7.29289 12.7071C6.90237 12.3166 6.90237 11.6834 7.29289 11.2929C7.68342 10.9024 8.31658 10.9024 8.70711 11.2929L11 13.5858V8C11 7.44772 11.4477 7 12 7Z"
    />
  </svg>
)

const ThreadsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      opacity="0.12"
      d="M3 7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V13.2C21 14.8802 21 15.7202 20.673 16.362C20.3854 16.9265 19.9265 17.3854 19.362 17.673C18.7202 18 17.8802 18 16.2 18H13.6837C13.0597 18 12.7477 18 12.4492 18.0613C12.1844 18.1156 11.9282 18.2055 11.6875 18.3285C11.4162 18.4671 11.1725 18.662 10.6852 19.0518L8.29976 20.9602C7.88367 21.2931 7.67563 21.4595 7.50054 21.4597C7.34827 21.4599 7.20422 21.3906 7.10923 21.2716C7 21.1348 7 20.8684 7 20.3355V18C6.07003 18 5.60504 18 5.22354 17.8978C4.18827 17.6204 3.37962 16.8117 3.10222 15.7765C3 15.395 3 14.93 3 14V7.8Z"
      fill="currentColor"
    />
    <path
      d="M7 8.5H12M7 12H15M7 18V20.3355C7 20.8684 7 21.1348 7.10923 21.2716C7.20422 21.3906 7.34827 21.4599 7.50054 21.4597C7.67563 21.4595 7.88367 21.2931 8.29976 20.9602L10.6852 19.0518C11.1725 18.662 11.4162 18.4671 11.6875 18.3285C11.9282 18.2055 12.1844 18.1156 12.4492 18.0613C12.7477 18 13.0597 18 13.6837 18H16.2C17.8802 18 18.7202 18 19.362 17.673C19.9265 17.3854 20.3854 16.9265 20.673 16.362C21 15.7202 21 14.8802 21 13.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V14C3 14.93 3 15.395 3.10222 15.7765C3.37962 16.8117 4.18827 17.6204 5.22354 17.8978C5.60504 18 6.07003 18 7 18Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const MarketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      opacity="0.12"
      d="M17.3294 17H6.36843L4.63159 6H21.0414C21.3707 6 21.5353 6 21.6516 6.06739C21.7536 6.12651 21.8315 6.21979 21.8714 6.33074C21.9169 6.45721 21.8874 6.61918 21.8285 6.94311L20.4778 14.3724C20.3078 15.3071 20.2229 15.7744 19.9848 16.1246C19.7748 16.4333 19.4827 16.6771 19.1414 16.8284C18.7543 17 18.2793 17 17.3294 17Z"
      fill="currentColor"
    />
    <path
      d="M6.50014 17H17.3294C18.2793 17 18.7543 17 19.1414 16.8284C19.4827 16.6771 19.7748 16.4333 19.9847 16.1246C20.2228 15.7744 20.3078 15.3071 20.4777 14.3724L21.8285 6.94311C21.8874 6.61918 21.9169 6.45721 21.8714 6.33074C21.8315 6.21979 21.7536 6.12651 21.6516 6.06739C21.5353 6 21.3707 6 21.0414 6H5.00014M2 2H3.3164C3.55909 2 3.68044 2 3.77858 2.04433C3.86507 2.0834 3.93867 2.14628 3.99075 2.22563C4.04984 2.31565 4.06876 2.43551 4.10662 2.67523L6.89338 20.3248C6.93124 20.5645 6.95016 20.6843 7.00925 20.7744C7.06133 20.8537 7.13493 20.9166 7.22142 20.9557C7.31956 21 7.44091 21 7.6836 21H19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CopyButton = ({ value }: { value: string }) => {
  const [done, setDone] = useState(false)
  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setDone(true)
      pushToast({ kind: 'success', title: 'Скопировано', message: value })
      window.setTimeout(() => setDone(false), 1500)
    } else {
      pushToast({ kind: 'error', title: 'Не удалось скопировать' })
    }
  }
  return (
    <span
      className="copyButton"
      onClick={() => void copy()}
      style={{ cursor: 'pointer', marginLeft: 6, display: 'inline-flex', color: '#949494' }}
      title="Скопировать"
    >
      {done ? <Check size={14} style={{ color: '#00ba78' }} /> : <Copy size={14} />}
    </span>
  )
}

const AvatarList = ({
  title,
  count,
  people,
  onOpenProfile,
}: {
  title: string
  count: number
  people: Mini[]
  onOpenProfile: (userId: number) => void
}) => {
  const avatarOverride = useAvatarOverride()
  if (people.length === 0) return null
  return (
    <div className="section membersOnline">
      <div className="secondaryContent">
        <h3>
          <span className="mainc">{count}</span> {title}
        </h3>
        <div className="avatarList">
          <ul>
            {people.map((u, i) => {
              const nameHtml = pick(u, 'usernameHtml') || pick(u, 'username', 'name')
              const plain = stripHtml(pick(u, 'username', 'name'))
              const avatar = avatarOverride ?? pick(u, 'avatarUrl', 'avatar')
              const userTitle = pick(u, 'userTitle', 'title')
              const uid = Number(pick(u, 'userId', 'id'))
              return (
                <li key={uid || i}>
                  <a
                    className="avatar"
                    onClick={() => uid && onOpenProfile(uid)}
                    style={{ cursor: 'pointer' }}
                  >
                    {avatar ? (
                      <img src={avatar} width={40} height={40} alt={plain} loading="lazy" />
                    ) : null}
                  </a>
                  <div className="memberInfo">
                    <div>
                      <a
                        className="username"
                        onClick={() => uid && onOpenProfile(uid)}
                        style={{ cursor: 'pointer' }}
                      >
                        <EnrichedUsername
                          username={plain}
                          html={nameHtml}
                          color={pick(u, 'usernameColor') || undefined}
                        />
                      </a>
                    </div>
                    {userTitle && <div className="userTitle">{userTitle}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

const ThreadRow = ({ th, onOpen }: { th: Mini; onOpen: (url: string) => void }) => {
  const title = stripHtml(pick(th, 'title', 'name'))
  const url = pick(th, 'url')
  const prefixArr = asList((th as Mini).prefixes)
  const prefixes: Array<{ text: string; color: string | null; cssClass: string | null }> =
    prefixArr.length > 0
      ? prefixArr.map((p) => {
          const text = stripHtml(pick(p, 'title', 'text', 'name')) || stripHtml(str(p))
          const rawCls = pick(p, 'cssClass', 'css_class')
          const cssClass = rawCls
            ? rawCls.replace(/#[0-9a-fA-F]{3,8}/g, '').replace(/ +/g, ' ').trim()
            : null
          return { text, color: pick(p, 'color') || null, cssClass }
        })
      : stripHtml(pick(th, 'prefix'))
        ? [{ text: stripHtml(pick(th, 'prefix')), color: null, cssClass: null }]
        : []
  const date = fmtThreadDate((th as Mini).createDate ?? (th as Mini).date ?? (th as Mini).postDate)
  const replies = pick(th, 'replyCount', 'replies', 'postCount')
  const likes = pick(th, 'likeCount', 'likes')
  return (
    <div className="discussionListItem ProfileThread">
      <div className="discussionListItem--Wrapper">
        <a
          className="listBlock main"
          onClick={() => url && onOpen(url)}
          style={{ cursor: url ? 'pointer' : 'default' }}
        >
          <h3 className="title">
            <span className="unread">{title}</span>
          </h3>
        </a>
        <div className="profile_threads_list_icon_bump">
          <div className="profile_threads_list_subtitleBlock">
            {prefixes.length > 0 && (
              <span className="threadTitle--prefixGroup">
                {prefixes.map((p, i) => (
                  <span
                    key={i}
                    className={p.cssClass || 'prefix'}
                    style={p.cssClass ? undefined : p.color ? { color: p.color } : undefined}
                  >
                    {p.text}
                  </span>
                ))}
              </span>
            )}
            {date && (
              <span className="posterDate">
                <span className="startDate muted">{date}</span>
              </span>
            )}
            <span className="discussionListItem--replyCount icon muted">{replies || '0'}</span>
            <span className="discussionListItem--likeCount icon muted pclikeCount">
              {likes || '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ProfileCard = ({
  profile,
  isOwn,
  onOpenProfile,
}: {
  profile: FullProfile
  isOwn: boolean
  onOpenProfile: (userId: number) => void
}) => {
  const avatarOverride = useAvatarOverride()
  const [tab, setTab] = useState<TabId>('profilePosts')
  const [trophies, setTrophies] = useState<ProfileTrophy[]>([])

  useEffect(() => {
    setTab('profilePosts')
    let alive = true
    void (async () => {
      const res = await window.moderator.profile.getTrophies(profile.userId)
      if (alive) setTrophies(res.ok ? res.trophies ?? [] : [])
    })()
    return () => {
      alive = false
    }
  }, [profile.userId])

  const following = useMemo(() => asList((profile as unknown as Mini).following), [profile])
  const followers = useMemo(() => asList((profile as unknown as Mini).followers), [profile])
  const threads = useMemo(() => asList((profile as unknown as Mini).threads), [profile])
  const customFields = useMemo(() => asList((profile as unknown as Mini).customFields), [profile])
  const stats = useMemo(() => asList((profile as unknown as Mini).stats), [profile])
  const contactFields = useMemo(
    () => customFields.filter((field) => getContactKind(field) !== null),
    [customFields],
  )
  const infoFields = useMemo(
    () =>
      customFields
        .filter((field) => getContactKind(field) === null)
        .map((field, index) => ({ field, index }))
        .sort(
          (a, b) =>
            infoFieldWeight(a.field) - infoFieldWeight(b.field) || a.index - b.index,
        )
        .map(({ field }) => field),
    [customFields],
  )
  const followingCount = findStatCount(stats, 'followings', 'following') ?? following.length
  const followersCount = findStatCount(stats, 'followers') ?? followers.length

  const nameHtml = profile.usernameHtml || profile.username
  const plainName = stripHtml(profile.username)
  const StyledName = (
    <EnrichedUsername
      username={plainName}
      html={nameHtml}
      color={profile.usernameColor ?? undefined}
      userId={profile.userId}
    />
  )

  const deposit = str((profile as unknown as Mini).deposit) || '0'
  const base = (profile.profileUrl || `${SCHEME}lolz.team`).replace(/\/+$/, '')
  const openExternal = (url: string) => void window.moderator.app.openExternal(url)

  const openUserThreads = () => {
    useViewStore.getState().setView('forum')
    useForumStore.getState().selectSection({
      type: 'userThreads',
      userId: profile.userId,
      username: plainName,
    })
  }

  const openSellerItems = () => {
    useViewStore.getState().setView('market')
    useMarketRoute.getState().openSeller({
      userId: profile.userId,
      username: plainName,
      usernameHtml: profile.usernameHtml,
      usernameColor: profile.usernameColor,
    })
  }

  return (
    <div className="member_view">
      <div className="profilePage">
        <div className="box-back">
          {}
          <div className="sidebar">
            {}
            <div className="section topblock">
              <div className="secondaryContent">
                <div className="avatarScaler">
                  <div className="avatar-container">
                    <div className="user-avatar-block">
                      <a
                        className="LbTrigger"
                        onClick={() => profile.avatarUrl && openExternal(profile.avatarUrl)}
                        style={{ cursor: profile.avatarUrl ? 'pointer' : 'default' }}
                      >
                        {(avatarOverride ?? profile.avatarUrl) && (
                          <img
                            className="LbImage"
                            src={(avatarOverride ?? profile.avatarUrl) ?? undefined}
                            alt={plainName}
                          />
                        )}
                      </a>
                    </div>
                  </div>
                </div>
                {isOwn && (
                  <a
                    className="button block"
                    onClick={() => openExternal(`${base}/account/personal-details`)}
                    style={{ cursor: 'pointer' }}
                  >
                    Редактировать
                  </a>
                )}
              </div>
            </div>

            {}
            <div className="section insuranceDeposit">
              <div className="secondaryContent">
                <a className="depositUsername username">
                  Страховой депозит
                  <br />
                  <span className="styleUserNickname">{StyledName}</span>
                </a>
                <p className="insuranceMoney amount redc">{deposit}&nbsp;₽</p>
                {isOwn && (
                  <div className="actionsDeposit">
                    <div className="buttonContainer">
                      <a
                        className="button secondary"
                        onClick={() => openExternal(`${base}/deposit-replenish`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="SvgIcon">
                          <DepositPlusIcon />
                        </div>
                      </a>
                      <span className="muted">Пополнить</span>
                    </div>
                    <div className="buttonContainer">
                      <a
                        className="button"
                        onClick={() => openExternal(`${base}/deposit-withdraw`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="SvgIcon">
                          <DepositMinusIcon />
                        </div>
                      </a>
                      <span className="muted">Снять</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {
}
            <div className="section memberNoteForm">
              <div className="secondaryContent">
                <UserNoteCard userId={profile.userId} />
              </div>
            </div>

            <AvatarList
              title="подписок"
              count={followingCount}
              people={following}
              onOpenProfile={onOpenProfile}
            />
            <AvatarList
              title="подписчиков"
              count={followersCount}
              people={followers}
              onOpenProfile={onOpenProfile}
            />
          </div>

          {}
          <div className="mainProfileColumn">
            <div className="darkBackground">
              <div id="page_info_wrap">
                <div className="page_top">
                  <h4 className="profile_online muted">
                    {profile.isOnline
                      ? 'В сети'
                      : profile.lastSeenDate
                        ? `Был(а) ${fmtAgo(profile.lastSeenDate)}`
                        : ''}
                  </h4>
                  <h1 itemProp="name" className="username">
                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>{StyledName}</div>
                  </h1>
                  <div className="page_current_info">
                    <div className="userBlurb current_text">
                      {profile.statusMessage ? (
                        profile.statusMessage
                      ) : (
                        <span className="muted">{isOwn ? 'Изменить статус' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="profile_info profile_info_short">
                  <div className="pairsJustified">
                    <div className="clear_fix profile_info_row">
                      <div className="label fl_l">Регистрация:</div>
                      <div className="labeled">{fmtDate(profile.registerDate)}</div>
                    </div>
                    <div className="clear_fix profile_info_row">
                      <div className="label fl_l">ID:</div>
                      <div className="labeled">
                        {profile.userId}
                        <CopyButton value={String(profile.userId)} />
                      </div>
                    </div>
                    {profile.gender && (
                      <div className="clear_fix profile_info_row">
                        <div className="label fl_l">Пол:</div>
                        <div className="labeled">
                          {profile.gender === 'male' ? 'Мужской' : 'Женский'}
                        </div>
                      </div>
                    )}
                    {infoFields.map((f, i) => {
                      const label = stripHtml(pick(f, 'title', 'label', 'name'))
                      const value = stripHtml(pick(f, 'value', 'text'))
                      const href = pick(f, 'href')
                      if (!label && !value) return null
                      return (
                        <div key={i} className="clear_fix profile_info_row">
                          <div className="label fl_l">{label}:</div>
                          <div className="labeled">
                            {href ? (
                              <a
                                className="externalLink"
                                onClick={() =>
                                  void window.moderator.app.openExternal(href, {
                                    forceExternal: true,
                                  })
                                }
                                style={{ cursor: 'pointer' }}
                              >
                                {value}
                              </a>
                            ) : (
                              <span>{value}</span>
                            )}
                            {value && <CopyButton value={value} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {contactFields.length > 0 && (
                  <div className="contactsBlock">
                    {contactFields.map((field, index) => {
                      const kind = getContactKind(field)
                      if (!kind) return null
                      const label = stripHtml(pick(field, 'label', 'title', 'name'))
                      const value = stripHtml(pick(field, 'value', 'text'))
                      const href = pick(field, 'href')
                      return (
                        <div key={`${kind}-${index}`} className={`contactItem ${kind}`}>
                          {href && (
                            <a
                              className="ContactClicker"
                              onClick={() =>
                                void window.moderator.app.openExternal(href, {
                                  forceExternal: true,
                                })
                              }
                              aria-label={`Открыть ${label}`}
                            />
                          )}
                          <img
                            className="contactIcon"
                            src={CONTACT_ICONS[kind]}
                            alt=""
                            aria-hidden="true"
                          />
                          <span className="contactText">
                            <strong>{label}</strong>
                            <span>{value}</span>
                          </span>
                          <CopyButton value={value} />
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="userContentLinks">
                  <a className="button" onClick={openUserThreads} style={{ cursor: 'pointer' }}>
                    <span className="controlIcon">
                      <ThreadsIcon />
                    </span>
                    Темы от {StyledName}
                  </a>
                  <a className="button" onClick={openSellerItems} style={{ cursor: 'pointer' }}>
                    <span className="controlIcon">
                      <MarketIcon />
                    </span>
                    Аккаунты на Маркете
                  </a>
                </div>

                {trophies.length > 0 && (
                  <div className="memberViewTrophies">
                    <ol className="ChangeableTrophies">
                      {trophies.slice(0, 10).map((tr) => (
                        <li key={tr.id} className="trophy" title={tr.description ?? tr.title}>
                          <div
                            className="trophy-icon"
                            style={tr.iconUrl ? { backgroundImage: `url(${tr.iconUrl})` } : undefined}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {}
              <div className="counts_module">
                {stats.map((sItem, i) => {
                  const count = pick(sItem, 'value', 'count')
                  const key = pick(sItem, 'key', 'label', 'title')
                  const label = STAT_LABELS[key.toLowerCase()] ?? key
                  if (!count && !label) return null
                  return (
                    <a key={i} className="page_counter">
                      <div className="count">{count}</div>
                      <div className="label muted">{label}</div>
                    </a>
                  )
                })}
              </div>
            </div>

            <div className="tabsSentinel" />

            {}
            {threads.length > 0 && (
              <div className="profile_threads_block">
                <a
                  className="profile_threads_header_title"
                  onClick={openUserThreads}
                  style={{ cursor: 'pointer' }}
                >
                  {isOwn ? 'Ваши темы' : <>Темы от {StyledName}</>}
                </a>
                <div className="profile_threads_list">
                  {threads.map((th, i) => (
                    <ThreadRow key={pick(th, 'id') || i} th={th} onOpen={openExternal} />
                  ))}
                </div>
              </div>
            )}

            {}
            <div className="tabs mainTabs member_tabs">
              <ul>
                {TABS.map((tabItem) => (
                  <li key={tabItem.id} className={tab === tabItem.id ? 'active' : ''}>
                    <a
                      className={tab === tabItem.id ? 'active' : ''}
                      onClick={() => setTab(tabItem.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {tabItem.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {}
            <div id="ProfilePanes">
              <div className="profileContent">
                {tab === 'profilePosts' ? (
                  <ProfileWall userId={profile.userId} isOwn={isOwn} />
                ) : (
                  <div className="profile-pane-placeholder">
                    Раздел «{TABS.find((x) => x.id === tab)?.label}» скоро появится.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
