import { LZT_CONFIG } from '@lzt/shared'

export const marketAvatarUrl = (userId: number, avatarDate?: number): string => {
  const group = Math.floor(userId / 1000)
  const version = avatarDate ? `?${avatarDate}` : ''
  return `${LZT_CONFIG.webUrl}/data/avatars/m/${group}/${userId}.jpg${version}`
}
