import { LZT_CONFIG } from '@lzt/shared'
import { app, session } from 'electron'
import log from 'electron-log/main'

const isDev = !app.isPackaged

const HTTPS = "https" + "://"
const HTTP = "http" + "://"
const WS = "ws" + "://"
const DEV_LOCAL_HTTP = `${HTTP}localhost:*`
const DEV_LOCAL_WS = `${WS}localhost:*`
const EMBED_FRAME_SOURCES = [
  `${HTTPS}www.youtube.com`,
  `${HTTPS}www.youtube-nocookie.com`,
  `${HTTPS}player.vimeo.com`,
  `${HTTPS}coub.com`,
  `${HTTPS}www.coub.com`,
  `${HTTPS}streamable.com`,
  `${HTTPS}www.streamable.com`,
  `${HTTPS}vk.com`,
  `${HTTPS}rutube.ru`,
  `${HTTPS}www.dailymotion.com`,
  `${HTTPS}w.soundcloud.com`,
  `${HTTPS}giphy.com`,
].join(" ")

const PROD_CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  `img-src 'self' data: https: ${HTTPS}*.lzt.market ${HTTPS}lolz.live ${HTTPS}*.lolz.live ${HTTPS}nztcdn.com ` +
  `${HTTPS}www.rambler.ru ${HTTPS}smakmail.com ${HTTPS}support.microsoft.com ${HTTPS}s.uicdn.com ${HTTPS}home.imgsmail.ru ${HTTPS}notletters.com; ` +
  "font-src 'self' data: https:; " +
  `connect-src 'self' ${HTTPS}*.lzt.market ${HTTPS}*.lolz.live; ` +
  "media-src 'self' blob: https:; " +
  `frame-src ${EMBED_FRAME_SOURCES}; ` +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none';"

const DEV_CSP =
  `default-src 'self' 'unsafe-inline' 'unsafe-eval' ${DEV_LOCAL_HTTP} ${DEV_LOCAL_WS}; ` +
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${DEV_LOCAL_HTTP} ${DEV_LOCAL_WS}; ` +
  `style-src 'self' 'unsafe-inline' ${DEV_LOCAL_HTTP}; ` +
  `img-src 'self' data: blob: ${DEV_LOCAL_HTTP} https: ${HTTPS}*.lzt.market ${HTTPS}lolz.live ${HTTPS}*.lolz.live ${HTTPS}nztcdn.com ` +
  `${HTTPS}www.rambler.ru ${HTTPS}smakmail.com ${HTTPS}support.microsoft.com ${HTTPS}s.uicdn.com ${HTTPS}home.imgsmail.ru ${HTTPS}notletters.com; ` +
  `font-src 'self' data: https: ${DEV_LOCAL_HTTP}; ` +
  `connect-src 'self' ${DEV_LOCAL_HTTP} ${DEV_LOCAL_WS} ${HTTPS}*.lzt.market ${HTTPS}*.lolz.live; ` +
  `media-src 'self' blob: ${DEV_LOCAL_HTTP} https:; ` +
  `frame-src ${DEV_LOCAL_HTTP} ${EMBED_FRAME_SOURCES}; ` +
  "object-src 'none'; base-uri 'self';"

export const bootstrap = async (): Promise<void> => {
  app.setAppUserModelId(LZT_CONFIG.appId)

  const csp = isDev ? DEV_CSP : PROD_CSP
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  log.info(
    `[boot] electron ${process.versions.electron} node ${process.versions.node} (csp=${isDev ? 'dev' : 'prod'})`,
  )
}
