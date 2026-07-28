import { useForumUser } from '~/lib/forum-user'
import { RichUsername } from './RichUsername'

interface Props {
  username: string
  html?: string | null
  color?: string | null
  className?: string
  enrich?: boolean
  userId?: string | number | null
}

export const EnrichedUsername = ({
  username,
  html = null,
  color = null,
  className,
  enrich = true,
  userId = null,
}: Props) => {
  const needFetch = enrich && !html && username.trim().length > 0
  const { profile } = useForumUser(needFetch ? username : null)
  return (
    <RichUsername
      className={className}
      html={html ?? profile?.usernameHtml ?? null}
      fallback={username}
      color={color ?? profile?.usernameColor ?? null}
      userId={userId ?? profile?.userId ?? null}
    />
  )
}
