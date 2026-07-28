import type { AccountLoginDetails } from '../contract'

export type LlmProvider = 'claude' | 'grok' | 'cursor' | 'chatgpt'
export type LlmLoginKind = 'session-cookie' | 'browser-cookie' | 'email-fill'

export interface LlmProviderConfig {
  provider: LlmProvider
  displayName: string
  loginKind: LlmLoginKind
  cookieDomain?: string
  cookieName?: string
  landingUrl?: string
}

const PROVIDERS: Record<LlmProvider, LlmProviderConfig> = {
  claude: {
    provider: 'claude',
    displayName: 'Claude',
    loginKind: 'session-cookie',
    cookieDomain: '.claude.ai',
    cookieName: 'sessionKey',
    landingUrl: 'https://claude.ai/login',
  },
  grok: {
    provider: 'grok',
    displayName: 'Grok',
    loginKind: 'browser-cookie',
    landingUrl: 'https://accounts.x.ai/sign-in/',
  },
  cursor: {
    provider: 'cursor',
    displayName: 'Cursor',
    loginKind: 'browser-cookie',
    landingUrl: 'https://cursor.com/',
  },
  chatgpt: {
    provider: 'chatgpt',
    displayName: 'ChatGPT',
    loginKind: 'email-fill',
    landingUrl: 'https://chatgpt.com/',
  },
}

const detectLlmProvider = (details: AccountLoginDetails): LlmProvider | null => {
  const item = details.item as Record<string, unknown>
  const title = typeof item.title === 'string' ? item.title : ''
  const category =
    (typeof item.category_name === 'string' ? item.category_name : '') ||
    (typeof item.category_title === 'string' ? item.category_title : '')
  const hay = `${details.categoryTitle} ${category} ${title}`.toLowerCase()

  if (hay.includes('claude')) return 'claude'
  if (hay.includes('grok') || hay.includes('x.ai')) return 'grok'
  if (hay.includes('cursor')) return 'cursor'
  if (hay.includes('chatgpt') || hay.includes('openai') || hay.includes('gpt')) return 'chatgpt'
  return null
}

export const resolveLlmProvider = (details: AccountLoginDetails): LlmProviderConfig | null => {
  const id = detectLlmProvider(details)
  return id ? PROVIDERS[id] : null
}
