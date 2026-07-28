export type MarketAutoBumpResult = "ok" | "limit" | "error" | "skipped";

export interface MarketAutoBumpLogEntry {
  id: string;
  ts: number;
  itemId: number;
  itemTitle: string | null;
  result: MarketAutoBumpResult;
  message: string | null;
}

export interface MarketAutoBumpSummary {
  at: number;
  scanned: number;
  bumped: number;
  limited: number;
  errors: number;
}

export type MarketAutoBumpEligibility = "ready" | "bumped" | "blocked";

export interface MarketAutoBumpItem {
  itemId: number;
  title: string | null;
  state: string | null;
  categoryId: number | null;
  publishedDate: number | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  eligibility: MarketAutoBumpEligibility;
  lastResult: MarketAutoBumpResult | null;
  lastMessage: string | null;
  lastAt: number | null;
}

export interface MarketAutoBumpState {
  enabled: boolean;
  times: string[];
  scheduleOffsetMin: number;
  itemsPerRun: number;
  minDelaySec: number;
  maxDelaySec: number;
  pageDelaySec: number;
  shuffle: boolean;
  skipBumpedInCycle: boolean;
  categoryId: number | null;
  notifySuccess: boolean;
  notifyErrors: boolean;
  running: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  cycleStartedAt: number | null;
  cycleBumpedIds: number[];
  totalItems: number;
  items: MarketAutoBumpItem[];
  itemsAt: number | null;
  lastSummary: MarketAutoBumpSummary | null;
  log: MarketAutoBumpLogEntry[];
}

export type MarketAutoBumpGlobalPatch = Partial<
  Pick<
    MarketAutoBumpState,
    | "enabled"
    | "times"
    | "scheduleOffsetMin"
    | "itemsPerRun"
    | "minDelaySec"
    | "maxDelaySec"
    | "pageDelaySec"
    | "shuffle"
    | "skipBumpedInCycle"
    | "categoryId"
    | "notifySuccess"
    | "notifyErrors"
  >
>;

export const DEFAULT_MARKET_AUTOBUMP_TIMES: string[] = [
  "00:30",
  "02:55",
  "10:00",
  "12:25",
  "14:50",
  "17:15",
  "19:40",
  "22:05",
];

export const DEFAULT_MARKET_AUTOBUMP_STATE: MarketAutoBumpState = {
  enabled: false,
  times: DEFAULT_MARKET_AUTOBUMP_TIMES,
  scheduleOffsetMin: 180,
  itemsPerRun: 1,
  minDelaySec: 1,
  maxDelaySec: 60,
  pageDelaySec: 3,
  shuffle: true,
  skipBumpedInCycle: true,
  categoryId: null,
  notifySuccess: false,
  notifyErrors: true,
  running: false,
  lastRunAt: null,
  nextRunAt: null,
  cycleStartedAt: null,
  cycleBumpedIds: [],
  totalItems: 0,
  items: [],
  itemsAt: null,
  lastSummary: null,
  log: [],
};

export const MARKET_AUTOBUMP_LOG_LIMIT = 200;

export const MARKET_AUTOBUMP_TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const normalizeMarketAutoBumpTime = (raw: string): string | null => {
  const match = MARKET_AUTOBUMP_TIME_PATTERN.exec(raw.trim());
  if (!match) return null;
  const hours = match[1] ?? "0";
  const minutes = match[2] ?? "00";
  return `${hours.padStart(2, "0")}:${minutes}`;
};
