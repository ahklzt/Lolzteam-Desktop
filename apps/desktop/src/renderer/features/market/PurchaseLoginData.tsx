import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import type { MarketItem } from '@lzt/shared'
import { getMarketIcon } from './market-icons'
import './market-lolz.scss'
import styles from './MarketView.module.scss'

const STEAM_CATEGORY_ID = 1
const HTTPS_PREFIX = 'https' + '://'

type Props = {
  item: MarketItem
  categoryName?: string
  categorySlug?: string
  openSignal?: number
}

const CookieIcon = () => (
  <span className="SvgIcon-loginData Only-Fill">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12.0469 1.00098C12.5406 1.02434 12.9754 1.45843 12.999 1.95216C13.0002 1.97601 13 1.98933 13 2.01563V6.43165C13 6.68403 12.9996 6.93052 13.0166 7.13868C13.0353 7.36719 13.0796 7.63695 13.2178 7.90821C13.4095 8.28447 13.7155 8.5905 14.0918 8.78223C14.3631 8.92045 14.6328 8.96471 14.8613 8.98341C15.0695 9.00041 15.316 9.00004 15.5684 9.00001H19.9844C20.0106 9.00001 20.024 8.99985 20.0479 9.00098C20.5416 9.02464 20.9757 9.45936 20.999 9.95313C21.0001 9.97671 21 9.98454 21 10V17.2412C21 18.0462 21.0003 18.7108 20.9561 19.252C20.9101 19.814 20.8117 20.3311 20.5645 20.8164C20.181 21.5689 19.5689 22.181 18.8164 22.5645C18.3311 22.8117 17.814 22.9101 17.252 22.9561C16.7108 23.0003 16.0462 23 15.2412 23H8.75879C7.95383 23 7.28924 23.0003 6.74805 22.9561C6.18599 22.9101 5.6689 22.8117 5.18359 22.5645C4.43109 22.181 3.81902 21.5689 3.43555 20.8164C3.18827 20.3311 3.08987 19.814 3.04395 19.252C2.99973 18.7108 2.99999 18.0462 3 17.2412V6.7588C2.99999 5.95384 2.99973 5.28924 3.04395 4.74805C3.08988 4.186 3.18827 3.66891 3.43555 3.1836C3.81902 2.4311 4.43109 1.81902 5.18359 1.43555C5.6689 1.18828 6.18599 1.08988 6.74805 1.04395C7.28923 0.999736 7.95384 0.999996 8.75879 1.00001H12C12.0155 1 12.0233 0.999875 12.0469 1.00098ZM8 17C7.44772 17 7 17.4477 7 18C7 18.5523 7.44772 19 8 19H16C16.5523 19 17 18.5523 17 18C17 17.4477 16.5523 17 16 17H8ZM8 13C7.44772 13 7 13.4477 7 14C7 14.5523 7.44772 15 8 15H16C16.5523 15 17 14.5523 17 14C17 13.4477 16.5523 13 16 13H8ZM8 9.00001C7.44772 9.00001 7 9.44772 7 10C7 10.5523 7.44772 11 8 11H10C10.5523 11 11 10.5523 11 10C11 9.44772 10.5523 9.00001 10 9.00001H8ZM15.6172 2.30665C15.7542 2.33969 15.8499 2.43563 16.041 2.62696L19.373 5.95899C19.5644 6.15013 19.6603 6.24584 19.6934 6.38282C19.7399 6.57653 19.6386 6.82264 19.4688 6.92676C19.3485 7.00039 19.2015 7.00001 18.9082 7.00001H15.7998C15.5202 7 15.3803 6.99966 15.2734 6.94532C15.1794 6.89738 15.1026 6.82065 15.0547 6.72657C15.0003 6.61967 15 6.47987 15 6.2002V3.0918C15 2.79834 15.0005 2.65149 15.0742 2.53126C15.1784 2.36159 15.4236 2.26011 15.6172 2.30665Z"></path>
    </svg>
  </span>
)

const MailIcon = () => (
  <span className="SvgIcon-loginData Only-Fill">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M2.06552 8.21149C1.82337 8.04056 1.70229 7.95509 1.59906 7.93423C1.37159 7.88825 1.13609 8.01028 1.04248 8.22263C0.999994 8.319 0.999996 8.46556 1 8.75869V15.2413C0.999988 16.0463 0.999978 16.7106 1.04419 17.2518C1.06792 17.5422 1.40639 17.659 1.62227 17.4634L6.81647 12.7581C7.06952 12.5289 7.19605 12.4142 7.23639 12.2826C7.27177 12.1673 7.26421 12.043 7.21513 11.9327C7.15914 11.807 7.01967 11.7085 6.74072 11.5116L2.06552 8.21149Z"></path>
      <path d="M2.69115 19.1938C2.48752 19.3782 2.38571 19.4705 2.3454 19.6023C2.31416 19.7045 2.32351 19.8551 2.36717 19.9527C2.42348 20.0785 2.51634 20.1437 2.70207 20.2741C2.85507 20.3815 3.01605 20.4784 3.18404 20.564C3.66937 20.8113 4.18608 20.9099 4.74818 20.9558C5.28937 21 5.95372 21 6.75868 21H17.2413C18.0463 21 18.7106 21 19.2518 20.9558C19.8139 20.9099 20.3306 20.8113 20.816 20.564C20.984 20.4784 21.1449 20.3814 21.2979 20.2741C21.4837 20.1437 21.5765 20.0785 21.6328 19.9527C21.6765 19.8551 21.6859 19.7045 21.6546 19.6023C21.6143 19.4705 21.5125 19.3782 21.3089 19.1938L15.1892 13.65C15.0722 13.5441 15.0138 13.4911 14.9505 13.4601C14.8306 13.4013 14.6922 13.3929 14.5661 13.4368C14.4995 13.4599 14.435 13.5055 14.3062 13.5965C13.7589 13.984 13.2783 14.3243 12.7303 14.4618C12.2509 14.5821 11.7493 14.5821 11.2699 14.4618C10.7218 14.3243 10.2413 13.984 9.694 13.5965C9.56505 13.5054 9.50057 13.4599 9.43394 13.4367C9.30788 13.3929 9.16954 13.4013 9.0497 13.46C8.98636 13.491 8.92785 13.544 8.81085 13.65L2.69115 19.1938Z"></path>
      <path d="M22.3777 17.4634C22.5936 17.659 22.9321 17.5421 22.9558 17.2518C23 16.7106 23 16.0463 23 15.2413V8.75868C23 8.46566 23 8.31916 22.9576 8.22282C22.864 8.0104 22.6284 7.88833 22.4009 7.93436C22.2977 7.95523 22.1766 8.04066 21.9346 8.21153L17.2594 11.5117C16.9804 11.7086 16.8409 11.807 16.785 11.9328C16.7359 12.043 16.7283 12.1673 16.7637 12.2827C16.804 12.4143 16.9306 12.5289 17.1836 12.7582L22.3777 17.4634Z"></path>
      <path d="M22.2796 4.70729C22.3888 4.86318 22.4434 4.94112 22.4602 5.05968C22.4733 5.15207 22.4508 5.2809 22.4072 5.36341C22.3513 5.46929 22.2568 5.53604 22.0676 5.66953L13.2688 11.8805C12.5361 12.3977 12.3807 12.4875 12.2435 12.5219C12.0837 12.562 11.9165 12.562 11.7567 12.5219C11.6195 12.4875 11.4641 12.3977 10.7314 11.8805L1.93241 5.66945C1.74329 5.53596 1.64873 5.46921 1.5928 5.36333C1.54921 5.28082 1.52676 5.15199 1.53986 5.05959C1.55667 4.94103 1.61126 4.86309 1.72044 4.7072C2.09472 4.17279 2.604 3.73152 3.18404 3.43598C3.66937 3.18868 4.18608 3.09012 4.74818 3.04419C5.28937 2.99998 5.95372 2.99999 6.75869 3H17.2413C18.0463 2.99999 18.7106 2.99998 19.2518 3.04419C19.8139 3.09012 20.3306 3.18868 20.816 3.43598C21.396 3.73154 21.9053 4.17284 22.2796 4.70729Z"></path>
    </svg>
  </span>
)

const SellerIcon = () => (
  <span className="SvgIcon-loginData Only-Fill">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6.80003 1.00027L6.73857 1.00014C6.5117 0.999423 6.22617 0.99852 5.9508 1.07716C5.71234 1.14527 5.48863 1.25712 5.29108 1.40702C5.06294 1.58013 4.89235 1.8091 4.7568 1.99102L4.72003 2.04027L3.24984 4.00049C3.11339 4.18242 3.04516 4.27338 3.01972 4.36088C2.94867 4.60521 3.08535 4.87858 3.32344 4.96834C3.40871 5.00049 3.5238 5.00049 3.75398 5.00049H20.2461C20.4763 5.00049 20.5914 5.00049 20.6766 4.96834C20.9147 4.87858 21.0514 4.60521 20.9803 4.36088C20.9549 4.27338 20.8867 4.18242 20.7502 4.00049L19.28 2.04027L19.2433 1.99102C19.1077 1.8091 18.9371 1.58012 18.709 1.40702C18.5114 1.25712 18.2877 1.14527 18.0493 1.07716C17.7739 0.99852 17.4884 0.999423 17.2615 1.00014L17.2 1.00027H6.80003Z"></path>
      <path fillRule="evenodd" clipRule="evenodd" d="M22.0001 8.60049C22.0001 8.04044 22.0001 7.76041 21.8911 7.5465C21.7952 7.35834 21.6422 7.20536 21.4541 7.10948C21.2401 7.00049 20.9601 7.00049 20.4001 7.00049H3.6C3.03995 7.00049 2.75992 7.00049 2.54601 7.10948C2.35784 7.20536 2.20486 7.35834 2.10899 7.5465C2 7.76041 2 8.04044 2 8.60049L2.00003 18.8388C2.00001 19.366 2 19.8207 2.0306 20.1953C2.0629 20.5906 2.13422 20.9839 2.32701 21.3622C2.61463 21.9267 3.07357 22.3857 3.63806 22.6733C4.01644 22.8661 4.40966 22.9374 4.805 22.9697C5.17957 23.0003 5.63432 23.0003 6.16146 23.0003L17.8386 23.0003C18.3657 23.0003 18.8205 23.0003 19.1951 22.9697C19.5904 22.9374 19.9836 22.8661 20.362 22.6733C20.9265 22.3857 21.3854 21.9267 21.673 21.3622C21.8658 20.9839 21.9372 20.5906 21.9695 20.1953C22.0001 19.8207 22 19.366 22 18.8388L22.0001 8.60049ZM8.00002 10.0005C8.55231 10.0005 9.00002 10.4482 9.00002 11.0005C9.00002 11.7961 9.31609 12.5592 9.8787 13.1218C10.4413 13.6844 11.2044 14.0005 12 14.0005C12.7957 14.0005 13.5587 13.6844 14.1213 13.1218C14.684 12.5592 15 11.7961 15 11.0005C15 10.4482 15.4477 10.0005 16 10.0005C16.5523 10.0005 17 10.4482 17 11.0005C17 12.3266 16.4732 13.5983 15.5356 14.536C14.5979 15.4737 13.3261 16.0005 12 16.0005C10.6739 16.0005 9.40217 15.4737 8.46449 14.536C7.52681 13.5983 7.00002 12.3266 7.00002 11.0005C7.00002 10.4482 7.44774 10.0005 8.00002 10.0005Z"></path>
    </svg>
  </span>
)

const str = (item: MarketItem, key: string): string | null => {
  const v = item[key]
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

const bool = (item: MarketItem, key: string): boolean => item[key] === true

const stripHtml = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

export const PurchaseLoginData = ({ item, categoryName, categorySlug, openSignal }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [full, setFull] = useState<MarketItem | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [emailCode, setEmailCode] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [mafileBusy, setMafileBusy] = useState(false)

  const data = full ?? item
  const isSteam = data.category_id === STEAM_CATEGORY_ID
  const iconUrl = getMarketIcon(categorySlug)

  const load = useCallback(async () => {
    if (full) return
    setLoading(true)
    setError(false)
    const res = await window.moderator.market.getAccount(item.item_id)
    setLoading(false)
    if (!res.ok) {
      setError(true)
      return
    }
    setFull(res.item)
  }, [full, item.item_id])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) void load()
  }

  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setOpen(true)
      void load()
    }
  }, [openSignal, load])

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
    }
  }

  const getEmailCode = async () => {
    setEmailBusy(true)
    const res = await window.moderator.market.getTempEmailPassword(item.item_id)
    setEmailBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    setEmailCode(res.password)
  }

  const downloadMafile = async () => {
    setMafileBusy(true)
    const res = await window.moderator.market.getMafile(item.item_id)
    setMafileBusy(false)
    if (!res.ok) {
      setError(true)
      return
    }
    try {
      const blob = new Blob([JSON.stringify(res.maFile, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.item_id}.maFile`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(true)
    }
  }

  const title = categoryName
    ? t('market.loginData.title', { category: categoryName })
    : t('market.loginData.titleGeneric')

  const nested = (() => {
    for (const k of ['loginData', 'login_data', 'account_data'] as const) {
      const v = (data as Record<string, unknown>)[k]
      if (v && typeof v === 'object') return v as Record<string, unknown>
    }
    return null
  })()
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      if (nested) {
        const nv = nested[k]
        if (typeof nv === 'string' && nv.trim()) return nv.trim()
      }
      const v = str(data, k)
      if (v) return v
    }
    return null
  }

  const login = pick('login_original', 'account_login', 'steam_login', 'username', 'login')
  const password = pick('password_original', 'account_password', 'steam_password', 'password')
  const email = pick('email', 'account_email')
  const emailPassword = pick('email_password')
  const copyFormat = str(data, 'copyFormatData')
  const accountLink = str(data, 'accountLink') || str(data, 'emailLoginUrl')
  const links = Array.isArray(data.accountLinks)
    ? (data.accountLinks as unknown[]).filter((l): l is string => typeof l === 'string')
    : []
  const canGetEmailCode = bool(data, 'showGetEmailCodeButton') || bool(data, 'canViewTempEmail')

  const cookiesText = (() => {
    const src =
      (nested ? nested['cookies'] : undefined) ??
      (data as Record<string, unknown>)['cookies'] ??
      (data as Record<string, unknown>)['accountCookies']
    if (typeof src === 'string' && src.trim()) return src.trim()
    if (Array.isArray(src)) {
      try {
        return JSON.stringify(src)
      } catch {
        return null
      }
    }
    return null
  })()

  const sellerInfoRaw = pick(
    'market_information_from_seller',
    'information_from_seller',
    'seller_information',
    'information',
  )
  const sellerInfo = sellerInfoRaw ? stripHtml(sellerInfoRaw) : null

  const emailProviderUrl = (() => {
    if (!email) return null
    const dom = email.split('@')[1]?.toLowerCase() ?? ''
    if (!dom) return null
    if (dom.includes('outlook') || dom.includes('hotmail') || dom.includes('live')) {
      return HTTPS_PREFIX + 'outlook.live.com'
    }
    if (dom.includes('gmail') || dom.includes('googlemail')) return HTTPS_PREFIX + 'mail.google.com'
    if (dom.includes('rambler')) return HTTPS_PREFIX + 'mail.rambler.ru'
    if (dom.includes('yandex') || dom === 'ya.ru') return HTTPS_PREFIX + 'mail.yandex.ru'
    if (
      dom.includes('mail.ru') ||
      dom.includes('bk.ru') ||
      dom.includes('inbox.ru') ||
      dom.includes('list.ru')
    ) {
      return HTTPS_PREFIX + 'e.mail.ru'
    }
    return HTTPS_PREFIX + dom
  })()

  const renderRow = (label: string, value: string, key: string) => (
    <div className="new-inputGroup" key={key}>
      <span>{label}</span>
      <div className="new-copyGroup">
        <span className="new-infoBlock notranslate">{value}</span>
        <span
          className="copyButton new-copyIcon"
          role="button"
          tabIndex={0}
          title={t('market.loginData.copy')}
          onClick={() => void copy(value, key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') void copy(value, key)
          }}
        >
          {copied === key ? <Check size={16} className="greenColor" /> : <Copy size={16} />}
        </span>
      </div>
    </div>
  )

  const hasLogin = Boolean(login || password || copyFormat)
  const hasEmail = Boolean(email || emailPassword)
  const hasAnything =
    hasLogin || hasEmail || Boolean(cookiesText) || Boolean(sellerInfo) || links.length > 0

  return (
    <div className="loginDataSpoiler">
      <button type="button" className="bbCodeSpoilerButton" onClick={toggle}>
        <KeyRound size={16} />
        {open ? t('market.loginData.hide') : title}
      </button>

      {open ? (
        <div className="loginDataSpoilerBody">
          {loading ? (
            <div className={styles.modalLoading}>
              <Loader2 className={styles.spin} size={18} />
            </div>
          ) : error ? (
            <p className={styles.errorText}>{t('market.loginData.error')}</p>
          ) : (
            <>
              {hasLogin ? (
                <div className="marketItemView--loginData new-loginData-block loginData-Block">
                  <div className="marketItemView--loginData--title">
                    {iconUrl ? (
                      <img className="categoryIcon" src={iconUrl} alt="" aria-hidden="true" />
                    ) : null}
                    {title}
                  </div>
                  <div className="new-inputContainer">
                    {login ? renderRow(`${t('market.loginData.login')}:`, login, 'login') : null}
                    {password ? renderRow(`${t('market.loginData.password')}:`, password, 'password') : null}
                    {login && password
                      ? renderRow(`${t('market.loginData.loginAndPassword')}:`, `${login}:${password}`, 'combo')
                      : null}
                    {!login && !password && copyFormat
                      ? renderRow(`${t('market.loginData.data')}:`, copyFormat, 'format')
                      : null}
                  </div>
                  {accountLink || isSteam ? (
                    <div className="btn-group">
                      {accountLink ? (
                        <button
                          type="button"
                          className="button"
                          onClick={() => void window.moderator.app.openExternal(accountLink)}
                        >
                          <ExternalLink size={14} />
                          {t('market.loginData.openLink')}
                        </button>
                      ) : null}
                      {isSteam ? (
                        <button
                          type="button"
                          className="button"
                          onClick={() => void downloadMafile()}
                          disabled={mafileBusy}
                        >
                          {mafileBusy ? (
                            <Loader2 className={styles.spin} size={14} />
                          ) : (
                            <ShieldCheck size={14} />
                          )}
                          {t('market.loginData.downloadMafile')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {cookiesText ? (
                <div className="marketItemView--loginData new-loginData-block cookies--block">
                  <div className="marketItemView--loginData--title">
                    <CookieIcon />
                    {t('market.loginData.cookies')}:
                  </div>
                  <div className="new-inputContainer">
                    <div className="new-inputGroup">
                      <textarea className="textCtrl accountCookies" readOnly value={cookiesText} />
                    </div>
                  </div>
                  <div className="btn-group">
                    <button
                      type="button"
                      className="button"
                      onClick={() => void copy(cookiesText, 'cookies')}
                    >
                      {copied === 'cookies' ? (
                        <Check size={14} className="greenColor" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {t('market.loginData.copy')}
                    </button>
                  </div>
                </div>
              ) : null}

              {hasEmail ? (
                <div className="marketItemView--loginData new-loginData-block email-type-autoreg-or-native">
                  <div className="marketItemView--loginData--title">
                    <MailIcon />
                    {t('market.loginData.emailAccess')}:
                  </div>
                  <div className="new-inputContainer">
                    {email ? renderRow(`${t('market.loginData.email')}:`, email, 'email') : null}
                    {emailPassword ? renderRow(`${t('market.loginData.emailPassword')}:`, emailPassword, 'emailPassword') : null}
                    {email && emailPassword
                      ? renderRow(`${t('market.loginData.emailAndPassword')}:`, `${email}:${emailPassword}`, 'emailCombo')
                      : null}
                    {emailCode ? renderRow(`${t('market.loginData.code')}:`, emailCode, 'emailCode') : null}
                  </div>
                  <div className="btn-group">
                    {emailProviderUrl ? (
                      <button
                        type="button"
                        className="button"
                        onClick={() => void window.moderator.app.openExternal(emailProviderUrl)}
                      >
                        <ExternalLink size={14} />
                        {t('market.loginData.loginToEmail')}
                      </button>
                    ) : null}
                    {canGetEmailCode ? (
                      <button
                        type="button"
                        className="button"
                        onClick={() => void getEmailCode()}
                        disabled={emailBusy}
                      >
                        {emailBusy ? (
                          <Loader2 className={styles.spin} size={14} />
                        ) : (
                          <KeyRound size={14} />
                        )}
                        {t('market.loginData.getEmailCode')}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {links.length > 0 ? (
                <div className="marketItemView--loginData new-loginData-block">
                  <div className="btn-group">
                    {links.map((l, i) => (
                      <button
                        key={`${l}-${i}`}
                        type="button"
                        className="button"
                        onClick={() => void window.moderator.app.openExternal(l)}
                      >
                        <ExternalLink size={14} />
                        {t('market.loginData.openLink')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {sellerInfo ? (
                <div className="marketItemView--loginData new-loginData-block market_information_from_seller">
                  <div className="marketItemView--loginData--title">
                    <SellerIcon />
                    {t('market.loginData.buyerInfo')}:
                  </div>
                  <blockquote className="quote">{sellerInfo}</blockquote>
                </div>
              ) : null}

              {!hasAnything ? (
                <p className={styles.modalHint}>{t('market.loginData.unavailable')}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default PurchaseLoginData
