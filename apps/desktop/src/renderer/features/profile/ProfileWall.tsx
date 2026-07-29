import { useCallback, useEffect, useState } from 'react'
import {
  Copy,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquareOff,
  MessagesSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Reply,
  Share2,
  Trash2,
} from 'lucide-react'
import type {
  ProfileFetchReason,
  ProfilePost,
  ProfilePostComment,
} from '@lzt/shared'
import { pushToast } from '~/stores/toast'
import { renderChatHtml } from '~/features/chat/chat-html'
import { handleBbInteraction } from '~/features/forum/bb-interactions'
import { ForumEditor } from '~/features/forum/ForumEditor'
import { EnrichedUsername } from './EnrichedUsername'
import styles from './ProfileWall.module.scss'


const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

const reasonText = (reason?: ProfileFetchReason): string => {
  switch (reason) {
    case 'no_token':
      return 'Нужен вход в профиль (нет токена сессии).'
    case 'unauthorized':
      return 'Недостаточно прав для этого действия.'
    case 'not_found':
      return 'Запись не найдена.'
    case 'rate_limited':
      return 'Слишком много запросов — попробуйте позже.'
    case 'bad_query':
      return 'Некорректный запрос.'
    default:
      return 'Нет связи с форумом.'
  }
}

const fmtWhen = (unix: number): string => {
  if (!unix) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(unix * 1000))
  } catch {
    return ''
  }
}

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

const appendMention = (draft: string, name: string): string => {
  const base = draft.trim()
  return (base ? base + ' ' : '') + `@${name}, `
}

const BodyHtml = ({
  html,
  text,
  className,
}: {
  html: string | null
  text: string
  className?: string
}) => (
  <div
    className={`${styles.body}${className ? ` ${className}` : ''}`}
    onClick={handleBbInteraction}
    // eslint-disable-next-line react/no-danger -- HTML санитизируется renderChatHtml
    dangerouslySetInnerHTML={{
      __html: html ? renderChatHtml(html) : escapeHtml(text),
    }}
  />
)

const Avatar = ({ url, name }: { url: string | null; name: string }) =>
  url ? (
    <img className={styles.avatar} src={url} alt={name} loading="lazy" />
  ) : (
    <div className={styles.avatarFallback}>
      {(name.charAt(0) || '?').toUpperCase()}
    </div>
  )

const Comments = ({
  post,
  open,
  setOpen,
  onCountChange,
}: {
  post: ProfilePost
  open: boolean
  setOpen: (v: boolean) => void
  onCountChange: (delta: number) => void
}) => {
  const [items, setItems] = useState<ProfilePostComment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.moderator.profile.getPostComments(post.id)
    if (res.ok) setItems(res.comments ?? [])
    else {
      setItems([])
      pushToast({ kind: 'error', title: 'Комментарии не загрузились', message: reasonText(res.reason) })
    }
    setLoading(false)
  }, [post.id])

  useEffect(() => {
    if (open && items === null) void load()
  }, [open, items, load])

  const submit = async () => {
    const body = draft.trim()
    if (!body) return
    setSending(true)
    const res = await window.moderator.profile.createPostComment(post.id, body)
    setSending(false)
    if (res.ok) {
      setDraft('')
      if (res.comment) setItems((prev) => [...(prev ?? []), res.comment!])
      else void load()
      onCountChange(1)
    } else {
      pushToast({ kind: 'error', title: 'Комментарий не отправлен', message: reasonText(res.reason) })
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Удалить комментарий?')) return
    const res = await window.moderator.profile.deletePostComment(id)
    if (res.ok) {
      setItems((prev) => (prev ?? []).filter((c) => c.id !== id))
      onCountChange(-1)
    } else {
      pushToast({ kind: 'error', title: 'Не удалось удалить', message: reasonText(res.reason) })
    }
  }

  const replyTo = (name: string) => {
    setOpen(true)
    setDraft((d) => appendMention(d, name))
  }

  if (!open) return null

  const canComment = post.permissions.comment && !post.commentsDisabled

  return (
    <div className={styles.comments}>
      {loading && (
        <div className={styles.commentsLoading}>
          <Loader2 size={16} className={styles.spin} /> Загрузка…
        </div>
      )}

      {items?.map((c) => (
        <div key={c.id} className={styles.comment}>
          <Avatar url={c.avatarUrl} name={c.username} />
          <div className={styles.commentMain}>
            <div className={styles.commentHeader}>
              <EnrichedUsername
                className={styles.name}
                username={c.username}
                html={c.usernameHtml}
                color={c.usernameColor}
              />
              {c.canDelete && (
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Удалить комментарий"
                  onClick={() => void remove(c.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <BodyHtml html={c.bodyHtml} text={c.body} className={styles.commentBody} />
            <div className={styles.commentFooter}>
              <span className={styles.date}>{fmtWhen(c.createDate)}</span>
              {canComment && (
                <button
                  type="button"
                  className={styles.commentReply}
                  onClick={() => replyTo(c.username)}
                >
                  <Reply size={13} /> Ответить
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {items && items.length === 0 && !loading && (
        <div className={styles.commentsEmpty}>Пока нет комментариев.</div>
      )}

      {canComment && (
        <div className={styles.commentComposer}>
          <ForumEditor
            value={draft}
            onChange={setDraft}
            onSubmit={() => void submit()}
            sending={sending}
            placeholder="Ваш комментарий…"
            compact
          />
        </div>
      )}
    </div>
  )
}

const WallPost = ({
  post,
  onRemoved,
}: {
  post: ProfilePost
  onRemoved: (id: number) => void
}) => {
  const [liked, setLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [sticked, setSticked] = useState(post.isSticked)
  const [commentsDisabled, setCommentsDisabled] = useState(post.commentsDisabled)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const perms = post.permissions

  const toggleLike = async () => {
    if (!perms.like) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    const res = next
      ? await window.moderator.profile.likePost(post.id)
      : await window.moderator.profile.unlikePost(post.id)
    if (!res.ok) {
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
      pushToast({ kind: 'error', title: 'Не удалось', message: reasonText(res.reason) })
    }
  }

  const toggleStick = async () => {
    setMenuOpen(false)
    const next = !sticked
    const res = next
      ? await window.moderator.profile.stickPost(post.id)
      : await window.moderator.profile.unstickPost(post.id)
    if (res.ok) {
      setSticked(next)
      pushToast({ kind: 'success', title: next ? 'Закреплено' : 'Откреплено' })
    } else pushToast({ kind: 'error', title: 'Не удалось', message: reasonText(res.reason) })
  }

  const toggleCommentsDisabled = async () => {
    setMenuOpen(false)
    const next = !commentsDisabled
    const res = await window.moderator.profile.editPost(post.id, {
      disableComments: next,
    })
    if (res.ok) {
      setCommentsDisabled(next)
      pushToast({ kind: 'success', title: next ? 'Комментарии выключены' : 'Комментарии включены' })
    } else pushToast({ kind: 'error', title: 'Не удалось', message: reasonText(res.reason) })
  }

  const remove = async () => {
    setMenuOpen(false)
    if (!window.confirm('Удалить запись со стены?')) return
    const res = await window.moderator.profile.deletePost(post.id)
    if (res.ok) {
      pushToast({ kind: 'success', title: 'Запись удалена' })
      onRemoved(post.id)
    } else pushToast({ kind: 'error', title: 'Не удалось удалить', message: reasonText(res.reason) })
  }

  const copyBbcode = async () => {
    setMenuOpen(false)
    const ok = await copyText(post.body)
    pushToast(
      ok
        ? { kind: 'success', title: 'BBCode скопирован' }
        : { kind: 'error', title: 'Не удалось скопировать' },
    )
  }

  const share = () => {
    setMenuOpen(false)
    if (post.url) void window.moderator.app.openExternal(post.url)
  }

  const hasMenu = perms.stick || perms.edit || perms.delete || Boolean(post.url)

  return (
    <article className={`${styles.post}${sticked ? ` ${styles.pinned}` : ''}`}>
      <header className={styles.postHeader}>
        <div className={styles.postHeaderLeft}>
          <Avatar url={post.posterAvatarUrl} name={post.posterUsername} />
          <div className={styles.postAbout}>
            <div className={styles.postIdentity}>
              <EnrichedUsername
                className={styles.name}
                username={post.posterUsername}
                html={post.posterUsernameHtml}
                color={post.posterUsernameColor}
              />
              {sticked && (
                <span className={styles.pinnedBadge}>
                  <Pin size={12} /> Закреплено
                </span>
              )}
            </div>
            <span className={styles.date}>{fmtWhen(post.createDate)}</span>
          </div>
        </div>
        {hasMenu && (
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Действия"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
                <div className={styles.menu}>
                  {perms.stick && (
                    <button type="button" className={styles.menuItem} onClick={() => void toggleStick()}>
                      {sticked ? <PinOff size={14} /> : <Pin size={14} />}
                      {sticked ? 'Открепить' : 'Закрепить'}
                    </button>
                  )}
                  {perms.edit && (
                    <button type="button" className={styles.menuItem} onClick={() => void toggleCommentsDisabled()}>
                      {commentsDisabled ? <MessagesSquare size={14} /> : <MessageSquareOff size={14} />}
                      {commentsDisabled ? 'Включить комментарии' : 'Выключить комментарии'}
                    </button>
                  )}
                  {post.url && (
                    <button type="button" className={styles.menuItem} onClick={share}>
                      <Share2 size={14} /> Поделиться
                    </button>
                  )}
                  <button type="button" className={styles.menuItem} onClick={() => void copyBbcode()}>
                    <Copy size={14} /> Скопировать BBCode
                  </button>
                  {perms.delete && (
                    <button
                      type="button"
                      className={`${styles.menuItem} ${styles.danger}`}
                      onClick={() => void remove()}
                    >
                      <Trash2 size={14} /> Удалить
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <BodyHtml html={post.bodyHtml} text={post.body} className={styles.postBody} />

      <div className={styles.postActions}>
        <button
          type="button"
          className={`${styles.actionBtn}${liked ? ` ${styles.liked}` : ''}`}
          onClick={() => void toggleLike()}
          disabled={!perms.like}
          title="Мне нравится"
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount > 0 ? likeCount : 'Нравится'}</span>
        </button>
        {!commentsDisabled && (
          <button
            type="button"
            className={`${styles.actionBtn}${commentsOpen ? ` ${styles.liked}` : ''}`}
            onClick={() => setCommentsOpen((v) => !v)}
            title="Комментировать"
          >
            <MessageCircle size={16} />
            <span>{commentCount > 0 ? commentCount : 'Комментировать'}</span>
          </button>
        )}
      </div>

      {!commentsDisabled ? (
        <Comments
          post={{ ...post, commentCount }}
          open={commentsOpen}
          setOpen={setCommentsOpen}
          onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))}
        />
      ) : (
        <div className={styles.commentsDisabled}>Комментарии выключены</div>
      )}
    </article>
  )
}

export const ProfileWall = ({
  userId,
  isOwn,
}: {
  userId: number
  isOwn: boolean
}) => {
  void isOwn
  const [posts, setPosts] = useState<ProfilePost[]>([])
  const [canPost, setCanPost] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const loadPage = useCallback(
    async (p: number) => {
      if (p === 1) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      const res = await window.moderator.profile.getPosts(userId, p, 20)
      if (res.ok) {
        const fresh = res.posts ?? []
        setPosts((prev) => (p === 1 ? fresh : [...prev, ...fresh]))
        setCanPost(Boolean(res.canPost))
        setHasMore(Boolean(res.hasMore))
        setPage(res.page ?? p)
      } else {
        setError(reasonText(res.reason))
      }
      setLoading(false)
      setLoadingMore(false)
    },
    [userId],
  )

  useEffect(() => {
    setPosts([])
    setPage(1)
    void loadPage(1)
  }, [userId, loadPage])

  const submitPost = async () => {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    const res = await window.moderator.profile.createPost(userId, body)
    setPosting(false)
    if (res.ok) {
      setDraft('')
      if (res.post) setPosts((prev) => [res.post!, ...prev])
      else void loadPage(1)
      pushToast({ kind: 'success', title: 'Запись опубликована' })
    } else {
      pushToast({ kind: 'error', title: 'Не удалось опубликовать', message: reasonText(res.reason) })
    }
  }

  const onRemoved = (id: number) =>
    setPosts((prev) => prev.filter((p) => p.id !== id))

  return (
    <section className={styles.wall}>
      {canPost && (
        <ForumEditor
          value={draft}
          onChange={setDraft}
          onSubmit={() => void submitPost()}
          sending={posting}
          placeholder="Напишите что-нибудь…"
        />
      )}

      {loading && (
        <div className={styles.center}>
          <Loader2 size={22} className={styles.spin} /> Загрузка стены…
        </div>
      )}

      {error && !loading && (
        <div className={styles.error}>
          {error}
          <button type="button" className={styles.retry} onClick={() => void loadPage(1)}>
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className={styles.center}>На стене пока пусто.</div>
      )}

      {posts.map((post) => (
        <WallPost key={post.id} post={post} onRemoved={onRemoved} />
      ))}

      {hasMore && !loading && (
        <button
          type="button"
          className={styles.loadMore}
          disabled={loadingMore}
          onClick={() => void loadPage(page + 1)}
        >
          {loadingMore ? <Loader2 size={15} className={styles.spin} /> : null}
          Показать ещё
        </button>
      )}
    </section>
  )
}
