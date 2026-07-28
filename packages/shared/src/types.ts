export interface UserProfile {
  userId: number;
  username: string;
  avatarUrl: string | null;
  usernameColor: string | null;
  balance: number | null;
  currency: string | null;
}

export type AuthStatus =
  | { authenticated: false }
  | { authenticated: true; offline: true; profile: null }
  | { authenticated: true; offline: false; profile: UserProfile };

export interface AuthTokenPayload {
  accessToken: string;
  state: string | null;
  expiresIn: number | null;
  tokenType: string | null;
}

export type NetworkStatus =
  { online: true; ms: number } | { online: false; message: string };

export type LocalePreference = "ru" | "en";
export type Locale = "ru" | "en";
export const LOCALE_OPTIONS: LocalePreference[] = ["ru", "en"];

export const MARKET_CURRENCIES = [
  "rub",
  "uah",
  "kzt",
  "byn",
  "usd",
  "eur",
  "gbp",
  "cny",
  "try",
  "jpy",
  "brl",
] as const;
export type MarketCurrency = (typeof MARKET_CURRENCIES)[number];

export type ProxyProtocol = "http" | "https" | "socks4" | "socks5";

export type ProxyTestResult =
  | { ok: true; checkedAt: number; ms: number; ip: string; protocol?: ProxyProtocol }
  | { ok: false; checkedAt: number; message: string };

export interface ProxyEntry {
  id: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  label?: string;
  test?: ProxyTestResult;
}

export interface ProxyTestInput {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export type ProxyFetchResult =
  { ok: true; proxies: ProxyEntry[] } | { ok: false; message: string };

export type LoginMethod = "ask" | "browser" | "mafile" | "password";
export const LOGIN_METHODS: LoginMethod[] = [
  "ask",
  "browser",
  "mafile",
  "password",
];

export interface AccountLabel {
  id: string;
  title: string;
  color: string;
}

export interface LocalUniqShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface LocalUniqConfig {
  enabled: boolean;
  bannerText: string;
  usernameCss: string;
  bannerCss: string;
  shadows: LocalUniqShadow[];
  usernameIconSvg: string | null;
}

export interface ModeratorSettings {
  locale: LocalePreference;
  minimizeToTray: boolean;
  mailHistory: string[];
  proxyEnabled: boolean;
  proxies: ProxyEntry[];
  appProxyId: string | null;
  chatSeparateWindow: boolean;

  telegramSessionPath: string | null;
  telegramMaxAccounts: number;
  steamInvisible: boolean;
  steamAutoLaunchGame: boolean;
  steamAutoLaunchAppId: string;
  refreshOnLaunch: boolean;
  backgroundRefreshMinutes: number;
  accountLoadConcurrency: number;
  preferredLoginMethod: LoginMethod;
  accountLabels: AccountLabel[];

  appFont: string;
  avatarRadius: number;
  hideNotificationBadges: boolean;
  hideCommentButton: boolean;
  errorReports: boolean;
  messageRadius: number;
  messageFontScale: number;
  appIconId: number;
  disableProfileBackgrounds: boolean;
  navOrder: string[];
  navHidden: string[];
  warnSendMessage: boolean;
  warnSendThread: boolean;
  warnSendChatMessage: boolean;

  hideAvatars: boolean;
  avatarPlaceholder: string | null;
  spoofAndroid: boolean;
  delayedSend: boolean;
  delayedSendSeconds: number;
  localUniq: LocalUniqConfig;

  saveDeletedMessages: boolean;
  saveDeletedThreads: boolean;
  saveEditHistory: boolean;
  historyCheckSeconds: number;
  historyRetentionDays: number;
  cacheMedia: boolean;
  chatReplaceIcons: boolean;
  chatIconOverrides: Record<string, string>;

  launchOnStartup: boolean;
  systemWindowFrame: boolean;
  showTrayIcon: boolean;
  showTaskbarIcon: boolean;
  systemSpellcheck: boolean;

  autoUpdate: boolean;
  betaUpdates: boolean;

  telegramBotToken: string;
  telegramChatId: string;
  telegramAlertsEnabled: boolean;
  telegramAlertNotifications: boolean;
  telegramAlertMessages: boolean;
  telegramAlertBumps: boolean;

  autoCleanCache: boolean;
  storageLimitMb: number;
  mediaCacheLimitMb: number;
  cacheMaxAgeDays: number;
}

export const DEFAULT_SETTINGS: ModeratorSettings = {
  locale: "ru",
  minimizeToTray: true,
  mailHistory: [],
  proxyEnabled: false,
  proxies: [],
  appProxyId: null,
  chatSeparateWindow: false,
  telegramSessionPath: null,
  telegramMaxAccounts: 3,
  steamInvisible: false,
  steamAutoLaunchGame: false,
  steamAutoLaunchAppId: "",
  refreshOnLaunch: true,
  backgroundRefreshMinutes: 0,
  accountLoadConcurrency: 2,
  preferredLoginMethod: "ask",
  accountLabels: [],
  appFont: "system",
  avatarRadius: 50,
  hideNotificationBadges: false,
  hideCommentButton: false,
  errorReports: true,
  messageRadius: 14,
  messageFontScale: 100,
  appIconId: 1,
  disableProfileBackgrounds: false,
  navOrder: ["market", "forum", "tools", "profile", "settings"],
  navHidden: [],
  warnSendMessage: false,
  warnSendThread: false,
  warnSendChatMessage: false,
  hideAvatars: false,
  avatarPlaceholder: null,
  spoofAndroid: false,
  delayedSend: false,
  delayedSendSeconds: 5,
  localUniq: {
    enabled: false,
    bannerText: "",
    usernameCss: "",
    bannerCss: "",
    shadows: [],
    usernameIconSvg: null,
  },
  saveDeletedMessages: false,
  saveDeletedThreads: false,
  saveEditHistory: false,
  historyCheckSeconds: 30,
  historyRetentionDays: 90,
  cacheMedia: true,
  chatReplaceIcons: false,
  chatIconOverrides: {},
  launchOnStartup: false,
  systemWindowFrame: false,
  showTrayIcon: true,
  showTaskbarIcon: true,
  systemSpellcheck: false,
  autoUpdate: true,
  betaUpdates: false,
  telegramBotToken: "",
  telegramChatId: "",
  telegramAlertsEnabled: false,
  telegramAlertNotifications: true,
  telegramAlertMessages: true,
  telegramAlertBumps: false,
  autoCleanCache: false,
  storageLimitMb: 2048,
  mediaCacheLimitMb: 1024,
  cacheMaxAgeDays: 0,
};

export interface SettingsSnapshot {
  settings: ModeratorSettings;
  effectiveLocale: Locale;
}

export interface MailLetter {
  uid: string;
  subject: string;
  from: string;
  fromAddress: string;
  date: string | null;
  preview: string;
  body: string;
  seenOnServer: boolean;
}

export type MailFetchResult =
  | { ok: true; provider: string; email: string; letters: MailLetter[] }
  | { ok: false; message: string };

export type MailResult = MailFetchResult;

export type CurrencyResult = { ok: true } | { ok: false; message: string };

export interface ProfileCustomField {
  key: string;
  label: string;
  value: string;
  href?: string;
}

export interface ProfileStat {
  key: string;
  value: number;
}

export interface UserBan {
  date: number | null;
  endDate: number | null;
  reasonHtml: string | null;
  reasonText: string | null;
  author: string | null;
}

export interface FullProfile {
  userId: number;
  username: string;
  usernameColor: string | null;
  usernameHtml: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerHtml: string | null;
  userTitle: string | null;
  description: string | null;
  statusMessage: string | null;
  isOnline: boolean | null;
  registerDate: number | null;
  lastSeenDate: number | null;
  gender: "male" | "female" | null;
  birthday: string | null;
  profileUrl: string | null;
  isVerified: boolean;
  customFields: ProfileCustomField[];
  stats: ProfileStat[];
  deposit: number | null;
  isFollowed: boolean;
  isIgnored: boolean;
  isBanned: boolean;
  ban: UserBan | null;
  following: ProfileFollower[];
  followers: ProfileFollower[];
  threads: UserThread[];
}

export interface ProfileFollower {
  userId: number;
  username: string;
  usernameColor: string | null;
  usernameHtml: string | null;
  avatarUrl: string | null;
  userTitle: string | null;
}

export interface ThreadPrefix {
  title: string;
  color: string | null;
  textColor?: string | null;
  cssClass?: string | null;
}

export interface UserThread {
  threadId: number;
  title: string;
  createDate: number | null;
  postCount: number | null;
  viewCount: number | null;
  likeCount: number | null;
  prefixes: ThreadPrefix[];
  creatorUserId: number | null;
  creatorUsername: string | null;
  creatorUsernameHtml: string | null;
  url: string | null;
}

export interface FollowOptions {
  alertOnThread: boolean;
  alertOnProfilePost: boolean;
}

export interface UserNote {
  userId: number;
  text: string;
  updatedAt: number;
}

export type ProfileActionResult =
  { ok: true } | { ok: false; reason: ProfileFetchReason; message?: string };

export type FollowersResult =
  | { ok: true; followers: ProfileFollower[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type UserThreadsResult =
  | { ok: true; threads: UserThread[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface UserClaim {
  threadId: number;
  claimDate: number | null;
  claimState: string | null;
  messageHtml: string | null;
  messageText: string | null;
  amount: number | null;
  amountFormatted: string | null;
  authorUserId: number | null;
  authorUsername: string | null;
  authorUsernameHtml: string | null;
  type: "market" | "nomarket";
}

export type UserClaimsResult =
  | { ok: true; claims: UserClaim[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ProfileFetchReason =
  | "no_token"
  | "invalid_token"
  | "unauthorized"
  | "not_found"
  | "offline"
  | "rate_limited"
  | "bad_query";

export type ProfileFetchResult =
  | { ok: true; profile: FullProfile }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ProfileTokenStatus {
  hasToken: boolean;
  profile: FullProfile | null;
}

export type ProxyCheckProtocol = "auto" | "http" | "https" | "socks5";

export interface ProxyCheckInput {
  protocol: ProxyCheckProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ProxyGeo {
  country: string;
  countryCode: string;
  city: string;
  isp: string;
  asn: string;
  timezone: string;
}

export type ProxyIpType = "Datacenter" | "Residential" | "Mobile" | "Unknown";

export interface ProxyMeta {
  protocol: "http" | "https" | "socks5";
  realIp: string;
  ipVersion: "IPv4" | "IPv6";
  ms: number;
  geo: ProxyGeo;
  ipType: ProxyIpType;
  rotating: boolean;
}

export type ProxyCheckResult =
  ({ ok: true } & ProxyMeta) | { ok: false; message: string };

export interface SiteCheckInput {
  proxy: ProxyCheckInput;
  targetUrl: string;
}

export interface SiteCheckRedirect {
  status: number;
  url: string;
}

export type SiteCheckResult =
  | {
      ok: true;
      opened: boolean;
      proxyInfo: ProxyMeta | null;
      httpStatus: number;
      responseTimeMs: number;
      httpVersion: string;
      targetUrl: string;
      finalUrl: string;
      redirects: SiteCheckRedirect[];
      page: {
        title: string;
        description: string;
        contentType: string;
        encoding: string;
        sizeBytes: number;
      };
      server: { server: string; poweredBy: string; date: string };
      cloudflare: boolean;
      captcha: boolean;
    }
  | { ok: false; message: string };

export type IpLookupResult =
  | {
      ok: true;
      ip: string;
      country: string;
      countryCode: string;
      city: string;
      isp: string;
      asn: string;
      ipType: ProxyIpType;
      lat: number;
      lon: number;
      timezone: string;
    }
  | { ok: false; message: string };

export interface PersonalDisplayGroup {
  id: number;
  title: string;
}

export type PersonalGender = "" | "male" | "female";

export interface PersonalInfo {
  userId: number;
  username: string;
  userTitle: string;
  shortLink: string;
  profileUrl: string;
  gender: PersonalGender;
  dobDay: number | null;
  dobMonth: number | null;
  dobYear: number | null;
  showDobDate: boolean;
  showDobYear: boolean;
  displayGroupId: number | null;
  displayGroups: PersonalDisplayGroup[];
  location: string;
  occupation: string;
  homepage: string;
  interests: string;
}

export type PersonalInfoUpdate = Partial<
  Pick<
    PersonalInfo,
    | "username"
    | "userTitle"
    | "shortLink"
    | "gender"
    | "dobDay"
    | "dobMonth"
    | "dobYear"
    | "showDobDate"
    | "showDobYear"
    | "displayGroupId"
    | "location"
    | "occupation"
    | "homepage"
    | "interests"
  >
>;

export type PersonalInfoResult =
  | { ok: true; info: PersonalInfo | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ContactInfo {
  telegram: string;
  vk: string;
  discord: string;
  steam: string;
  github: string;
  jabber: string;
  matrix: string;
}
export type ContactInfoUpdate = Partial<ContactInfo>;
export type ContactInfoResult =
  | { ok: true; info: ContactInfo | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ProfilePreferences {
  contentLanguageId: number | null;
  convWelcomeMessage: string;
  receiveAdminEmail: boolean;
  activityVisible: boolean;
  hideUsernameChangeLogs: boolean;
}
export type ProfilePreferencesUpdate = Partial<ProfilePreferences>;
export type PreferencesResult =
  | { ok: true; preferences: ProfilePreferences | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type PrivacyAudience = "everyone" | "members" | "followed" | "none";
export interface PrivacySettings {
  allowViewProfile: PrivacyAudience;
  allowPostProfile: PrivacyAudience;
  allowSendPersonalConversation: PrivacyAudience;
  allowReceiveNewsFeed: PrivacyAudience;
  showDobDate: boolean;
  showDobYear: boolean;
}
export type PrivacySettingsUpdate = Partial<PrivacySettings>;
export type PrivacyResult =
  | { ok: true; privacy: PrivacySettings | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface UserNoteListItem {
  userId: number;
  text: string;
  updatedAt: number;
}
export type UserNotesResult = { notes: UserNoteListItem[] };

export interface IgnoredUser {
  userId: number;
  username: string;
  userTitle: string;
  viewUrl: string;
}
export type IgnoredUsersResult =
  | { ok: true; users: IgnoredUser[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface NotificationItem {
  id: number;
  createdAt: number;
  text: string;
  isUnread: boolean;
  creatorUserId: number;
  creatorUsername: string;
  link: string | null;
}
export type NotificationsResult =
  | { ok: true; notifications: NotificationItem[]; unreadTotal: number }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface SecretAnswerType {
  id: number;
  title: string;
}
export interface SecretAnswerInfo {
  types: SecretAnswerType[];
}
export type SecretAnswerInfoResult =
  | { ok: true; info: SecretAnswerInfo }
  | { ok: false; reason: ProfileFetchReason; message?: string };
export interface SecretAnswerUpdate {
  answer: string;
  typeId: number;
}
export interface SecretResetResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  waitingTime?: number;
  message?: string;
}

export type MarketErrorReason =
  | "no_token"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "network"
  | "bad_response"
  | "unknown";

export interface MarketSeller {
  user_id: number;
  username?: string;
  username_html?: string | null;
  username_color?: string | null;
  sold_items_count?: number;
  active_item_count?: number;
  active_items_count?: number;
  avatar_date?: number;
  is_banned?: number;
  restore_percents?: number;
  [key: string]: unknown;
}

export interface MarketItem {
  item_id: number;
  item_state?: string;
  category_id: number;
  published_date?: number;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  price?: number;
  rub_price?: number;
  price_currency?: string;
  view_count?: number;
  is_sticky?: number;
  item_origin?: string;
  itemOriginPhrase?: string;
  guarantee?: boolean | number;
  tags?: string[];
  seller?: MarketSeller;
  [key: string]: unknown;
}

export interface MarketItemsPage {
  items: MarketItem[];
  totalItems: number;
  hasNextPage: boolean;
  perPage: number;
  page: number;
}

export type MarketItemsResult =
  | { ok: true; page: MarketItemsPage }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketUserItemStatesResult =
  | { ok: true; states: Record<string, unknown> }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketUserInfo {
  user_id: number;
  username?: string;
  uniq_username_css?: string | null;
  username_html?: string | null;
  username_color?: string | null;
  avatar_date?: number;
  is_banned?: number;
  display_style_group_id?: number;
  [key: string]: unknown;
}

export type MarketUserItemsResult =
  | { ok: true; page: MarketItemsPage; user: MarketUserInfo | null }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketAccountResult =
  | {
      ok: true;
      item: MarketItem;
      canBuyItem: boolean;
      canReportItem: boolean;
      canEditItem: boolean;
      faveCount: number | null;
      itemLink: string | null;
      sameItems: number[];
    }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type AccountLoginService =
  "steam" | "telegram" | "tiktok" | "instagram" | "discord" | "llm";

export type AccountLoginMethod = "native" | "web";

export type LoginStep =
  | "fetching-credentials"
  | "done"
  | "acquiring-token"
  | "awaiting-email-code"
  | "fetching-email-code"
  | "killing-steam"
  | "writing-vdf"
  | "encrypting-token"
  | "launching-steam"
  | "building-tdata"
  | "killing-telegram"
  | "writing-tdata"
  | "launching-telegram"
  | "injecting-cookies"
  | "launching-browser"
  | "injecting-token";

export interface LoginProgress {
  step: LoginStep;
  detail?: string;
}

export interface LoginProgressEvent extends LoginProgress {
  itemId: number;
}

export type AccountLoginResult =
  | { ok: true; method: AccountLoginMethod; message?: string }
  | { ok: false; message: string };

export interface ItemNote {
  itemId: number;
  text: string;
  updatedAt: number;
}
export interface ItemNoteListItem {
  itemId: number;
  text: string;
  updatedAt: number;
}
export type ItemNotesResult = { notes: ItemNoteListItem[] };

export interface MarketCategoryInfo {
  category_id: number;
  category_name?: string;
  category_title?: string;
  category_url?: string;
}

export type MarketCategoriesResult =
  | { ok: true; categories: MarketCategoryInfo[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketSearchParam {
  name: string;
  input: string;
  description?: string;
  values?: string[];
}

export type MarketCategoryParamsResult =
  | { ok: true; params: MarketSearchParam[]; baseParams: MarketSearchParam[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketGame {
  app_id: string;
  title: string;
  abbr?: string;
  category_id?: number;
  img?: string;
  url?: string;
  ru?: string;
}

export type MarketCategoryGamesResult =
  | { ok: true; games: MarketGame[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketQuery {
  slug?: string;
  page?: number;
  title?: string;
  pmin?: number;
  pmax?: number;
  order_by?: string;
  filters?: Record<string, string | number | string[]>;
}

export interface MarketUserItemsQuery {
  category_id?: number;
  title?: string;
  pmin?: number;
  pmax?: number;
  order_by?: string;
  show?: string;
  filters?: Record<string, string | number | string[]>;
}

export interface MarketTransferInput {
  username?: string;
  userId?: number;
  amount: number;
  currency: MarketCurrency;
  comment?: string;
  telegramDeal?: boolean;
  telegramUsername?: string;
  transferHold?: boolean;
  holdLengthValue?: number;
  holdLengthOption?: "hour" | "day" | "week" | "month" | "year";
  secretAnswer?: string;
}

export type MarketTransferReason =
  MarketErrorReason | "invalid_secret" | "user_not_found" | "bad_request";

export type MarketTransferResult =
  { ok: true } | { ok: false; reason: MarketTransferReason; message?: string };

export interface MarketTransferFee {
  commissionPercentage: number;
  commissionAmount: number;
  totalOutputAmount: number;
  inputAmount: number;
  spentCurrentMonth: number;
}

export type MarketTransferFeeResult =
  | { ok: true; fee: MarketTransferFee }
  | { ok: false; reason: MarketErrorReason };

export interface MarketCurrencyRate {
  code: string;
  title: string;
  symbol: string;
  rate: number;
  formattedRate: string;
}

export type MarketCurrencyRatesResult =
  | {
      ok: true;
      rates: MarketCurrencyRate[];
      lastUpdate: number | null;
      visitorCurrency: string | null;
    }
  | { ok: false; reason: MarketErrorReason };

export interface MarketTag {
  tag_id: number;
  title: string;
  background_color?: string | null;
  is_public?: boolean;
  [key: string]: unknown;
}

export type MarketTagsResult =
  | { ok: true; tags: MarketTag[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketTagMutationResult =
  | { ok: true; tag?: MarketTag }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketTagInput {
  title: string;
  backgroundColor: string;
}

export interface MarketPaymentData {
  user_id?: number;
  username?: string;
  comment?: string;
  commentPlain?: string;
  fee?: number;
  invoice_id?: string;
  payment_id?: string;
  is_test?: boolean;
  avatar?: string;
  uniq_username_css?: string;
  display_style_group_id?: number;
  [key: string]: unknown;
}

export interface MarketPayment {
  operation_id: number;
  operation_date: number;
  operation_type: string;
  incoming_sum: number;
  outgoing_sum: number;
  item_id: number | null;
  wallet: string | null;
  is_finished: boolean;
  is_hold: boolean;
  payment_system: string | null;
  hold_end_date: number | null;
  operation_end_date: number | null;
  data: MarketPaymentData;
  [key: string]: unknown;
}

export interface MarketPaymentsPage {
  payments: MarketPayment[];
  perPage: number;
  page: number;
  hasNextPage: boolean;
  lastOperationId: number | null;
  paymentStats: Record<string, unknown> | null;
  periodLabel: string | null;
  periodLabelPhrase: string | null;
  incomesSum: number | null;
  outgoingsSum: number | null;
  totalPaymentsSum: number | null;
}

export type MarketPaymentsResult =
  | { ok: true; page: MarketPaymentsPage }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type TelegramTestResult =
  | { ok: true; botUsername: string | null; chatTitle: string | null }
  | { ok: false; reason: "no_token" | "no_chat" | "unauthorized" | "network" | "bad_response"; message: string };

export interface MarketPaymentsQuery {
  type?: string;
  page?: number;
  pmin?: number;
  pmax?: number;
  currency?: string;
  operationIdLt?: number;
  isHold?: boolean;
  isApi?: boolean;
  receiver?: string;
  sender?: string;
  comment?: string;
  wallet?: string;
  startDate?: string;
  endDate?: string;
  showPaymentStats?: boolean;
}

export type MarketSimpleResult =
  { ok: true } | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketCheckResult =
  | { ok: true; valid: boolean; message?: string; tagIds: number[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketPurchaseErrorKind =
  | "not_enough_balance"
  | "item_sold"
  | "item_deleted"
  | "own_item"
  | "blacklisted"
  | "check_limit"
  | "retry_limit"
  | "video_required"
  | "unknown";

export interface MarketPurchaseError {
  kind: MarketPurchaseErrorKind;
  message: string;
  depositAmount?: number;
}

export interface MarketPurchasePreview {
  itemId: number;
  title: string;
  price: number;
  currency: string;
  rubPrice: number | null;
  categoryId: number;
  categoryTitle: string | null;
  itemOrigin: string | null;
  itemOriginPhrase: string | null;
  itemState: string | null;
  publishedDate: number | null;
  accountLastActivity: number | null;
  hasGuarantee: boolean;
  guaranteePhrase: string | null;
  emailType: string | null;
  loginType: string | null;
  descriptionPlain: string;
  sellerId: number | null;
  sellerUsername: string | null;
  canValidateAccount: boolean;
  requireVideoRecording: boolean;
  buyWithoutValidation: boolean;
  accountLinks: Array<{ link: string; text: string }>;
  extraPrices: Array<{ currency: string; price: string }>;
}

export type MarketPurchasePreviewResult =
  | { ok: true; preview: MarketPurchasePreview }
  | {
      ok: false;
      reason: MarketErrorReason;
      message?: string;
      error?: MarketPurchaseError;
    };

export interface MarketPurchaseSuccess {
  itemId: number;
  title: string;
  price: number | null;
  currency: string | null;
  login: string | null;
  password: string | null;
  raw: string | null;
  emailLogin: string | null;
  emailPassword: string | null;
  adviceToChangePassword: boolean;
}

export type MarketFastBuyResult =
  | { ok: true; purchase: MarketPurchaseSuccess; attempts: number }
  | {
      ok: false;
      attempts: number;
      reason: MarketErrorReason;
      message?: string;
      error?: MarketPurchaseError;
    };

export type MarketCartResult =
  | { ok: true; page: MarketItemsPage }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketCartMutationResult =
  | { ok: true }
  | {
      ok: false;
      reason: MarketErrorReason;
      message?: string;
      error?: MarketPurchaseError;
    };

export type MarketTempEmailPasswordResult =
  | { ok: true; password: string; email: string | null }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketMafileResult =
  | { ok: true; maFile: Record<string, unknown> }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type MarketDownloadFormat =
  "short" | "custom" | "mfa_file_steam_id" | "mfa_file_login";

export interface MarketDownloadQuery {
  type: "items" | "orders";
  format?: MarketDownloadFormat;
  customFormat?: string;
  category_id?: number;
  show?: string;
  title?: string;
}

export type MarketDownloadResult =
  | { ok: true; url: string }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketPublishInput {
  categoryId: number;
  price: number;
  currency?: MarketCurrency;
  title?: string;
  titleEn?: string;
  description?: string;
  information?: string;
  loginData?: string;
  emailLoginData?: string;
  guarantee?: number;
  originId?: string;
  extra?: Record<string, string | number | boolean>;
}

export type MarketPublishResult =
  | { ok: true; itemId: number | null; item: MarketItem | null }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketFastSellInput {
  price?: number;
  currency?: MarketCurrency;
  title?: string;
  titleEn?: string;
  description?: string;
  information?: string;
  extra?: Record<string, string | number | boolean>;
}

export type MarketFastSellResult =
  | { ok: true; itemId: number | null; item: MarketItem | null }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketProxyEntry {
  proxyId: number;
  ip: string;
  port: number;
  user?: string;
  label: string;
}

export type MarketProxyListResult =
  | { ok: true; proxies: MarketProxyEntry[] }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketSellUploadInput {
  categoryId: number;
  price: number;
  currency?: MarketCurrency;
  title?: string;
  titleEn?: string;
  itemOrigin: string;
  guarantee?: number;
  description?: string;
  information?: string;
  hasEmailLoginData?: boolean;
  emailLoginData?: string;
  login?: string;
  password?: string;
  loginPassword?: string;
  proxyId?: number;
  randomProxy?: boolean;
  extra?: Record<string, string | number | boolean>;
  tagIds?: number[];
  mafile?: string;
}

export type MarketSellUploadResult =
  | {
      ok: true;
      itemId: number | null;
      item: MarketItem | null;
      warnings?: string[];
    }
  | { ok: false; reason: MarketErrorReason; message?: string };

export type AppReadFileResult =
  | { ok: true; name: string; size: number; text: string; base64: string }
  | { ok: false; message: string };

export interface MarketEditPriceInput {
  itemId: number;
  price: number;
  currency?: MarketCurrency;
}

export type MarketPriceEditResult =
  | { ok: true; item: MarketItem | null }
  | { ok: false; reason: MarketErrorReason; message?: string };

export interface MarketRateLimitState {
  remaining: number | null;
  limit: number | null;
  resetAt: number | null;
  availableTokens: number;
  capacity: number;
  cooldownUntil: number | null;
}

export interface ConversationParticipant {
  userId: number;
  username: string;
  usernameHtml: string | null;
  usernameColor: string | null;
  avatarUrl: string | null;
}

export interface ConversationItem {
  id: number;
  title: string;
  interlocutorUsername: string;
  interlocutorUsernameColor: string | null;
  interlocutorUsernameHtml: string | null;
  interlocutorAvatarUrl: string | null;
  interlocutorUserId: number | null;
  recipients: ConversationParticipant[];
  lastMessagePreview: string | null;
  updateDate: number;
  messageCount: number;
  isUnread: boolean;
  isSaved: boolean;
  url: string;
}

export interface ConversationMessage {
  id: number;
  body: string;
  bodyHtml: string | null;
  createDate: number;
  creatorUserId: number;
  creatorUsername: string;
  creatorUsernameColor: string | null;
  creatorUsernameHtml: string | null;
  creatorAvatarUrl: string | null;
}

export type ConversationMessagesResult =
  | { ok: true; messages: ConversationMessage[]; hasMore: boolean }
  | { ok: false; reason: ProfileFetchReason; message?: string };
export type ConversationsResult =
  | {
      ok: true;
      conversations: ConversationItem[];
      unreadTotal: number;
      hasMore: boolean;
    }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumSearchUser {
  userId: number;
  username: string;
  usernameColor: string | null;
  usernameHtml: string | null;
  avatarUrl: string | null;
  userTitle: string | null;
}
export type ForumSearchUsersResult =
  | { ok: true; users: ForumSearchUser[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ChatRoom {
  roomId: number;
  title: string;
  isEnglish: boolean;
  isMarket: boolean;
  online: number | null;
}

export type ChatRoomsResult =
  | { ok: true; rooms: ChatRoom[]; totalOnline: number | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ChatUser {
  userId: number;
  username: string;
  usernameHtml: string | null;
  avatarUrl: string | null;
}

export interface ChatReplyPreview {
  username: string | null;
  usernameHtml: string | null;
  text: string | null;
}

export interface ChatMessage {
  messageId: number;
  date: number;
  html: string;
  raw: string;
  isDeleted: boolean;
  reply: ChatReplyPreview | null;
  user: ChatUser;
}

export type ChatMessagesResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ChatSendResult =
  | { ok: true; message: ChatMessage | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ChatActionResult =
  { ok: true } | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ChatUserStats {
  likeCount: number;
  sympathyCount: number;
  messageCount: number;
  trophyPoints: number;
  contestCount: number;
}

export interface ChatOnlineUser extends ChatUser, ChatUserStats {}

export type ChatOnlineResult =
  | { ok: true; users: ChatOnlineUser[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ChatLeaderboardDuration = "day" | "week" | "month" | "year";

export interface ChatLeaderboardEntry extends ChatOnlineUser {
  count: number;
}

export type ChatLeaderboardResult =
  | { ok: true; entries: ChatLeaderboardEntry[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ChatIgnoredResult =
  | { ok: true; users: ChatUser[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ChatRulesResult =
  | { ok: true; html: string }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumUser = ChatUser;

export interface ForumNode {
  forumId: number;
  title: string;
  description: string | null;
  isCategory: boolean;
  threadCount: number | null;
  iconContent: string | null;
  children: ForumNode[];
}

export type ForumTreeResult =
  | { ok: true; forums: ForumNode[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumThreadsQuery {
  source?: "threads" | "recent" | "new" | "userPosts";
  forumId?: number;
  creatorUserId?: number;
  posterUserId?: number;
  tab?: string;
  page?: number;
  limit?: number;
  order?: string;
  direction?: "asc" | "desc";
  state?: "active" | "closed";
  period?: "day" | "week" | "month" | "year";
  title?: string;
  titleOnly?: boolean;
  prefixIds?: number[];
  prefixIdsNot?: number[];
}

export interface ForumModerator {
  userId: number;
  username: string;
  usernameHtml: string | null;
  avatarUrl: string | null;
}

export interface ForumSectionInfo {
  forumId: number;
  title: string;
  description: string | null;
  threadCount: number | null;
  postCount: number | null;
  rulesThreadId: number | null;
  isFollowed: boolean;
  canFollow: boolean;
  canCreateThread: boolean;
  permalink: string | null;
  moderators: ForumModerator[];
}

export type ForumSectionResult =
  | { ok: true; section: ForumSectionInfo }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumThreadLastPost {
  postId: number;
  user: ForumUser;
  createDate: number;
  bodyHtml: string;
}

export interface ForumThreadItem {
  threadId: number;
  forumId: number;
  title: string;
  prefixes: ThreadPrefix[];
  creator: ForumUser;
  createDate: number;
  replyCount: number;
  viewCount: number;
  isSticky: boolean;
  isClosed: boolean;
  lastPostDate: number | null;
  firstPostId: number | null;
  likeCount: number;
  isLiked: boolean;
  contentHtml: string;
  lastPost: ForumThreadLastPost | null;
  tags: string[];
}

export interface ForumThreadEditable {
  title: string;
  prefixIds: number[];
  tags: string[];
  discussionOpen: boolean;
  hideContacts: boolean;
  allowAskHiddenContent: boolean;
  replyGroup: number | null;
  commentIgnoreGroup: boolean;
}

export type ForumThreadsResult =
  | {
      ok: true;
      threads: ForumThreadItem[];
      total: number | null;
      hasMore?: boolean;
    }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumPostItem {
  postId: number;
  threadId: number;
  user: ForumUser;
  createDate: number;
  bodyHtml: string;
  likeCount: number;
  isLiked: boolean | null;
  isFirstPost: boolean;
  canEdit: boolean;
  comments: ForumPostComment[];
}

export interface ForumPostComment {
  commentId: number;
  user: ForumUser;
  createDate: number;
  bodyHtml: string;
}

export type ForumPostCommentsResult =
  | { ok: true; comments: ForumPostComment[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumThreadDetailsResult =
  | {
      ok: true;
      thread: ForumThreadItem;
      firstPost: ForumPostItem | null;
      isBookmarked: boolean | null;
      isWatched: boolean | null;
      canEdit: boolean;
      canDelete: boolean;
      canReply: boolean;
      editable: ForumThreadEditable;
    }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumEditThreadInput {
  threadId: number;
  title?: string;
  prefixIds?: number[];
  tags?: string[];
  discussionOpen?: boolean;
  hideContacts?: boolean;
  allowAskHiddenContent?: boolean;
  replyGroup?: number;
  commentIgnoreGroup?: boolean;
}

export interface ForumModeratorLogEntry {
  moderator: string;
  action: string;
  date: number | null;
}

export type ForumModeratorLogResult =
  | { ok: true; entries: ForumModeratorLogEntry[] }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumPostBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumPostsResult =
  | { ok: true; posts: ForumPostItem[]; total: number | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumCreatePostResult =
  | { ok: true; post: ForumPostItem | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumCreateThreadInput {
  forumId: number;
  title: string;
  body: string;
  tags?: string;
  prefixIds?: number[];
  replyGroup?: number;
  commentIgnoreGroup?: boolean;
  hideContacts?: boolean;
  dontAlertFollowers?: boolean;
  watchThread?: boolean;
  watchThreadEmail?: boolean;
  scheduleDate?: string;
  scheduleTime?: string;
  maxReplyCount?: number;
  replyDelay?: number;
}

export type ForumCreateThreadResult =
  | { ok: true; threadId: number | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumCreateContestInput {
  forumId: number;
  title: string;
  body: string;
  contestType: "by_finish_date";
  lengthValue: number;
  lengthOption: "minutes" | "hours" | "days";
  prizeType: "money" | "upgrades";
  countWinners: number;
  prizeMoney?: number;
  isMoneyPlaces?: boolean;
  prizePlaces?: number[];
  prizeUpgrade?: number;
  requireLikeCount: number;
  requireTotalLikeCount: number;
  secretAnswer?: string;
  tags?: string;
  replyGroup?: number;
  commentIgnoreGroup?: boolean;
  dontAlertFollowers?: boolean;
  hideContacts?: boolean;
  allowAskHiddenContent?: boolean;
  scheduleDate?: string;
  scheduleTime?: string;
  watchThread?: boolean;
  watchThreadEmail?: boolean;
}

export type ForumCreateContestResult =
  | { ok: true; threadId: number | null }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumPrefixOption {
  prefixId: number;
  title: string;
  color: string | null;
}

export interface ForumPrefixGroup {
  groupTitle: string | null;
  prefixes: ForumPrefixOption[];
}

export interface ForumPrefixesInfo {
  groups: ForumPrefixGroup[];
  defaultPrefixId: number | null;
  required: boolean;
}

export type ForumPrefixesResult =
  | { ok: true; info: ForumPrefixesInfo }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumPrefixCssResult =
  | { ok: true; css: string }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export type ForumActionResult =
  { ok: true } | { ok: false; reason: ProfileFetchReason; message?: string };

export interface ForumFeedForum {
  forumId: number;
  title: string;
}

export interface ForumFeedOptions {
  forums: ForumFeedForum[];
  excludedForumIds: number[];
  keywords: string[];
}

export type ForumFeedOptionsResult =
  | { ok: true; options: ForumFeedOptions }
  | { ok: false; reason: ProfileFetchReason; message?: string };

export interface GifItem {
  id: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
}

export type GifSearchResult =
  | { ok: true; items: GifItem[]; next: string | null }
  | { ok: false; message: string };

export interface Plugin {
  id: string;
  name: string;
  author: string;
  authorUrl: string;
  description: string;
  code: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PluginInput {
  name: string;
  author: string;
  authorUrl: string;
  description: string;
  code: string;
}

export type PluginsListResult = { plugins: Plugin[] };
export type PluginSaveResult =
  { ok: true; plugin: Plugin } | { ok: false; message: string };
export type PluginSimpleResult = { ok: boolean };

export interface ProfilePostPermissions {
  edit: boolean;
  delete: boolean;
  like: boolean;
  comment: boolean;
  report: boolean;
  stick: boolean;
}

export interface ProfilePost {
  id: number;
  timelineUserId: number;
  posterUserId: number;
  posterUsername: string;
  posterUsernameHtml: string | null;
  posterUsernameColor: string | null;
  posterAvatarUrl: string | null;
  createDate: number;
  body: string;
  bodyHtml: string | null;
  likeCount: number;
  commentCount: number;
  commentsDisabled: boolean;
  isLiked: boolean;
  isSticked: boolean;
  url: string | null;
  permissions: ProfilePostPermissions;
}

export interface ProfilePostComment {
  id: number;
  profilePostId: number;
  userId: number;
  username: string;
  usernameHtml: string | null;
  usernameColor: string | null;
  avatarUrl: string | null;
  createDate: number;
  body: string;
  bodyHtml: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ProfileTrophy {
  id: number;
  title: string;
  description: string | null;
  iconUrl: string | null;
  awardDate: number | null;
  rarity: string | null;
  rarityPhrase: string | null;
}

export interface ProfilePostsResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  message?: string;
  posts?: ProfilePost[];
  total?: number;
  canPost?: boolean;
  hasMore?: boolean;
  page?: number;
}

export interface ProfilePostCommentsResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  message?: string;
  comments?: ProfilePostComment[];
  total?: number;
  hasMore?: boolean;
}

export interface ProfilePostMutationResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  message?: string;
  post?: ProfilePost;
}

export interface ProfilePostCommentMutationResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  message?: string;
  comment?: ProfilePostComment;
}

export interface ProfileTrophiesResult {
  ok: boolean;
  reason?: ProfileFetchReason;
  message?: string;
  trophies?: ProfileTrophy[];
}

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string; notes: string | null }
  | { state: "not-available" }
  | {
      state: "downloading";
      percent: number;
      transferred: number;
      total: number;
    }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export type StorageCategory = "images" | "stickers" | "animations" | "cache";

export interface StorageUsage {
  images: number;
  stickers: number;
  animations: number;
  cache: number;
  totalBytes: number;
}

export interface SteamInventoryCategory {
  key: string;
  label: string;
  value: number;
  itemCount?: number;
  appId?: number;
  items?: SteamInventoryItem[];
}

export interface SteamInventoryItem {
  name: string;
  iconUrl?: string;
  amount: number;
  marketable?: boolean;
  tradable?: boolean;
  marketHashName?: string;
}

export interface SteamTransaction {
  date?: string;
  type?: string;
  items?: string;
  total?: number;
  currency?: string;
  refunded?: boolean;
}

export interface SteamCs2Stats {
  wins?: number;
  premierElo?: number;
  rankCompetitive?: string;
  rankWingman?: string;
  privateRank?: number;
}

export interface SteamDota2Stats {
  mmr?: number;
  matches?: number;
  wins?: number;
  behaviorScore?: number;
  lowPriority?: boolean;
  rankingActivated?: boolean;
  lastMatchAt?: number | null;
}

export interface SteamRustStats {
  kills?: number;
  deaths?: number;
}

export interface SteamGameEntry {
  appId: number;
  name: string;
  playtimeMinutes?: number;
  iconUrl?: string;
}

export interface SteamCheckData {
  steamId: string;
  personaName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  country?: string;
  registeredAt?: number | null;
  lastLogoffAt?: number | null;
  profileLevel?: number;
  friendsCount?: number;
  points?: number;
  gamesCount?: number;
  currency?: string;
  balance?: number;
  balanceOnHold?: number;
  totalSpent?: number;
  gamesValue?: number;
  inGamePurchases?: number;
  giftsRefunds?: number;
  transactionsCount?: number;
  transactionsSum?: number;
  purchasesSum?: number;
  transactions?: SteamTransaction[];
  gifts?: number;
  playtimeTwoWeeksMinutes?: number;
  faceitLevel?: number;
  inventoryValueTotal?: number;
  inventoryItemsTotal?: number;
  inventoryCategories?: SteamInventoryCategory[];
  cs2?: SteamCs2Stats;
  dota2?: SteamDota2Stats;
  rust?: SteamRustStats;
  hasActivatedKeys?: boolean;
  limitedAccount?: boolean;
  marketRestricted?: boolean;
  tradeRestricted?: boolean;
  games?: SteamGameEntry[];
  recentGames?: SteamGameEntry[];
  registeredText?: string;
  lastOnlineText?: string;
  balanceText?: string;
  steamGuardEnabled?: boolean;
  isBanned?: boolean;
  vacBanned?: boolean;
  communityBanned?: boolean;
  numberOfVacBans?: number;
  numberOfGameBans?: number;
  economyBan?: string;
  privacyPublic?: boolean;
}

export type CheckerInputKind = "auto" | "credentials" | "steamId" | "maFile";

export interface CheckerSteamInput {
  raw: string;
  kind?: CheckerInputKind;
  proxyId?: string | null;
  maFile?: string;
  noTwoFactor?: boolean;
}

export type CheckerReason =
  | "no_proxy"
  | "not_implemented"
  | "invalid_input"
  | "unauthorized"
  | "rate_limited"
  | "network"
  | "bad_response"
  | "timeout";

export type CheckerSteamResult =
  | { ok: true; data: SteamCheckData; warnings?: string[] }
  | { ok: false; reason: CheckerReason; message: string };
