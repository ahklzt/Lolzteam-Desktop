import { LZT_CONFIG } from '@lzt/shared'
import { app, session } from 'electron'
import log from 'electron-log/main'

const isDev = !app.isPackaged

const PROD_CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https: https://*.lzt.market https://lolz.live https://*.lolz.live https://nztcdn.com " +
  "https://www.rambler.ru https://smakmail.com https://support.microsoft.com https://s.uicdn.com https://home.imgsmail.ru https://notletters.com; " +
  "font-src 'self' data: https:; " +
  "connect-src 'self' https://*.lzt.market https://*.lolz.live; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none';"

const DEV_CSP =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; " +
  "style-src 'self' 'unsafe-inline' http://localhost:*; " +
  "img-src 'self' data: blob: http://localhost:* https: https://*.lzt.market https://lolz.live https://*.lolz.live https://nztcdn.com " +
  "https://www.rambler.ru https://smakmail.com https://support.microsoft.com https://s.uicdn.com https://home.imgsmail.ru https://notletters.com; " +
  "font-src 'self' data: https: http://localhost:*; " +
  "connect-src 'self' http://localhost:* ws://localhost:* https://*.lzt.market https://*.lolz.live; " +
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
