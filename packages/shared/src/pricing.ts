export type PricingEstimator =
  | "lowest"
  | "lowerQuartile"
  | "median"
  | "weightedMedian";

export type PricingStrategy = "active" | "lastSold" | "combined";

export type PricingStatus = "ready" | "review" | "manual";

export type PricingSource =
  | "active"
  | "lastSold"
  | "combined"
  | "noData";

export interface PricingCategoryConfig {
  estimator: PricingEstimator;
  strategy: PricingStrategy;
  filterPriceOutliers: boolean;
  priceOutlierRatio: number;
  minSimilarity: number;
  maxAnalogs: number;
  priceMultiplier: number;
  discountPercent: number;
  priceMin: number;
  priceMax: number | null;
  readyConfidence: number;
}

export const DEFAULT_PRICING_CONFIG: PricingCategoryConfig = {
  estimator: "weightedMedian",
  strategy: "combined",
  filterPriceOutliers: true,
  priceOutlierRatio: 6,
  minSimilarity: 0,
  maxAnalogs: 12,
  priceMultiplier: 100,
  discountPercent: 0,
  priceMin: 1,
  priceMax: null,
  readyConfidence: 0.6,
};

export interface PricingCandidate {
  itemId: number;
  price: number;
  sold?: boolean;
  soldAt?: number | null;
  similarity?: number;
  sellerId?: number | null;
  title?: string;
}

export interface PricingTarget {
  itemId?: number;
  sellerId?: number | null;
  categoryId?: number;
}

export interface PricingRange {
  min: number;
  max: number;
}

export interface PricingEstimate {
  proposedPrice: number | null;
  basePrice: number | null;
  priceRange: PricingRange | null;
  confidence: number;
  status: PricingStatus;
  source: PricingSource;
  estimator: PricingEstimator;
  analogsUsed: number;
  rejected: number;
  gapRatio: number;
}

export const median = (values: number[]): number | null => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  const size = sorted.length;
  if (!size) return null;
  const middle = Math.floor(size / 2);
  if (size % 2) return sorted[middle] as number;
  const low = sorted[middle - 1] as number;
  const high = sorted[middle] as number;
  return (low + high) / 2;
};

export const quantile = (values: number[], ratio: number): number | null => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  const size = sorted.length;
  if (!size) return null;
  if (size === 1) return sorted[0] as number;
  const position = (size - 1) * Math.min(1, Math.max(0, ratio));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  if (lower === upper) return low;
  const high = sorted[upper] as number;
  return low + (high - low) * (position - lower);
};

const candidateWeight = (candidate: PricingCandidate): number =>
  0.5 + Math.min(1, Math.max(0, Number(candidate.similarity) || 0));

export const weightedMedian = (candidates: PricingCandidate[]): number | null => {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((left, right) => left.price - right.price);
  const weighted = sorted.map((candidate) => ({
    candidate,
    weight: candidateWeight(candidate),
  }));
  const midpoint = weighted.reduce((sum, entry) => sum + entry.weight, 0) / 2;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (cumulative >= midpoint) return entry.candidate.price;
  }
  const last = weighted[weighted.length - 1];
  return last ? last.candidate.price : null;
};

export const PLACEHOLDER_ANCHOR_PRICES = new Set<number>([
  1337, 31337, 13337, 100000,
]);

const hasUniformDigits = (digits: string): boolean => {
  const first = digits[0];
  if (first === undefined) return false;
  const firstDigitCount = [...digits].filter((digit) => digit === first).length;
  return firstDigitCount / digits.length >= 0.75;
};

const isSequentialDigits = (digits: string): boolean => {
  if (digits.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let index = 1; index < digits.length; index += 1) {
    const delta = Number(digits[index]) - Number(digits[index - 1]);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
};

export const isPlaceholderPrice = (value: number): boolean => {
  const price = Number(value);
  if (!Number.isInteger(price) || price < 1000) return false;
  if (PLACEHOLDER_ANCHOR_PRICES.has(price)) return true;
  const digits = String(price);
  if (hasUniformDigits(digits)) return true;
  if (isSequentialDigits(digits)) return true;
  return false;
};

export interface PriceClusterResult {
  candidates: PricingCandidate[];
  rejected: PricingCandidate[];
  gapRatio: number;
  keptSide: "all" | "lower" | "upper" | "conflict";
}

const clusterSupport = (cluster: PricingCandidate[]): number =>
  cluster.reduce((sum, candidate) => sum + candidateWeight(candidate), 0);

export const coherentPriceCluster = (
  candidates: PricingCandidate[],
  maximumRatio = 6,
): PriceClusterResult => {
  const sorted = [...candidates]
    .filter((candidate) => Number.isFinite(candidate.price) && candidate.price > 0)
    .sort((left, right) => left.price - right.price);
  if (sorted.length < 2) {
    return { candidates: sorted, rejected: [], gapRatio: 1, keptSide: "all" };
  }
  const clusters: PricingCandidate[][] = [[]];
  let gapRatio = 1;
  for (const candidate of sorted) {
    const current = clusters[clusters.length - 1] as PricingCandidate[];
    const previous = current[current.length - 1];
    const ratio = previous ? candidate.price / previous.price : 1;
    gapRatio = Math.max(gapRatio, ratio);
    if (previous && ratio >= maximumRatio) clusters.push([]);
    (clusters[clusters.length - 1] as PricingCandidate[]).push(candidate);
  }
  if (clusters.length === 1) {
    return { candidates: sorted, rejected: [], gapRatio, keptSide: "all" };
  }
  const supported = clusters.filter((cluster) => cluster.length >= 2);
  if (!supported.length) {
    return { candidates: [], rejected: sorted, gapRatio, keptSide: "conflict" };
  }
  const ranked = supported
    .map((cluster) => ({ cluster, support: clusterSupport(cluster) }))
    .sort(
      (left, right) =>
        right.support - left.support ||
        (left.cluster[0]?.price ?? 0) - (right.cluster[0]?.price ?? 0),
    );
  const selected = ranked[0]?.cluster ?? [];
  return {
    candidates: selected,
    rejected: clusters.filter((cluster) => cluster !== selected).flat(),
    gapRatio,
    keptSide: selected === clusters[0] ? "lower" : "upper",
  };
};

export const activeMarketPrice = (
  candidates: PricingCandidate[],
  estimator: PricingEstimator,
): number | null => {
  const prices = candidates.map((candidate) => candidate.price);
  if (!prices.length) return null;
  if (estimator === "lowest") return Math.min(...prices);
  if (estimator === "lowerQuartile") return quantile(prices, 0.25);
  if (estimator === "median") return median(prices);
  return weightedMedian(candidates);
};

const isNumber = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const estimatePrice = (
  target: PricingTarget,
  analogs: PricingCandidate[],
  config?: Partial<PricingCategoryConfig>,
): PricingEstimate => {
  const cfg: PricingCategoryConfig = { ...DEFAULT_PRICING_CONFIG, ...config };
  const pool = analogs.filter(
    (candidate) =>
      candidate.itemId !== target.itemId &&
      Number.isFinite(candidate.price) &&
      candidate.price > 0 &&
      (target.sellerId == null ||
        candidate.sellerId == null ||
        candidate.sellerId !== target.sellerId) &&
      (cfg.minSimilarity <= 0 ||
        candidate.similarity === undefined ||
        candidate.similarity >= cfg.minSimilarity),
  );
  const activePool = pool.filter((candidate) => !candidate.sold);
  const soldPool = pool.filter((candidate) => candidate.sold);
  const cleanActive = cfg.filterPriceOutliers
    ? activePool.filter((candidate) => !isPlaceholderPrice(candidate.price))
    : activePool;
  const cluster: PriceClusterResult = cfg.filterPriceOutliers
    ? coherentPriceCluster(cleanActive, cfg.priceOutlierRatio)
    : { candidates: cleanActive, rejected: [], gapRatio: 1, keptSide: "all" };
  const rankedActive = [...cluster.candidates]
    .sort((left, right) => (Number(right.similarity) || 0) - (Number(left.similarity) || 0))
    .slice(0, cfg.maxAnalogs);
  const rankedSold = [...soldPool]
    .sort((left, right) => (Number(right.soldAt) || 0) - (Number(left.soldAt) || 0))
    .slice(0, cfg.maxAnalogs);
  const activeBase = activeMarketPrice(rankedActive, cfg.estimator);
  const soldBase = rankedSold[0]?.price ?? null;
  let basePrice: number | null;
  let source: PricingSource;
  if (cfg.strategy === "active") {
    basePrice = activeBase;
    source = "active";
  } else if (cfg.strategy === "lastSold") {
    basePrice = soldBase;
    source = "lastSold";
  } else {
    basePrice = median([activeBase, soldBase].filter(isNumber));
    source =
      isNumber(activeBase) && isNumber(soldBase)
        ? "combined"
        : isNumber(activeBase)
          ? "active"
          : "lastSold";
  }
  const evidence = [...rankedActive, ...rankedSold].slice(0, cfg.maxAnalogs);
  if (!isNumber(basePrice) || basePrice <= 0) {
    return {
      proposedPrice: null,
      basePrice: null,
      priceRange: null,
      confidence: 0,
      status: "manual",
      source: "noData",
      estimator: cfg.estimator,
      analogsUsed: 0,
      rejected: cluster.rejected.length,
      gapRatio: cluster.gapRatio,
    };
  }
  const clampDiscount = Math.min(99, Math.max(0, cfg.discountPercent));
  const ceiling = cfg.priceMax ?? Number.POSITIVE_INFINITY;
  const transform = (value: number): number => {
    const multiplied = (value * cfg.priceMultiplier) / 100;
    const discounted = multiplied * (1 - clampDiscount / 100);
    return Math.round(Math.min(ceiling, Math.max(cfg.priceMin, Math.max(1, discounted))));
  };
  const proposedPrice = transform(basePrice);
  const evidencePrices = evidence.map((candidate) => candidate.price);
  const low = quantile(evidencePrices, 0.25);
  const high = quantile(evidencePrices, 0.75);
  const priceRange: PricingRange =
    isNumber(low) && isNumber(high)
      ? { min: transform(low), max: transform(high) }
      : { min: proposedPrice, max: proposedPrice };
  const averageSimilarity = evidence.length
    ? evidence.reduce((sum, item) => sum + (Number(item.similarity) || 0.5), 0) /
      evidence.length
    : 0.15;
  const evidenceFactor = Math.min(1, 0.7 + Math.min(evidence.length, 4) * 0.075);
  const confidence = Math.min(0.98, averageSimilarity * evidenceFactor);
  const status: PricingStatus =
    confidence >= cfg.readyConfidence ? "ready" : confidence > 0 ? "review" : "manual";
  return {
    proposedPrice,
    basePrice: Math.round(basePrice),
    priceRange,
    confidence,
    status,
    source,
    estimator: cfg.estimator,
    analogsUsed: evidence.length,
    rejected: cluster.rejected.length,
    gapRatio: cluster.gapRatio,
  };
};
