export interface ParsedAuthCallback {
  accessToken: string | null
  state: string | null
  expiresIn: number | null
  tokenType: string | null
  error: string | null
  errorDescription: string | null
}

export const parseAuthCallback = (raw: string): ParsedAuthCallback => {
  const empty: ParsedAuthCallback = {
    accessToken: null,
    state: null,
    expiresIn: null,
    tokenType: null,
    error: null,
    errorDescription: null,
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return empty
  }

  const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const query = url.searchParams
  const pick = (key: string): string | null => fragment.get(key) ?? query.get(key)

  const expiresRaw = pick('expires_in')
  const expiresIn = expiresRaw ? Number.parseInt(expiresRaw, 10) : null

  return {
    accessToken: pick('access_token'),
    state: pick('state'),
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
    tokenType: pick('token_type'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  }
}
