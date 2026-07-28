import {
  IPC,
  type AutoBumpState,
  type MarketAutoBumpGlobalPatch,
  type MarketAutoBumpState,
  type AutoBumpThread,
  type AutoRepriceGlobalPatch,
  type AutoRepriceState,
  type DiscordPresenceActivity,
  type DiscordRpcSettings,
  type DiscordRpcSnapshot,
  type StreamerSettings,
  type AuthStatus,
  type AuthTokenPayload,
  type CurrencyResult,
  type IpLookupResult,
  type MailResult,
  type FollowOptions,
  type FollowersResult,
  type MarketCurrency,
  type MarketCategoriesResult,
  type MarketCategoryGamesResult,
  type MarketCategoryParamsResult,
  type MarketItem,
  type MarketItemsResult,
  type MarketUserItemsResult,
  type MarketUserItemsQuery,
  type MarketAccountResult,
  type ItemNote,
  type ItemNotesResult,
  type MarketUserItemStatesResult,
  type MarketQuery,
  type MarketTransferInput,
  type MarketTransferResult,
  type MarketTransferFeeResult,
  type MarketCurrencyRatesResult,
  type MarketPaymentsQuery,
  type TelegramTestResult,
  type MarketPaymentsResult,
  type MarketTagsResult,
  type MarketTagInput,
  type MarketTagMutationResult,
  type MarketSimpleResult,
  type MarketCheckResult,
  type MarketTempEmailPasswordResult,
  type MarketMafileResult,
  type MarketDownloadQuery,
  type MarketDownloadResult,
  type MarketPublishInput,
  type MarketPublishResult,
  type MarketFastSellInput,
  type MarketFastSellResult,
  type MarketEditPriceInput,
  type MarketPriceEditResult,
  type MarketRateLimitState,
  type MarketProxyListResult,
  type MarketSellUploadInput,
  type MarketSellUploadResult,
  type MarketPurchasePreviewResult,
  type MarketFastBuyResult,
  type MarketCartResult,
  type MarketCartMutationResult,
  type AppReadFileResult,
  type CheckerSteamInput,
  type CheckerSteamResult,
  type ModeratorSettings,
  type PluginInput,
  type PluginsListResult,
  type PluginSaveResult,
  type PluginSimpleResult,
  type NetworkStatus,
  type PersonalInfoResult,
  type PersonalInfoUpdate,
  type ProfileActionResult,
  type ProfileFetchResult,
  type ProfileTokenStatus,
  type UserClaimsResult,
  type UserNote,
  type UserThreadsResult,
  type ContactInfoResult,
  type ContactInfoUpdate,
  type PreferencesResult,
  type ProfilePreferencesUpdate,
  type PrivacyResult,
  type PrivacySettingsUpdate,
  type UserNotesResult,
  type IgnoredUsersResult,
  type NotificationsResult,
  type ConversationsResult,
  type ConversationMessagesResult,
  type ForumSearchUsersResult,
  type ForumPrefixesResult,
  type SecretAnswerInfoResult,
  type SecretAnswerUpdate,
  type SecretResetResult,
  type ProfilePostsResult,
  type ProfilePostCommentsResult,
  type ProfilePostMutationResult,
  type ProfilePostCommentMutationResult,
  type ProfileTrophiesResult,
  type ProxyCheckInput,
  type ProxyCheckResult,
  type ProxyFetchResult,
  type ProxyTestInput,
  type ProxyTestResult,
  type SettingsSnapshot,
  type UpdateStatus,
  type StorageUsage,
  type StorageCategory,
  type DataUsage,
  type HistoryEntry,
  type HistoryKind,
  type HistoryMarkers,
  type HistoryObservePayload,
  type HistoryObserveResult,
  type HistoryPage,
  type HistoryQuery,
  type SiteCheckInput,
  type SiteCheckResult,
} from "@lzt/shared";
import type {
  ChatActionResult,
  ChatIgnoredResult,
  ChatLeaderboardDuration,
  ChatLeaderboardResult,
  ChatMessagesResult,
  ChatOnlineResult,
  ChatRoomsResult,
  ChatRulesResult,
  ChatSendResult,
} from "@lzt/shared";
import type {
  ForumActionResult,
  ForumCreatePostResult,
  ForumCreateContestInput,
  ForumCreateContestResult,
  ForumCreateThreadInput,
  ForumCreateThreadResult,
  ForumEditThreadInput,
  ForumModeratorLogResult,
  GifSearchResult,
  ForumPostBodyResult,
  ForumPostsResult,
  ForumPostCommentsResult,
  ForumThreadDetailsResult,
  ForumThreadsQuery,
  ForumThreadsResult,
  ForumSectionResult,
  ForumTreeResult,
  ForumFeedOptionsResult,
} from "@lzt/shared";
import type {
  AccountLoginMethod,
  AccountLoginResult,
  LoginProgressEvent,
} from "@lzt/shared";
import { contextBridge, ipcRenderer } from "electron";

type Unsubscribe = () => void;

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload);

const send = (channel: string, payload?: unknown): void =>
  ipcRenderer.send(channel, payload);

const on = <T>(channel: string, handler: (payload: T) => void): Unsubscribe => {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) =>
    handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
};

const api = {
  auth: {
    openBrowser: () => invoke<{ state: string }>(IPC.AUTH_OPEN_BROWSER),
    openInApp: () => invoke<void>(IPC.AUTH_OPEN_IN_APP),
    logout: () => invoke<void>(IPC.AUTH_LOGOUT),
    getStatus: () => invoke<AuthStatus>(IPC.AUTH_GET_STATUS),
    onTokenReceived: (h: (p: AuthTokenPayload) => void) =>
      on<AuthTokenPayload>(IPC.AUTH_TOKEN_RECEIVED, h),
    onStatusChanged: (h: (p: AuthStatus) => void) =>
      on<AuthStatus>(IPC.AUTH_STATUS_CHANGED, h),
  },
  window: {
    isMaximized: () => invoke<boolean>(IPC.WINDOW_IS_MAXIMIZED),
    minimize: () => invoke<void>(IPC.WINDOW_MINIMIZE),
    toggleMaximize: () => invoke<void>(IPC.WINDOW_TOGGLE_MAXIMIZE),
    close: () => invoke<void>(IPC.WINDOW_CLOSE),
    onMaximizeChange: (h: (maximized: boolean) => void) =>
      on<boolean>(IPC.WINDOW_MAXIMIZE_CHANGED, h),
  },
  app: {
    getVersion: () => invoke<string>(IPC.APP_GET_VERSION),
    pingApi: () => invoke<NetworkStatus>(IPC.APP_PING_API),
    openExternal: (url: string, opts?: { forceExternal?: boolean }) =>
      invoke<void>(IPC.APP_OPEN_EXTERNAL, {
        url,
        forceExternal: opts?.forceExternal,
      }),
    clearCache: () => invoke<{ ok: boolean }>(IPC.APP_CLEAR_CACHE),
    exportLog: () => invoke<{ ok: boolean; path?: string }>(IPC.APP_EXPORT_LOG),
    getForumWebUrl: () => invoke<string>(IPC.APP_GET_FORUM_WEB_URL),
    pickDirectory: (title?: string) =>
      invoke<string | null>(IPC.APP_PICK_DIRECTORY, { title }),
    pickFile: (opts?: { title?: string; extensions?: string[] }) =>
      invoke<string | null>(IPC.APP_PICK_FILE, {
        title: opts?.title,
        extensions: opts?.extensions,
      }),
    readFile: (path: string) =>
      invoke<AppReadFileResult>(IPC.APP_READ_FILE, { path }),
    onOpenLztLink: (h: (p: { url: string }) => void) =>
      on<{ url: string }>(IPC.APP_OPEN_LZT_LINK, h),
  },
  settings: {
    get: () => invoke<SettingsSnapshot>(IPC.SETTINGS_GET),
    set: (patch: Partial<ModeratorSettings>) =>
      invoke<SettingsSnapshot>(IPC.SETTINGS_SET, patch),
    reset: () => invoke<SettingsSnapshot>(IPC.SETTINGS_RESET),
    onChanged: (h: (p: SettingsSnapshot) => void) =>
      on<SettingsSnapshot>(IPC.SETTINGS_CHANGED, h),
  },
  autobump: {
    get: () => invoke<AutoBumpState>(IPC.AUTOBUMP_GET),
    setGlobal: (patch: {
      enabled?: boolean;
      tickSeconds?: number;
      jitterMin?: number;
    }) => invoke<AutoBumpState>(IPC.AUTOBUMP_SET_GLOBAL, patch),
    addThread: (ref: string) =>
      invoke<{ ok: boolean; state?: AutoBumpState; message?: string }>(
        IPC.AUTOBUMP_ADD_THREAD,
        { ref },
      ),
    updateThread: (threadId: number, patch: Partial<AutoBumpThread>) =>
      invoke<AutoBumpState>(IPC.AUTOBUMP_UPDATE_THREAD, { threadId, patch }),
    removeThread: (threadId: number) =>
      invoke<AutoBumpState>(IPC.AUTOBUMP_REMOVE_THREAD, { threadId }),
    bumpNow: (threadId: number) =>
      invoke<{ ok: boolean; state?: AutoBumpState; message?: string }>(
        IPC.AUTOBUMP_BUMP_NOW,
        { threadId },
      ),
    clearLog: () => invoke<AutoBumpState>(IPC.AUTOBUMP_CLEAR_LOG),
    onChanged: (h: (p: AutoBumpState) => void) =>
      on<AutoBumpState>(IPC.AUTOBUMP_CHANGED, h),
  },
  autoReprice: {
    get: () => invoke<AutoRepriceState>(IPC.AUTOREPRICE_GET),
    setGlobal: (patch: AutoRepriceGlobalPatch) =>
      invoke<AutoRepriceState>(IPC.AUTOREPRICE_SET_GLOBAL, patch),
    runNow: () =>
      invoke<{ ok: boolean; state?: AutoRepriceState; message?: string }>(
        IPC.AUTOREPRICE_RUN_NOW,
      ),
    clearLog: () => invoke<AutoRepriceState>(IPC.AUTOREPRICE_CLEAR_LOG),
    onChanged: (h: (p: AutoRepriceState) => void) =>
      on<AutoRepriceState>(IPC.AUTOREPRICE_CHANGED, h),
  },
  marketAutoBump: {
    get: () => invoke<MarketAutoBumpState>(IPC.MARKET_AUTOBUMP_GET),
    setGlobal: (patch: MarketAutoBumpGlobalPatch) =>
      invoke<MarketAutoBumpState>(IPC.MARKET_AUTOBUMP_SET_GLOBAL, patch),
    runNow: () =>
      invoke<{ ok: boolean; state?: MarketAutoBumpState; message?: string }>(
        IPC.MARKET_AUTOBUMP_RUN_NOW,
      ),
    resetCycle: () =>
      invoke<MarketAutoBumpState>(IPC.MARKET_AUTOBUMP_RESET_CYCLE),
    clearLog: () => invoke<MarketAutoBumpState>(IPC.MARKET_AUTOBUMP_CLEAR_LOG),
    refreshItems: () =>
      invoke<{ ok: boolean; state: MarketAutoBumpState; message?: string }>(
        IPC.MARKET_AUTOBUMP_REFRESH_ITEMS,
      ),
    bumpItem: (itemId: number) =>
      invoke<{ ok: boolean; state: MarketAutoBumpState; message?: string }>(
        IPC.MARKET_AUTOBUMP_BUMP_ITEM,
        itemId,
      ),
    onChanged: (h: (p: MarketAutoBumpState) => void) =>
      on<MarketAutoBumpState>(IPC.MARKET_AUTOBUMP_CHANGED, h),
  },
  discordRpc: {
    get: () => invoke<DiscordRpcSnapshot>(IPC.DISCORD_RPC_GET),
    set: (patch: Partial<DiscordRpcSettings>) =>
      invoke<DiscordRpcSnapshot>(IPC.DISCORD_RPC_SET, patch),
    reconnect: () => invoke<DiscordRpcSnapshot>(IPC.DISCORD_RPC_RECONNECT),
    setActivity: (activity: DiscordPresenceActivity) =>
      send(IPC.DISCORD_RPC_SET_ACTIVITY, activity),
    onChanged: (h: (p: DiscordRpcSnapshot) => void) =>
      on<DiscordRpcSnapshot>(IPC.DISCORD_RPC_CHANGED, h),
  },
  telegram: {
    test: () => invoke<TelegramTestResult>(IPC.TELEGRAM_TEST),
  },
  streamer: {
    get: () => invoke<StreamerSettings>(IPC.STREAMER_GET),
    set: (patch: Partial<StreamerSettings>) =>
      invoke<StreamerSettings>(IPC.STREAMER_SET, patch),
    reset: () => invoke<StreamerSettings>(IPC.STREAMER_RESET),
    exportJson: () => invoke<string>(IPC.STREAMER_EXPORT),
    importJson: (raw: string) =>
      invoke<StreamerSettings>(IPC.STREAMER_IMPORT, raw),
    onChanged: (h: (p: StreamerSettings) => void) =>
      on<StreamerSettings>(IPC.STREAMER_CHANGED, h),
  },
  history: {
    query: (q: HistoryQuery) => invoke<HistoryPage>(IPC.HISTORY_QUERY, q),
    getEntry: (id: string) =>
      invoke<HistoryEntry | null>(IPC.HISTORY_GET_ENTRY, { id }),
    observe: (payload: HistoryObservePayload) =>
      invoke<HistoryObserveResult>(IPC.HISTORY_OBSERVE, payload),
    deleteEntry: (id: string) =>
      invoke<void>(IPC.HISTORY_DELETE_ENTRY, { id }),
    clear: (kinds?: HistoryKind[]) =>
      invoke<void>(IPC.HISTORY_CLEAR, { kinds }),
    markers: () => invoke<HistoryMarkers>(IPC.HISTORY_MARKERS),
    cacheMedia: (url: string, webpBase64: string) =>
      invoke<{ id: string }>(IPC.HISTORY_CACHE_MEDIA, { url, webpBase64 }),
    getMedia: (id: string) =>
      invoke<{ dataUrl: string } | null>(IPC.HISTORY_GET_MEDIA, { id }),
    usage: () => invoke<DataUsage>(IPC.HISTORY_GET_USAGE),
    purge: () => invoke<number>(IPC.HISTORY_PURGE),
    onChanged: (h: (p: HistoryMarkers) => void) =>
      on<HistoryMarkers>(IPC.HISTORY_CHANGED, h),
  },
  update: {
    check: () => invoke<void>(IPC.UPDATE_CHECK),
    download: () => invoke<void>(IPC.UPDATE_DOWNLOAD),
    install: () => invoke<void>(IPC.UPDATE_INSTALL),
    onStatus: (h: (p: UpdateStatus) => void) =>
      on<UpdateStatus>(IPC.UPDATE_STATUS, h),
  },
  storage: {
    getUsage: () => invoke<StorageUsage>(IPC.STORAGE_GET_USAGE),
    clear: (category: StorageCategory | "all") =>
      invoke<StorageUsage>(IPC.STORAGE_CLEAR, { category }),
  },
  profile: {
    setCurrency: (currency: MarketCurrency) =>
      invoke<CurrencyResult>(IPC.PROFILE_SET_CURRENCY, { currency }),
    getTokenStatus: () => invoke<ProfileTokenStatus>(IPC.PROFILE_TOKEN_STATUS),
    setToken: (token: string) =>
      invoke<ProfileFetchResult>(IPC.PROFILE_TOKEN_SET, { token }),
    clearToken: () => invoke<void>(IPC.PROFILE_TOKEN_CLEAR),
    getMe: () => invoke<ProfileFetchResult>(IPC.PROFILE_GET_ME),
    getPersonal: () => invoke<PersonalInfoResult>(IPC.PROFILE_GET_PERSONAL),
    updatePersonal: (update: PersonalInfoUpdate) =>
      invoke<PersonalInfoResult>(IPC.PROFILE_UPDATE_PERSONAL, { update }),
    getUser: (query: string) =>
      invoke<ProfileFetchResult>(IPC.PROFILE_GET_USER, { query }),
    getFollowers: (userId: number, limit?: number) =>
      invoke<FollowersResult>(IPC.PROFILE_GET_FOLLOWERS, { userId, limit }),
    getThreads: (userId: number, limit?: number) =>
      invoke<UserThreadsResult>(IPC.PROFILE_GET_THREADS, { userId, limit }),
    getThreadLikes: (threadId: number) =>
      invoke<{ ok: boolean; likeCount: number | null }>(
        IPC.PROFILE_GET_THREAD,
        { threadId },
      ),
    getClaims: (userId: number) =>
      invoke<UserClaimsResult>(IPC.PROFILE_GET_CLAIMS, { userId }),
    follow: (userId: number, options?: FollowOptions) =>
      invoke<ProfileActionResult>(IPC.PROFILE_FOLLOW, { userId, options }),
    unfollow: (userId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_UNFOLLOW, { userId }),
    ignore: (userId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_IGNORE, { userId }),
    unignore: (userId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_UNIGNORE, { userId }),
    sendMessage: (userId: number, message: string) =>
      invoke<ProfileActionResult>(IPC.PROFILE_SEND_MESSAGE, {
        userId,
        message,
      }),
    getNote: (userId: number) =>
      invoke<UserNote>(IPC.PROFILE_NOTE_GET, { userId }),
    setNote: (userId: number, text: string) =>
      invoke<{ ok: boolean }>(IPC.PROFILE_NOTE_SET, { userId, text }),
    getContact: () => invoke<ContactInfoResult>(IPC.PROFILE_GET_CONTACT),
    updateContact: (update: ContactInfoUpdate) =>
      invoke<ContactInfoResult>(IPC.PROFILE_UPDATE_CONTACT, { update }),
    getPreferences: () =>
      invoke<PreferencesResult>(IPC.PROFILE_GET_PREFERENCES),
    updatePreferences: (update: ProfilePreferencesUpdate) =>
      invoke<PreferencesResult>(IPC.PROFILE_UPDATE_PREFERENCES, { update }),
    getPrivacy: () => invoke<PrivacyResult>(IPC.PROFILE_GET_PRIVACY),
    updatePrivacy: (update: PrivacySettingsUpdate) =>
      invoke<PrivacyResult>(IPC.PROFILE_UPDATE_PRIVACY, { update }),
    listNotes: () => invoke<UserNotesResult>(IPC.PROFILE_NOTES_LIST),
    deleteNote: (userId: number) =>
      invoke<{ ok: boolean }>(IPC.PROFILE_NOTE_DELETE, { userId }),
    getIgnored: () => invoke<IgnoredUsersResult>(IPC.PROFILE_GET_IGNORED),
    getNotifications: () =>
      invoke<NotificationsResult>(IPC.PROFILE_GET_NOTIFICATIONS),
    markNotificationsRead: () =>
      invoke<ProfileActionResult>(IPC.PROFILE_NOTIFICATIONS_READ),
    getConversations: (page?: number) =>
      invoke<ConversationsResult>(IPC.PROFILE_GET_CONVERSATIONS, { page }),
    getConversationMessages: (conversationId: number, page?: number) =>
      invoke<ConversationMessagesResult>(
        IPC.PROFILE_GET_CONVERSATION_MESSAGES,
        { conversationId, page },
      ),
    sendConversationMessage: (conversationId: number, message: string) =>
      invoke<ProfileActionResult>(IPC.PROFILE_SEND_CONVERSATION_MESSAGE, {
        conversationId,
        message,
      }),
    searchUsers: (query: string) =>
      invoke<ForumSearchUsersResult>(IPC.PROFILE_SEARCH_USERS, { query }),
    getPosts: (userId: number, page?: number, limit?: number) =>
      invoke<ProfilePostsResult>(IPC.PROFILE_GET_POSTS, { userId, page, limit }),
    createPost: (userId: number, body: string) =>
      invoke<ProfilePostMutationResult>(IPC.PROFILE_CREATE_POST, {
        userId,
        body,
      }),
    editPost: (
      postId: number,
      update: { body?: string; disableComments?: boolean },
    ) =>
      invoke<ProfileActionResult>(IPC.PROFILE_EDIT_POST, {
        postId,
        body: update.body,
        disableComments: update.disableComments,
      }),
    deletePost: (postId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_DELETE_POST, { postId }),
    likePost: (postId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_LIKE_POST, { postId }),
    unlikePost: (postId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_UNLIKE_POST, { postId }),
    stickPost: (postId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_STICK_POST, { postId }),
    unstickPost: (postId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_UNSTICK_POST, { postId }),
    getPostComments: (postId: number, before?: number, limit?: number) =>
      invoke<ProfilePostCommentsResult>(IPC.PROFILE_GET_POST_COMMENTS, {
        postId,
        before,
        limit,
      }),
    createPostComment: (postId: number, body: string) =>
      invoke<ProfilePostCommentMutationResult>(
        IPC.PROFILE_CREATE_POST_COMMENT,
        { postId, body },
      ),
    editPostComment: (commentId: number, body: string) =>
      invoke<ProfileActionResult>(IPC.PROFILE_EDIT_POST_COMMENT, {
        commentId,
        body,
      }),
    deletePostComment: (commentId: number) =>
      invoke<ProfileActionResult>(IPC.PROFILE_DELETE_POST_COMMENT, {
        commentId,
      }),
    getTrophies: (userId: number) =>
      invoke<ProfileTrophiesResult>(IPC.PROFILE_GET_TROPHIES, { userId }),
    getSecretTypes: () =>
      invoke<SecretAnswerInfoResult>(IPC.PROFILE_SECRET_TYPES),
    setSecret: (update: SecretAnswerUpdate) =>
      invoke<ProfileActionResult>(IPC.PROFILE_SECRET_SET, { update }),
    requestSecretReset: () =>
      invoke<SecretResetResult>(IPC.PROFILE_SECRET_RESET),
    cancelSecretReset: () =>
      invoke<ProfileActionResult>(IPC.PROFILE_SECRET_RESET_CANCEL),
  },
  mail: {
    getLetters: (
      email: string,
      password: string,
      provider?: string,
      limit = 30,
    ) =>
      invoke<MailResult>(IPC.MAIL_GET_LETTERS, {
        email,
        password,
        provider,
        limit,
      }),
  },
  chat: {
    getRooms: () => invoke<ChatRoomsResult>(IPC.CHAT_GET_ROOMS),
    getMessages: (roomId: number, beforeMessageId?: number) =>
      invoke<ChatMessagesResult>(IPC.CHAT_GET_MESSAGES, {
        roomId,
        beforeMessageId,
      }),
    sendMessage: (roomId: number, message: string, replyMessageId?: number) =>
      invoke<ChatSendResult>(IPC.CHAT_SEND_MESSAGE, {
        roomId,
        message,
        replyMessageId,
      }),
    editMessage: (messageId: number, message: string) =>
      invoke<ChatSendResult>(IPC.CHAT_EDIT_MESSAGE, { messageId, message }),
    deleteMessage: (messageId: number) =>
      invoke<ChatActionResult>(IPC.CHAT_DELETE_MESSAGE, { messageId }),
    getOnline: (roomId: number) =>
      invoke<ChatOnlineResult>(IPC.CHAT_GET_ONLINE, { roomId }),
    getLeaderboard: (duration: ChatLeaderboardDuration) =>
      invoke<ChatLeaderboardResult>(IPC.CHAT_GET_LEADERBOARD, { duration }),
    getIgnored: () => invoke<ChatIgnoredResult>(IPC.CHAT_GET_IGNORED),
    ignore: (userId: number) =>
      invoke<ChatActionResult>(IPC.CHAT_IGNORE, { userId }),
    unignore: (userId: number) =>
      invoke<ChatActionResult>(IPC.CHAT_UNIGNORE, { userId }),
    getRules: () => invoke<ChatRulesResult>(IPC.CHAT_GET_RULES),
    openWindow: () => invoke<void>(IPC.CHAT_OPEN_WINDOW),
  },
  forum: {
    getTree: () => invoke<ForumTreeResult>(IPC.FORUM_GET_TREE, {}),
    getThreads: (query: ForumThreadsQuery) =>
      invoke<ForumThreadsResult>(IPC.FORUM_GET_THREADS, { query }),
    getThread: (threadId: number) =>
      invoke<ForumThreadDetailsResult>(IPC.FORUM_GET_THREAD, { threadId }),
    getPosts: (threadId: number, page: number, order?: string) =>
      invoke<ForumPostsResult>(IPC.FORUM_GET_POSTS, { threadId, page, order }),
    createPost: (threadId: number, message: string) =>
      invoke<ForumCreatePostResult>(IPC.FORUM_CREATE_POST, {
        threadId,
        message,
      }),
    createThread: (input: ForumCreateThreadInput) =>
      invoke<ForumCreateThreadResult>(IPC.FORUM_CREATE_THREAD, { input }),
    createContest: (input: ForumCreateContestInput) =>
      invoke<ForumCreateContestResult>(IPC.FORUM_CREATE_CONTEST, { input }),
    getPrefixes: (forumId: number) =>
      invoke<ForumPrefixesResult>(IPC.FORUM_GET_PREFIXES, { forumId }),
    getPrefixCss: () =>
      invoke<import("@lzt/shared").ForumPrefixCssResult>(
        IPC.FORUM_GET_PREFIX_CSS,
        {},
      ),
    getSection: (forumId: number) =>
      invoke<ForumSectionResult>(IPC.FORUM_GET_SECTION, { forumId }),
    follow: (forumId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_FOLLOW, { forumId }),
    unfollow: (forumId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_UNFOLLOW, { forumId }),
    bookmark: (threadId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_BOOKMARK, { threadId }),
    unbookmark: (threadId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_UNBOOKMARK, { threadId }),
    likePost: (postId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_LIKE_POST, { postId }),
    unlikePost: (postId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_UNLIKE_POST, { postId }),
    hideThread: (threadId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_HIDE_THREAD, { threadId }),
    watchThread: (threadId: number, email?: boolean) =>
      invoke<ForumActionResult>(IPC.FORUM_WATCH_THREAD, { threadId, email }),
    unwatchThread: (threadId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_UNWATCH_THREAD, { threadId }),
    editThread: (input: ForumEditThreadInput) =>
      invoke<ForumActionResult>(IPC.FORUM_EDIT_THREAD, { input }),
    deleteThread: (threadId: number, reason?: string) =>
      invoke<ForumActionResult>(IPC.FORUM_DELETE_THREAD, { threadId, reason }),
    bumpThread: (threadId: number) =>
      invoke<ForumActionResult>(IPC.FORUM_BUMP_THREAD, { threadId }),
    getModeratorLog: (threadId: number) =>
      invoke<ForumModeratorLogResult>(IPC.FORUM_GET_MODERATOR_LOG, {
        threadId,
      }),
    getPostBody: (postId: number) =>
      invoke<ForumPostBodyResult>(IPC.FORUM_GET_POST_BODY, { postId }),
    editPost: (postId: number, body: string) =>
      invoke<ForumActionResult>(IPC.FORUM_EDIT_POST, { postId, body }),
    searchGif: (query: string, pos?: string) =>
      invoke<GifSearchResult>(IPC.FORUM_SEARCH_GIF, { query, pos }),
    getComments: (postId: number) =>
      invoke<ForumPostCommentsResult>(IPC.FORUM_GET_COMMENTS, { postId }),
    commentPost: (postId: number, body: string) =>
      invoke<ForumActionResult>(IPC.FORUM_COMMENT_POST, { postId, body }),
    getFeedOptions: () =>
      invoke<ForumFeedOptionsResult>(IPC.FORUM_GET_FEED_OPTIONS, {}),
    setFeedOptions: (nodeIds: number[], keywords: string[]) =>
      invoke<ForumActionResult>(IPC.FORUM_SET_FEED_OPTIONS, {
        nodeIds,
        keywords,
      }),
  },
  proxy: {
    test: (input: ProxyTestInput) =>
      invoke<ProxyTestResult>(IPC.PROXY_TEST, input),
    fetchMarket: () => invoke<ProxyFetchResult>(IPC.PROXY_FETCH_MARKET),
    check: (input: ProxyCheckInput) =>
      invoke<ProxyCheckResult>(IPC.PROXY_CHECK, input),
    checkSite: (input: SiteCheckInput) =>
      invoke<SiteCheckResult>(IPC.PROXY_CHECK_SITE, input),
    lookupIp: (ip: string) => invoke<IpLookupResult>(IPC.IP_LOOKUP, { ip }),
  },
  market: {
    getItems: (query: MarketQuery) =>
      invoke<MarketItemsResult>(IPC.MARKET_GET_ITEMS, { query }),
    getCategories: () =>
      invoke<MarketCategoriesResult>(IPC.MARKET_GET_CATEGORIES),
    getCategoryParams: (slug: string) =>
      invoke<MarketCategoryParamsResult>(IPC.MARKET_GET_CATEGORY_PARAMS, {
        slug,
      }),
    getCategoryGames: (slug: string) =>
      invoke<MarketCategoryGamesResult>(IPC.MARKET_GET_CATEGORY_GAMES, {
        slug,
      }),
    getUserItems: (
      userId: number,
      page?: number,
      query?: MarketUserItemsQuery,
    ) =>
      invoke<MarketUserItemsResult>(IPC.MARKET_GET_USER_ITEMS, {
        userId,
        page,
        query,
      }),
    getAccount: (itemId: number) =>
      invoke<MarketAccountResult>(IPC.MARKET_GET_ACCOUNT, { itemId }),
    checkAccount: (itemId: number) =>
      invoke<MarketCheckResult>(IPC.MARKET_CHECK_ACCOUNT, { itemId }),
    getUserItemStates: (userId: number) =>
      invoke<MarketUserItemStatesResult>(IPC.MARKET_GET_USER_ITEM_STATES, {
        userId,
      }),
    transfer: (input: MarketTransferInput) =>
      invoke<MarketTransferResult>(IPC.MARKET_TRANSFER, { input }),
    getTransferFee: (amount: number) =>
      invoke<MarketTransferFeeResult>(IPC.MARKET_TRANSFER_FEE, { amount }),
    getCurrencyRates: () =>
      invoke<MarketCurrencyRatesResult>(IPC.MARKET_GET_CURRENCY),
    getUserOrders: (page?: number, query?: MarketUserItemsQuery) =>
      invoke<MarketItemsResult>(IPC.MARKET_GET_ORDERS, { page, query }),
    getFavourites: (page?: number, query?: MarketUserItemsQuery) =>
      invoke<MarketItemsResult>(IPC.MARKET_GET_FAVOURITES, { page, query }),
    getPayments: (query?: MarketPaymentsQuery) =>
      invoke<MarketPaymentsResult>(IPC.MARKET_GET_PAYMENTS, { query }),
    getTags: () => invoke<MarketTagsResult>(IPC.MARKET_GET_TAGS),
    createTag: (input: MarketTagInput) =>
      invoke<MarketTagMutationResult>(IPC.MARKET_CREATE_TAG, { input }),
    updateTag: (tagId: number, input: MarketTagInput) =>
      invoke<MarketTagMutationResult>(IPC.MARKET_UPDATE_TAG, { tagId, input }),
    deleteTag: (tagId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_DELETE_TAG, { tagId }),
    reorderTags: (tagOrder: number[]) =>
      invoke<MarketSimpleResult>(IPC.MARKET_REORDER_TAGS, { tagOrder }),
    addItemTag: (itemId: number, tagId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_ADD_ITEM_TAG, { itemId, tagId }),
    removeItemTag: (itemId: number, tagId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_REMOVE_ITEM_TAG, { itemId, tagId }),
    addPublicTag: (itemId: number, tagId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_ADD_PUBLIC_TAG, { itemId, tagId }),
    removePublicTag: (itemId: number, tagId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_REMOVE_PUBLIC_TAG, {
        itemId,
        tagId,
      }),
    starItem: (itemId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_STAR, { itemId }),
    unstarItem: (itemId: number) =>
      invoke<MarketSimpleResult>(IPC.MARKET_UNSTAR, { itemId }),
    getTempEmailPassword: (itemId: number) =>
      invoke<MarketTempEmailPasswordResult>(
        IPC.MARKET_GET_TEMP_EMAIL_PASSWORD,
        { itemId },
      ),
    getMafile: (itemId: number) =>
      invoke<MarketMafileResult>(IPC.MARKET_GET_MAFILE, { itemId }),
    downloadAccounts: (query: MarketDownloadQuery) =>
      invoke<MarketDownloadResult>(IPC.MARKET_DOWNLOAD, { query }),
    getItemNote: (itemId: number) =>
      invoke<ItemNote>(IPC.MARKET_ITEM_NOTE_GET, { itemId }),
    setItemNote: (itemId: number, text: string) =>
      invoke<{ ok: boolean }>(IPC.MARKET_ITEM_NOTE_SET, { itemId, text }),
    listItemNotes: () => invoke<ItemNotesResult>(IPC.MARKET_ITEM_NOTES_LIST),
    deleteItemNote: (itemId: number) =>
      invoke<{ ok: boolean }>(IPC.MARKET_ITEM_NOTE_DELETE, { itemId }),
    getCachedAccounts: (key: string) =>
      invoke<{ items: MarketItem[]; total: number } | null>(
        IPC.MARKET_ACCOUNTS_CACHE_GET,
        { key },
      ),
    setCachedAccounts: (key: string, items: MarketItem[], total: number) =>
      invoke<{ ok: boolean }>(IPC.MARKET_ACCOUNTS_CACHE_SET, {
        key,
        items,
        total,
      }),
    clearCachedAccounts: () =>
      invoke<{ ok: boolean }>(IPC.MARKET_ACCOUNTS_CACHE_CLEAR),
    publishItem: (input: MarketPublishInput) =>
      invoke<MarketPublishResult>(IPC.MARKET_PUBLISH_ITEM, { input }),
    fastSell: (itemId: number, input: MarketFastSellInput) =>
      invoke<MarketFastSellResult>(IPC.MARKET_FAST_SELL, { itemId, input }),
    editPrice: (input: MarketEditPriceInput) =>
      invoke<MarketPriceEditResult>(IPC.MARKET_EDIT_PRICE, { input }),
    getRateLimitState: () =>
      invoke<MarketRateLimitState>(IPC.MARKET_RATE_LIMIT_STATE),
    getProxies: () => invoke<MarketProxyListResult>(IPC.MARKET_GET_PROXIES),
    sellUpload: (input: MarketSellUploadInput) =>
      invoke<MarketSellUploadResult>(IPC.MARKET_SELL_UPLOAD, { input }),
    getPurchasePreview: (itemId: number) =>
      invoke<MarketPurchasePreviewResult>(IPC.MARKET_PURCHASE_PREVIEW, { itemId }),
    fastBuy: (itemId: number, price: number, balanceId?: number) =>
      invoke<MarketFastBuyResult>(IPC.MARKET_FAST_BUY, {
        itemId,
        price,
        balanceId,
      }),
    getCart: (page?: number) =>
      invoke<MarketCartResult>(IPC.MARKET_CART_LIST, { page }),
    addToCart: (itemId: number) =>
      invoke<MarketCartMutationResult>(IPC.MARKET_CART_ADD, { itemId }),
    removeFromCart: (itemId: number) =>
      invoke<MarketCartMutationResult>(IPC.MARKET_CART_REMOVE, { itemId }),
    clearCart: () => invoke<MarketCartMutationResult>(IPC.MARKET_CART_CLEAR),
  },
  checker: {
    steam: (input: CheckerSteamInput) =>
      invoke<CheckerSteamResult>(IPC.CHECKER_STEAM, { input }),
  },
  account: {
    login: (itemId: number, method: AccountLoginMethod = "native") =>
      invoke<AccountLoginResult>(IPC.ACCOUNT_LOGIN, { itemId, method }),
    cancelLogin: (itemId: number) =>
      invoke<void>(IPC.ACCOUNT_LOGIN_CANCEL, { itemId }),
    onLoginProgress: (handler: (event: LoginProgressEvent) => void) =>
      on<LoginProgressEvent>(IPC.ACCOUNT_LOGIN_PROGRESS, handler),
  },
  plugins: {
    list: () => invoke<PluginsListResult>(IPC.PLUGINS_LIST),
    save: (input: PluginInput, id?: string) =>
      invoke<PluginSaveResult>(IPC.PLUGINS_SAVE, { input, id }),
    remove: (id: string) =>
      invoke<PluginSimpleResult>(IPC.PLUGINS_DELETE, { id }),
    toggle: (id: string, enabled: boolean) =>
      invoke<PluginSimpleResult>(IPC.PLUGINS_TOGGLE, { id, enabled }),
  },
} as const;

export type ModeratorApi = typeof api;

contextBridge.exposeInMainWorld("moderator", api);
