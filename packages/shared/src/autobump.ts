import type { ThreadPrefix } from "./types";

export type AutoBumpResult = "ok" | "error" | "cooldown" | "skipped";

export interface AutoBumpThread {
  threadId: number;
  title: string | null;
  prefixes: ThreadPrefix[];
  replyCount: number | null;
  viewCount: number | null;
  createDate: number | null;
  creatorUsername: string | null;
  enabled: boolean;
  windowStartMin: number;
  windowEndMin: number;
  intervalMin: number;
  weekdays: number[];
  maxPerDay: number;
  nextBumpAt: number | null;
  lastBumpAt: number | null;
  lastResult: AutoBumpResult | null;
  lastMessage: string | null;
  bumpsToday: number;
  dayKey: string | null;
}

export interface AutoBumpLogEntry {
  id: string;
  ts: number;
  threadId: number;
  threadTitle: string | null;
  result: AutoBumpResult;
  message: string | null;
}

export interface AutoBumpState {
  enabled: boolean;
  tickSeconds: number;
  jitterMin: number;
  threads: AutoBumpThread[];
  log: AutoBumpLogEntry[];
}

export type AutoBumpGlobalPatch = Partial<
  Pick<AutoBumpState, "enabled" | "tickSeconds" | "jitterMin">
>;

type AutoBumpThreadCache =
  | "threadId"
  | "title"
  | "prefixes"
  | "replyCount"
  | "viewCount"
  | "createDate"
  | "creatorUsername";

export const DEFAULT_AUTOBUMP_THREAD: Omit<AutoBumpThread, AutoBumpThreadCache> = {
  enabled: true,
  windowStartMin: 0,
  windowEndMin: 0,
  intervalMin: 240,
  weekdays: [],
  maxPerDay: 0,
  nextBumpAt: null,
  lastBumpAt: null,
  lastResult: null,
  lastMessage: null,
  bumpsToday: 0,
  dayKey: null,
};

export const DEFAULT_AUTOBUMP_STATE: AutoBumpState = {
  enabled: false,
  tickSeconds: 60,
  jitterMin: 0,
  threads: [],
  log: [],
};

export const AUTOBUMP_LOG_LIMIT = 200;
