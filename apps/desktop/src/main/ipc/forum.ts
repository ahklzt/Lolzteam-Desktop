
import { ipcMain } from "electron";
import { IPC } from "@lzt/shared";
import type {
  ForumCreateContestInput,
  ForumCreateThreadInput,
  ForumEditThreadInput,
  ForumThreadsQuery,
} from "@lzt/shared";
import {
  bookmarkThread,
  bumpThread,
  commentPost,
  createForumPost,
  createForumContest,
  createForumThread,
  deleteThread,
  editPost,
  editThread,
  fetchForumPrefixes,
  fetchThreadPrefixCss,
  fetchForumSection,
  fetchPostBody,
  fetchThreadModeratorLog,
  followForum,
  unfollowForum,
  fetchFeedOptions,
  fetchForumPosts,
  fetchForumThread,
  fetchForumThreads,
  fetchForumsTree,
  fetchPostComments,
  hideThread,
  likePost,
  unbookmarkThread,
  unlikePost,
  unwatchThread,
  updateFeedOptions,
  watchThread,
} from "../services/forum-api";
import { searchTenorGif } from "../services/media-api";

export const registerForumIpc = (): void => {
  ipcMain.handle(IPC.FORUM_GET_TREE, () => fetchForumsTree());

  ipcMain.handle(IPC.FORUM_GET_PREFIX_CSS, () => fetchThreadPrefixCss());

  ipcMain.handle(
    IPC.FORUM_GET_THREADS,
    (_event, payload: { query: ForumThreadsQuery }) =>
      fetchForumThreads(payload.query),
  );

  ipcMain.handle(
    IPC.FORUM_GET_THREAD,
    (_event, payload: { threadId: number }) =>
      fetchForumThread(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_GET_POSTS,
    (_event, payload: { threadId: number; page: number; order?: string }) =>
      fetchForumPosts(payload.threadId, payload.page, payload.order),
  );

  ipcMain.handle(
    IPC.FORUM_CREATE_POST,
    (_event, payload: { threadId: number; message: string }) =>
      createForumPost(payload.threadId, payload.message),
  );

  ipcMain.handle(
    IPC.FORUM_CREATE_THREAD,
    (_event, payload: { input: ForumCreateThreadInput }) =>
      createForumThread(payload.input),
  );

  ipcMain.handle(
    IPC.FORUM_CREATE_CONTEST,
    (_event, payload: { input: ForumCreateContestInput }) =>
      createForumContest(payload.input),
  );

  ipcMain.handle(
    IPC.FORUM_GET_PREFIXES,
    (_event, payload: { forumId: number }) =>
      fetchForumPrefixes(payload.forumId),
  );

  ipcMain.handle(
    IPC.FORUM_GET_SECTION,
    (_event, payload: { forumId: number }) =>
      fetchForumSection(payload.forumId),
  );

  ipcMain.handle(IPC.FORUM_FOLLOW, (_event, payload: { forumId: number }) =>
    followForum(payload.forumId),
  );

  ipcMain.handle(IPC.FORUM_UNFOLLOW, (_event, payload: { forumId: number }) =>
    unfollowForum(payload.forumId),
  );

  ipcMain.handle(IPC.FORUM_BOOKMARK, (_event, payload: { threadId: number }) =>
    bookmarkThread(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_UNBOOKMARK,
    (_event, payload: { threadId: number }) =>
      unbookmarkThread(payload.threadId),
  );

  ipcMain.handle(IPC.FORUM_LIKE_POST, (_event, payload: { postId: number }) =>
    likePost(payload.postId),
  );

  ipcMain.handle(IPC.FORUM_UNLIKE_POST, (_event, payload: { postId: number }) =>
    unlikePost(payload.postId),
  );

  ipcMain.handle(
    IPC.FORUM_HIDE_THREAD,
    (_event, payload: { threadId: number }) => hideThread(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_GET_COMMENTS,
    (_event, payload: { postId: number }) => fetchPostComments(payload.postId),
  );

  ipcMain.handle(
    IPC.FORUM_COMMENT_POST,
    (_event, payload: { postId: number; body: string }) =>
      commentPost(payload.postId, payload.body),
  );

  ipcMain.handle(
    IPC.FORUM_WATCH_THREAD,
    (_event, payload: { threadId: number; email?: boolean }) =>
      watchThread(payload.threadId, payload.email),
  );

  ipcMain.handle(
    IPC.FORUM_UNWATCH_THREAD,
    (_event, payload: { threadId: number }) =>
      unwatchThread(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_EDIT_THREAD,
    (_event, payload: { input: ForumEditThreadInput }) =>
      editThread(payload.input),
  );

  ipcMain.handle(
    IPC.FORUM_DELETE_THREAD,
    (_event, payload: { threadId: number; reason?: string }) =>
      deleteThread(payload.threadId, payload.reason),
  );

  ipcMain.handle(
    IPC.FORUM_BUMP_THREAD,
    (_event, payload: { threadId: number }) => bumpThread(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_GET_MODERATOR_LOG,
    (_event, payload: { threadId: number }) =>
      fetchThreadModeratorLog(payload.threadId),
  );

  ipcMain.handle(
    IPC.FORUM_GET_POST_BODY,
    (_event, payload: { postId: number }) => fetchPostBody(payload.postId),
  );

  ipcMain.handle(
    IPC.FORUM_EDIT_POST,
    (_event, payload: { postId: number; body: string }) =>
      editPost(payload.postId, payload.body),
  );

  ipcMain.handle(
    IPC.FORUM_SEARCH_GIF,
    (_event, payload: { query: string; pos?: string }) =>
      searchTenorGif(payload.query, payload.pos),
  );

  ipcMain.handle(IPC.FORUM_GET_FEED_OPTIONS, () => fetchFeedOptions());

  ipcMain.handle(
    IPC.FORUM_SET_FEED_OPTIONS,
    (_event, payload: { nodeIds: number[]; keywords: string[] }) =>
      updateFeedOptions(payload.nodeIds, payload.keywords),
  );
};
