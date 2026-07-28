
export type HistoryKind =
  | "deletedPost"
  | "editedPost"
  | "deletedThread"
  | "deletedChatMessage"
  | "editedChatMessage";

export type HistorySource = "forum" | "chat";

export interface HistoryAuthor {
  userId: number | null;
  username: string | null;
  usernameHtml: string | null;
  avatarUrl: string | null;
}

export interface HistoryRevision {
  bodyHtml: string;
  at: number;
  mediaIds: string[];
}

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  source: HistorySource;
  postId: number | null;
  threadId: number | null;
  messageId: number | null;
  roomId: number | null;
  threadTitle: string | null;
  author: HistoryAuthor;
  bodyHtml: string;
  mediaIds: string[];
  revisions: HistoryRevision[];
  url: string | null;
  createdAt: number;
  firstSeenAt: number;
  recordedAt: number;
  updatedAt: number;
}

export interface HistoryQuery {
  kinds?: HistoryKind[];
  source?: HistorySource;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  total: number;
}

export interface HistoryMarkers {
  edited: Record<string, true>;
  deleted: Record<string, true>;
}

export interface HistoryObserveItem {
  id: number;
  bodyHtml: string;
  createDate: number | null;
  author: HistoryAuthor;
  title?: string;
  imageUrls?: string[];
}

export type HistoryContainer = "posts" | "threads" | "messages";

export interface HistoryObservePayload {
  source: HistorySource;
  container: HistoryContainer;
  containerId: number;
  threadTitle: string | null;
  items: HistoryObserveItem[];
  complete: boolean;
}

export interface HistoryObserveResult {
  newDeleted: number;
  newEdited: number;
}

export interface DataUsage {
  categories: Record<string, number>;
  totalBytes: number;
  mediaCount: number;
  entryCount: number;
}

export const DATA_DIRS = [
  "emoji",
  "user_data",
  "account_data",
  "threads_data",
  "comment_data",
  "cache/media_cache",
  "dumps",
] as const;
export type DataDir = (typeof DATA_DIRS)[number];

export const HISTORY_RETENTION_DAYS_DEFAULT = 90;
export const HISTORY_CHECK_SECONDS_DEFAULT = 30;
export const HISTORY_ENTRY_LIMIT = 5000;
