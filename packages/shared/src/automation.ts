import type { PricingEstimator } from "./pricing";

export type AutoRepriceResult = "updated" | "held" | "skipped" | "error";

export interface AutoRepriceRules {
  estimator: PricingEstimator;
  multiplier: number;
  discountPercent: number;
  minSimilarityPercent: number;
  minConfidence: "review" | "ready";
  maxChangePercent: number;
  priceFloor: number;
  onlyLower: boolean;
}

export interface AutoRepriceLogEntry {
  id: string;
  ts: number;
  itemId: number;
  itemTitle: string | null;
  result: AutoRepriceResult;
  oldPrice: number | null;
  newPrice: number | null;
  currency: string | null;
  confidence: number | null;
  message: string | null;
}

export interface AutoRepriceRunSummary {
  at: number;
  scanned: number;
  updated: number;
  held: number;
  skipped: number;
  errors: number;
}

export interface AutoRepriceState {
  enabled: boolean;
  intervalMinutes: number;
  categoryScope: number[];
  dryRun: boolean;
  rules: AutoRepriceRules;
  running: boolean;
  lastRunAt: number | null;
  lastSummary: AutoRepriceRunSummary | null;
  log: AutoRepriceLogEntry[];
}

export type AutoRepriceGlobalPatch = Partial<
  Pick<
    AutoRepriceState,
    "enabled" | "intervalMinutes" | "categoryScope" | "dryRun"
  >
> & { rules?: Partial<AutoRepriceRules> };

export const DEFAULT_AUTOREPRICE_RULES: AutoRepriceRules = {
  estimator: "weightedMedian",
  multiplier: 100,
  discountPercent: 0,
  minSimilarityPercent: 35,
  minConfidence: "ready",
  maxChangePercent: 25,
  priceFloor: 1,
  onlyLower: false,
};

export const DEFAULT_AUTOREPRICE_STATE: AutoRepriceState = {
  enabled: false,
  intervalMinutes: 180,
  categoryScope: [],
  dryRun: true,
  rules: DEFAULT_AUTOREPRICE_RULES,
  running: false,
  lastRunAt: null,
  lastSummary: null,
  log: [],
};

export const AUTOREPRICE_LOG_LIMIT = 200;
export const AUTOREPRICE_MIN_INTERVAL_MINUTES = 15;
export const AUTOREPRICE_MAX_LOTS_PER_RUN = 80;
