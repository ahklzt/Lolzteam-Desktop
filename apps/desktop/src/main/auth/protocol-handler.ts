import { IPC, LZT_CONFIG } from '@lzt/shared'
import { type BrowserWindow, ipcMain, shell } from 'electron'
import { acceptAuthCallback, issueState } from './auth-broker'

type GetWindow = () => BrowserWindow | null

const buildAuthUrl = (state: string) => {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: LZT_CONFIG.clientId,
    redirect_uri: LZT_CONFIG.authRedirectUri,
    scope: LZT_CONFIG.oauthScopes,
    state,
  })
  return `${LZT_CONFIG.webUrl}/account/authorize?${params.toString()}`
}

export const registerAuthFlow = (getWindow: GetWindow) => {
  ipcMain.handle(IPC.AUTH_OPEN_BROWSER, async () => {
    const state = issueState()
    await shell.openExternal(buildAuthUrl(state))
    return { state }
  })

  const protocolPrefix = `${LZT_CONFIG.protocolScheme}://`

  return (url: string) => {
    if (!url.startsWith(protocolPrefix)) return
    void acceptAuthCallback(url, getWindow)
  }
}
