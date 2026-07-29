import {
  IPC,
  MARKET_CURRENCIES,
  type CurrencyResult,
  type ErrorReportPayload,
  type ErrorReportResult,
  type FollowOptions,
  type FollowersResult,
  type MarketCurrency,
  type ProfileActionResult,
  type PersonalInfoResult,
  type PersonalInfoUpdate,
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
  type SecretAnswerInfoResult,
  type SecretAnswerUpdate,
  type SecretResetResult,
  type ProfilePostsResult,
  type ProfilePostCommentsResult,
  type ProfilePostMutationResult,
  type ProfilePostCommentMutationResult,
  type ProfileTrophiesResult,
} from "@lzt/shared";
import { ipcMain } from "electron";
import { broadcastStatus } from "../auth/status";
import { setCurrency } from "../services/lzt-api";
import {
  getUserNote,
  setUserNote,
  listUserNotes,
  deleteUserNote,
} from "../services/local-data";
import {
  fetchFollowers,
  fetchMe,
  fetchMePersonal,
  fetchThreadLikes,
  fetchUser,
  fetchUserClaims,
  fetchUserThreads,
  followUser,
  ignoreUser,
  sendMessage,
  submitErrorReport,
  fetchConversationMessages,
  sendConversationMessage,
  unfollowUser,
  unignoreUser,
  updateMePersonal,
  validateAndFetchMe,
  fetchMeContact,
  updateMeContact,
  fetchMePreferences,
  updateMePreferences,
  fetchMePrivacy,
  updateMePrivacy,
  fetchIgnoredUsers,
  fetchNotifications,
  markNotificationsRead,
  fetchConversations,
  searchForumUsers,
  fetchSecretAnswerTypes,
  updateSecretAnswer,
  requestSecretReset,
  cancelSecretReset,
  fetchProfilePosts,
  createProfilePost,
  editProfilePost,
  deleteProfilePost,
  likeProfilePost,
  unlikeProfilePost,
  stickProfilePost,
  unstickProfilePost,
  fetchProfilePostComments,
  createProfilePostComment,
  editProfilePostComment,
  deleteProfilePostComment,
  fetchTrophies,
} from "../services/profile-api";
import {
  clearProfileToken,
  hasProfileToken,
  initProfileToken,
  setProfileToken,
} from "../services/profile-token";

const isCurrency = (v: unknown): v is MarketCurrency =>
  typeof v === "string" && (MARKET_CURRENCIES as readonly string[]).includes(v);

const readUserId = (payload: unknown): number | null => {
  const raw = (payload as { userId?: unknown } | undefined)?.userId;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};

const invalidId: ProfileActionResult = { ok: false, reason: "bad_query" };

export const registerProfileIpc = (): void => {
  ipcMain.handle(
    IPC.PROFILE_SET_CURRENCY,
    async (_e, payload?: { currency: unknown }): Promise<CurrencyResult> => {
      if (!isCurrency(payload?.currency))
        return { ok: false, message: "invalid_currency" };
      const result = await setCurrency(payload.currency);
      if (result.ok) void broadcastStatus();
      return result;
    },
  );


  void initProfileToken();

  ipcMain.handle(
    IPC.PROFILE_TOKEN_STATUS,
    async (): Promise<ProfileTokenStatus> => {
      await initProfileToken();
      if (!hasProfileToken()) return { hasToken: false, profile: null };
      const withProfile = await Promise.race([
        fetchMe(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      return {
        hasToken: true,
        profile: withProfile && withProfile.ok ? withProfile.profile : null,
      };
    },
  );

  ipcMain.handle(
    IPC.PROFILE_TOKEN_SET,
    async (_e, payload?: { token?: unknown }): Promise<ProfileFetchResult> => {
      const token =
        typeof payload?.token === "string" ? payload.token.trim() : "";
      if (!token) return { ok: false, reason: "bad_query" };
      const res = await validateAndFetchMe(token);
      if (res.ok) await setProfileToken(token);
      else await clearProfileToken();
      return res;
    },
  );

  ipcMain.handle(IPC.PROFILE_TOKEN_CLEAR, async (): Promise<void> => {
    await clearProfileToken();
  });

  ipcMain.handle(IPC.PROFILE_GET_ME, async (): Promise<ProfileFetchResult> =>
    fetchMe(),
  );

  ipcMain.handle(
    IPC.PROFILE_GET_USER,
    async (_e, payload?: { query?: unknown }): Promise<ProfileFetchResult> => {
      const query = typeof payload?.query === "string" ? payload.query : "";
      return fetchUser(query);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_PERSONAL,
    async (): Promise<PersonalInfoResult> => fetchMePersonal(),
  );

  ipcMain.handle(
    IPC.PROFILE_UPDATE_PERSONAL,
    async (
      _e,
      payload?: { update?: PersonalInfoUpdate },
    ): Promise<PersonalInfoResult> => {
      const update = payload?.update ?? {};
      const res = await updateMePersonal(update);
      if (res.ok) void broadcastStatus();
      return res;
    },
  );


  ipcMain.handle(
    IPC.PROFILE_GET_FOLLOWERS,
    async (
      _e,
      payload?: { userId?: unknown; limit?: unknown },
    ): Promise<FollowersResult> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false, reason: "bad_query" };
      const limit = typeof payload?.limit === "number" ? payload.limit : 30;
      return fetchFollowers(userId, limit);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_THREADS,
    async (
      _e,
      payload?: { userId?: unknown; limit?: unknown },
    ): Promise<UserThreadsResult> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false, reason: "bad_query" };
      const limit = typeof payload?.limit === "number" ? payload.limit : 3;
      return fetchUserThreads(userId, limit);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_THREAD,
    async (
      _e,
      payload?: { threadId?: unknown },
    ): Promise<{ ok: boolean; likeCount: number | null }> => {
      const threadId =
        typeof payload?.threadId === "number" ? payload.threadId : null;
      if (threadId === null) return { ok: false, likeCount: null };
      return fetchThreadLikes(threadId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_CLAIMS,
    async (_e, payload?: { userId?: unknown }): Promise<UserClaimsResult> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false, reason: "bad_query" };
      return fetchUserClaims(userId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_FOLLOW,
    async (
      _e,
      payload?: { userId?: unknown; options?: FollowOptions },
    ): Promise<ProfileActionResult> => {
      const userId = readUserId(payload);
      if (userId === null) return invalidId;
      return followUser(userId, payload?.options);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_UNFOLLOW,
    async (
      _e,
      payload?: { userId?: unknown },
    ): Promise<ProfileActionResult> => {
      const userId = readUserId(payload);
      if (userId === null) return invalidId;
      return unfollowUser(userId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_IGNORE,
    async (
      _e,
      payload?: { userId?: unknown },
    ): Promise<ProfileActionResult> => {
      const userId = readUserId(payload);
      if (userId === null) return invalidId;
      return ignoreUser(userId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_UNIGNORE,
    async (
      _e,
      payload?: { userId?: unknown },
    ): Promise<ProfileActionResult> => {
      const userId = readUserId(payload);
      if (userId === null) return invalidId;
      return unignoreUser(userId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_SEND_MESSAGE,
    async (
      _e,
      payload?: { userId?: unknown; message?: unknown },
    ): Promise<ProfileActionResult> => {
      const userId = readUserId(payload);
      if (userId === null) return invalidId;
      const message =
        typeof payload?.message === "string" ? payload.message : "";
      return sendMessage(userId, message);
    },
  );

  ipcMain.handle(
    IPC.ERROR_REPORT_SUBMIT,
    async (_e, payload?: Partial<ErrorReportPayload>): Promise<ErrorReportResult> => {
      const view = typeof payload?.view === "string" ? payload.view : "";
      const error = typeof payload?.error === "string" ? payload.error : "";
      const occurredAt =
        typeof payload?.occurredAt === "number" && Number.isFinite(payload.occurredAt)
          ? payload.occurredAt
          : Date.now();
      return submitErrorReport({ view, error, occurredAt });
    },
  );

  ipcMain.handle(
    IPC.PROFILE_NOTE_GET,
    async (_e, payload?: { userId?: unknown }): Promise<UserNote> => {
      const userId = readUserId(payload);
      if (userId === null) return { userId: 0, text: "", updatedAt: 0 };
      const text = await getUserNote(userId);
      return { userId, text, updatedAt: 0 };
    },
  );

  ipcMain.handle(
    IPC.PROFILE_NOTE_SET,
    async (
      _e,
      payload?: { userId?: unknown; text?: unknown },
    ): Promise<{ ok: boolean }> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false };
      const text = typeof payload?.text === "string" ? payload.text : "";
      await setUserNote(userId, text);
      return { ok: true };
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_CONTACT,
    async (): Promise<ContactInfoResult> => fetchMeContact(),
  );
  ipcMain.handle(
    IPC.PROFILE_UPDATE_CONTACT,
    async (
      _e,
      payload?: { update?: ContactInfoUpdate },
    ): Promise<ContactInfoResult> => updateMeContact(payload?.update ?? {}),
  );
  ipcMain.handle(
    IPC.PROFILE_GET_PREFERENCES,
    async (): Promise<PreferencesResult> => fetchMePreferences(),
  );
  ipcMain.handle(
    IPC.PROFILE_UPDATE_PREFERENCES,
    async (
      _e,
      payload?: { update?: ProfilePreferencesUpdate },
    ): Promise<PreferencesResult> => updateMePreferences(payload?.update ?? {}),
  );
  ipcMain.handle(IPC.PROFILE_GET_PRIVACY, async (): Promise<PrivacyResult> =>
    fetchMePrivacy(),
  );
  ipcMain.handle(
    IPC.PROFILE_UPDATE_PRIVACY,
    async (
      _e,
      payload?: { update?: PrivacySettingsUpdate },
    ): Promise<PrivacyResult> => updateMePrivacy(payload?.update ?? {}),
  );

  ipcMain.handle(IPC.PROFILE_NOTES_LIST, async (): Promise<UserNotesResult> => {
    const notes = await listUserNotes();
    return { notes };
  });
  ipcMain.handle(
    IPC.PROFILE_NOTE_DELETE,
    async (_e, payload?: { userId?: unknown }): Promise<{ ok: boolean }> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false };
      await deleteUserNote(userId);
      return { ok: true };
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_IGNORED,
    async (): Promise<IgnoredUsersResult> => fetchIgnoredUsers(),
  );

  ipcMain.handle(
    IPC.PROFILE_GET_NOTIFICATIONS,
    async (): Promise<NotificationsResult> => fetchNotifications(),
  );
  ipcMain.handle(
    IPC.PROFILE_NOTIFICATIONS_READ,
    async (): Promise<ProfileActionResult> => markNotificationsRead(),
  );

  ipcMain.handle(
    IPC.PROFILE_GET_CONVERSATIONS,
    async (
      _e,
      payload?: { page?: unknown },
    ): Promise<ConversationsResult> => {
      const page =
        typeof payload?.page === "number" && payload.page > 0 ? payload.page : 1;
      return fetchConversations(page);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_CONVERSATION_MESSAGES,
    async (
      _e,
      payload?: { conversationId?: unknown; page?: unknown },
    ): Promise<ConversationMessagesResult> => {
      const conversationId =
        typeof payload?.conversationId === "number"
          ? payload.conversationId
          : Number(payload?.conversationId);
      const page =
        typeof payload?.page === "number" && payload.page > 0 ? payload.page : 1;
      if (!Number.isFinite(conversationId) || conversationId <= 0)
        return { ok: false, reason: "bad_query" };
      return fetchConversationMessages(conversationId, page);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_SEND_CONVERSATION_MESSAGE,
    async (
      _e,
      payload?: { conversationId?: unknown; message?: unknown },
    ): Promise<ProfileActionResult> => {
      const conversationId =
        typeof payload?.conversationId === "number"
          ? payload.conversationId
          : Number(payload?.conversationId);
      const message =
        typeof payload?.message === "string" ? payload.message : "";
      if (!Number.isFinite(conversationId) || conversationId <= 0)
        return { ok: false, reason: "bad_query" };
      return sendConversationMessage(conversationId, message);
    },
  );
  ipcMain.handle(
    IPC.PROFILE_SEARCH_USERS,
    async (
      _e,
      payload?: { query?: unknown },
    ): Promise<ForumSearchUsersResult> => {
      const query = typeof payload?.query === "string" ? payload.query : "";
      return searchForumUsers(query);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_SECRET_TYPES,
    async (): Promise<SecretAnswerInfoResult> => fetchSecretAnswerTypes(),
  );
  ipcMain.handle(
    IPC.PROFILE_SECRET_SET,
    async (
      _e,
      payload?: { update?: SecretAnswerUpdate },
    ): Promise<ProfileActionResult> => {
      const u = payload?.update;
      if (!u || typeof u.answer !== "string" || typeof u.typeId !== "number")
        return { ok: false, reason: "bad_query" };
      return updateSecretAnswer(u);
    },
  );
  ipcMain.handle(
    IPC.PROFILE_SECRET_RESET,
    async (): Promise<SecretResetResult> => requestSecretReset(),
  );
  ipcMain.handle(
    IPC.PROFILE_SECRET_RESET_CANCEL,
    async (): Promise<ProfileActionResult> => cancelSecretReset(),
  );


  ipcMain.handle(
    IPC.PROFILE_GET_POSTS,
    async (
      _e,
      payload?: { userId?: unknown; page?: unknown; limit?: unknown },
    ): Promise<ProfilePostsResult> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false, reason: "bad_query" };
      const page = typeof payload?.page === "number" ? payload.page : 1;
      const limit = typeof payload?.limit === "number" ? payload.limit : 20;
      return fetchProfilePosts(userId, page, limit);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_CREATE_POST,
    async (
      _e,
      payload?: { userId?: unknown; body?: unknown },
    ): Promise<ProfilePostMutationResult> => {
      const userId = readUserId(payload);
      const body = typeof payload?.body === "string" ? payload.body : "";
      if (userId === null || !body.trim())
        return { ok: false, reason: "bad_query" };
      return createProfilePost(userId, body);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_EDIT_POST,
    async (
      _e,
      payload?: { postId?: unknown; body?: unknown; disableComments?: unknown },
    ): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return editProfilePost(postId, {
        body: typeof payload?.body === "string" ? payload.body : undefined,
        disableComments:
          typeof payload?.disableComments === "boolean"
            ? payload.disableComments
            : undefined,
      });
    },
  );

  ipcMain.handle(
    IPC.PROFILE_DELETE_POST,
    async (_e, payload?: { postId?: unknown }): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return deleteProfilePost(postId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_LIKE_POST,
    async (_e, payload?: { postId?: unknown }): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return likeProfilePost(postId);
    },
  );
  ipcMain.handle(
    IPC.PROFILE_UNLIKE_POST,
    async (_e, payload?: { postId?: unknown }): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return unlikeProfilePost(postId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_STICK_POST,
    async (_e, payload?: { postId?: unknown }): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return stickProfilePost(postId);
    },
  );
  ipcMain.handle(
    IPC.PROFILE_UNSTICK_POST,
    async (_e, payload?: { postId?: unknown }): Promise<ProfileActionResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return invalidId;
      return unstickProfilePost(postId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_POST_COMMENTS,
    async (
      _e,
      payload?: { postId?: unknown; before?: unknown; limit?: unknown },
    ): Promise<ProfilePostCommentsResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      if (postId === null) return { ok: false, reason: "bad_query" };
      const before =
        typeof payload?.before === "number" ? payload.before : undefined;
      const limit = typeof payload?.limit === "number" ? payload.limit : 20;
      return fetchProfilePostComments(postId, before, limit);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_CREATE_POST_COMMENT,
    async (
      _e,
      payload?: { postId?: unknown; body?: unknown },
    ): Promise<ProfilePostCommentMutationResult> => {
      const postId =
        typeof payload?.postId === "number" ? payload.postId : null;
      const body = typeof payload?.body === "string" ? payload.body : "";
      if (postId === null || !body.trim())
        return { ok: false, reason: "bad_query" };
      return createProfilePostComment(postId, body);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_EDIT_POST_COMMENT,
    async (
      _e,
      payload?: { commentId?: unknown; body?: unknown },
    ): Promise<ProfileActionResult> => {
      const commentId =
        typeof payload?.commentId === "number" ? payload.commentId : null;
      const body = typeof payload?.body === "string" ? payload.body : "";
      if (commentId === null || !body.trim()) return invalidId;
      return editProfilePostComment(commentId, body);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_DELETE_POST_COMMENT,
    async (
      _e,
      payload?: { commentId?: unknown },
    ): Promise<ProfileActionResult> => {
      const commentId =
        typeof payload?.commentId === "number" ? payload.commentId : null;
      if (commentId === null) return invalidId;
      return deleteProfilePostComment(commentId);
    },
  );

  ipcMain.handle(
    IPC.PROFILE_GET_TROPHIES,
    async (_e, payload?: { userId?: unknown }): Promise<ProfileTrophiesResult> => {
      const userId = readUserId(payload);
      if (userId === null) return { ok: false, reason: "bad_query" };
      return fetchTrophies(userId);
    },
  );
};
