import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_MARKET_AUTOBUMP_STATE,
  IPC,
  LZT_CONFIG,
  MARKET_AUTOBUMP_LOG_LIMIT,
  normalizeMarketAutoBumpTime,
  type MarketAutoBumpGlobalPatch,
  type MarketAutoBumpItem,
  type MarketAutoBumpLogEntry,
  type MarketAutoBumpResult,
  type MarketAutoBumpState,
  type MarketAutoBumpSummary,
  type MarketItem,
} from "@lzt/shared";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";
import { bumpItem, getUserItems } from "./market-api";
import { fetchMePersonal } from "./profile-api";
import { sendAlert } from "./telegram-alerts";

const FILE_NAME = "market-autobump.json";
const stateFile = () => join(app.getPath("userData"), FILE_NAME);
const TICK_MS = 20_000;
const MAX_PAGES = 20;
const DAY_MS = 86_400_000;

const newId = (): string =>
  `mab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const clampInt = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : fallback;
  return Math.min(max, Math.max(min, n));
};

const sanitizeTimes = (raw: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(raw)) return fallback;
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeMarketAutoBumpTime(entry);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  out.sort();
  return out.length > 0 ? out : fallback;
};

const timeToMinutes = (value: string): number | null => {
  const normalized = normalizeMarketAutoBumpTime(value);
  if (!normalized) return null;
  const parts = normalized.split(":");
  const hours = Number(parts[0] ?? "0");
  const minutes = Number(parts[1] ?? "0");
  return hours * 60 + minutes;
};

const nextRunAt = (
  times: string[],
  offsetMin: number,
  from = Date.now(),
): number | null => {
  const slots: number[] = [];
  for (const value of times) {
    const minutes = timeToMinutes(value);
    if (minutes !== null) slots.push(minutes);
  }
  if (slots.length === 0) return null;
  slots.sort((a, b) => a - b);
  const offsetMs = offsetMin * 60_000;
  const shifted = from + offsetMs;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  for (const slot of slots) {
    const at = dayStart + slot * 60_000;
    if (at > shifted) return at - offsetMs;
  }
  const first = slots[0] ?? 0;
  return dayStart + DAY_MS + first * 60_000 - offsetMs;
};

const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const WAIT_PATTERN = /(подожд|need to wait)/i;
const NO_BUMPS_PATTERN =
  /(исчерпан|можете купить|можете поднять|available bumps|purchase more bumps)/i;

const classifyBumpError = (
  message: string,
): { result: MarketAutoBumpResult; stop: boolean } => {
  if (NO_BUMPS_PATTERN.test(message)) return { result: "limit", stop: true };
  if (WAIT_PATTERN.test(message)) return { result: "limit", stop: false };
  return { result: "error", stop: false };
};

const shuffled = <T,>(input: T[]): T[] => {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
};

const titleOf = (item: MarketItem): string | null =>
  typeof item.title === "string" ? item.title : null;

const idOf = (item: MarketItem): number | null =>
  typeof item.item_id === "number" ? item.item_id : null;

const stateOf = (item: MarketItem): string | null =>
  typeof item.item_state === "string" && item.item_state.length > 0
    ? item.item_state
    : null;

const isBumpable = (item: MarketItem): boolean => {
  const state = stateOf(item);
  return state === null || state === "active";
};

const numberOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const stringOf = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const itemUrl = (itemId: number): string =>
  `${LZT_CONFIG.marketWebUrl}/${itemId}`;

class MarketAutoBumpStore {
  private state: MarketAutoBumpState | null = null;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  async load(): Promise<MarketAutoBumpState> {
    if (this.state) return this.state;
    const defaults: MarketAutoBumpState = {
      ...DEFAULT_MARKET_AUTOBUMP_STATE,
      times: [...DEFAULT_MARKET_AUTOBUMP_STATE.times],
      cycleBumpedIds: [],
      log: [],
    };
    try {
      const raw = await fs.readFile(stateFile(), "utf8");
      const parsed = JSON.parse(raw) as Partial<MarketAutoBumpState>;
      this.state = {
        ...defaults,
        ...parsed,
        times: sanitizeTimes(parsed.times, defaults.times),
        running: false,
        cycleBumpedIds: Array.isArray(parsed.cycleBumpedIds)
          ? parsed.cycleBumpedIds.filter(
              (value): value is number => typeof value === "number",
            )
          : [],
        log: Array.isArray(parsed.log) ? parsed.log : [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT")
        log.warn("[market-autobump] load failed, using defaults", err);
      this.state = defaults;
    }
    this.state.nextRunAt = nextRunAt(this.state.times, this.state.scheduleOffsetMin);
    return this.state;
  }

  private async persist(): Promise<void> {
    if (!this.state) return;
    try {
      const tmp = `${stateFile()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.state), { mode: 0o600 });
      await fs.rename(tmp, stateFile());
    } catch (err) {
      log.warn("[market-autobump] persist failed", err);
    }
  }

  private async commit(): Promise<MarketAutoBumpState> {
    await this.persist();
    const payload = this.state as MarketAutoBumpState;
    for (const win of BrowserWindow.getAllWindows())
      if (!win.isDestroyed())
        win.webContents.send(IPC.MARKET_AUTOBUMP_CHANGED, payload);
    return payload;
  }

  private addLog(entry: Omit<MarketAutoBumpLogEntry, "id" | "ts">): void {
    if (!this.state) return;
    const rec: MarketAutoBumpLogEntry = {
      id: newId(),
      ts: Date.now(),
      ...entry,
    };
    this.state.log = [rec, ...this.state.log].slice(0, MARKET_AUTOBUMP_LOG_LIMIT);
    const line = `[market-autobump] item ${rec.itemId} → ${rec.result}${
      rec.message ? `: ${rec.message}` : ""
    }`;
    if (rec.result === "error") log.warn(line);
    else log.info(line);
  }

  async setGlobal(
    patch: MarketAutoBumpGlobalPatch,
  ): Promise<MarketAutoBumpState> {
    const s = await this.load();
    if (typeof patch.enabled === "boolean") s.enabled = patch.enabled;
    if (patch.times !== undefined) s.times = sanitizeTimes(patch.times, s.times);
    if (patch.scheduleOffsetMin !== undefined)
      s.scheduleOffsetMin = clampInt(
        patch.scheduleOffsetMin,
        -720,
        840,
        s.scheduleOffsetMin,
      );
    if (patch.itemsPerRun !== undefined)
      s.itemsPerRun = clampInt(patch.itemsPerRun, 1, 50, s.itemsPerRun);
    if (patch.minDelaySec !== undefined)
      s.minDelaySec = clampInt(patch.minDelaySec, 0, 600, s.minDelaySec);
    if (patch.maxDelaySec !== undefined)
      s.maxDelaySec = clampInt(patch.maxDelaySec, 0, 600, s.maxDelaySec);
    if (s.maxDelaySec < s.minDelaySec) s.maxDelaySec = s.minDelaySec;
    if (patch.pageDelaySec !== undefined)
      s.pageDelaySec = clampInt(patch.pageDelaySec, 0, 60, s.pageDelaySec);
    if (typeof patch.shuffle === "boolean") s.shuffle = patch.shuffle;
    if (typeof patch.skipBumpedInCycle === "boolean")
      s.skipBumpedInCycle = patch.skipBumpedInCycle;
    if (patch.categoryId !== undefined)
      s.categoryId =
        typeof patch.categoryId === "number" && patch.categoryId > 0
          ? Math.floor(patch.categoryId)
          : null;
    if (typeof patch.notifySuccess === "boolean")
      s.notifySuccess = patch.notifySuccess;
    if (typeof patch.notifyErrors === "boolean")
      s.notifyErrors = patch.notifyErrors;
    s.nextRunAt = nextRunAt(s.times, s.scheduleOffsetMin);
    return this.commit();
  }

  async clearLog(): Promise<MarketAutoBumpState> {
    const s = await this.load();
    s.log = [];
    return this.commit();
  }

  async resetCycle(): Promise<MarketAutoBumpState> {
    const s = await this.load();
    s.cycleBumpedIds = [];
    s.cycleStartedAt = Date.now();
    return this.commit();
  }

  async runNow(): Promise<{
    ok: boolean;
    state?: MarketAutoBumpState;
    message?: string;
  }> {
    const s = await this.load();
    if (this.busy) return { ok: false, state: s, message: "busy" };
    const res = await this.runOnce(s, true);
    return { ok: res.ok, state: await this.commit(), message: res.message };
  }

  async refreshItems(): Promise<{
    ok: boolean;
    state: MarketAutoBumpState;
    message?: string;
  }> {
    const s = await this.load();
    if (this.busy) return { ok: false, state: s, message: "busy" };
    this.busy = true;
    try {
      const me = await fetchMePersonal();
      if (!me.ok)
        return {
          ok: false,
          state: s,
          message: me.reason === "no_token" ? "no_token" : "profile",
        };
      const userId = me.info?.userId ?? 0;
      if (userId <= 0) return { ok: false, state: s, message: "profile" };
      const items = await this.loadOwnItems(userId, s);
      this.snapshotItems(items, s);
      s.totalItems = items.filter((item) => isBumpable(item)).length;
      return { ok: true, state: await this.commit() };
    } catch (err) {
      log.warn("[market-autobump] refresh failed", err);
      return { ok: false, state: s, message: "run_failed" };
    } finally {
      this.busy = false;
    }
  }

  async bumpSingle(itemId: number): Promise<{
    ok: boolean;
    state: MarketAutoBumpState;
    message?: string;
  }> {
    const s = await this.load();
    if (this.busy) return { ok: false, state: s, message: "busy" };
    if (itemId <= 0) return { ok: false, state: s, message: "bad_item" };
    this.busy = true;
    try {
      const known = s.items.find((entry) => entry.itemId === itemId);
      const item: MarketItem = {
        item_id: itemId,
        category_id: known?.categoryId ?? 0,
        ...(known?.title ? { title: known.title } : {}),
      };
      const outcome = await this.bumpOne(item, s, true);
      return {
        ok: outcome.result === "ok",
        state: await this.commit(),
        message: outcome.result,
      };
    } catch (err) {
      log.warn("[market-autobump] single bump failed", err);
      return { ok: false, state: s, message: "run_failed" };
    } finally {
      this.busy = false;
    }
  }

  private snapshotItems(items: MarketItem[], s: MarketAutoBumpState): void {
    const previous = new Map<number, MarketAutoBumpItem>();
    for (const entry of s.items) previous.set(entry.itemId, entry);
    const out: MarketAutoBumpItem[] = [];
    for (const item of items) {
      const itemId = idOf(item);
      if (itemId === null) continue;
      const known = previous.get(itemId);
      const bumped = s.cycleBumpedIds.includes(itemId);
      out.push({
        itemId,
        title: titleOf(item),
        state: stateOf(item),
        categoryId: numberOf(item.category_id),
        publishedDate: numberOf(item.published_date),
        price: numberOf(item.price),
        currency: stringOf(item.price_currency),
        url: itemUrl(itemId),
        eligibility: !isBumpable(item)
          ? "blocked"
          : bumped && s.skipBumpedInCycle
            ? "bumped"
            : "ready",
        lastResult: known?.lastResult ?? null,
        lastMessage: known?.lastMessage ?? null,
        lastAt: known?.lastAt ?? null,
      });
    }
    s.items = out;
    s.itemsAt = Date.now();
  }

  private markItem(
    s: MarketAutoBumpState,
    itemId: number,
    result: MarketAutoBumpResult,
    message: string | null,
  ): void {
    const at = Date.now();
    const next: MarketAutoBumpItem[] = [];
    for (const entry of s.items) {
      if (entry.itemId !== itemId) {
        next.push(entry);
        continue;
      }
      next.push({
        ...entry,
        lastResult: result,
        lastMessage: message,
        lastAt: at,
        eligibility: result === "ok" ? "bumped" : entry.eligibility,
      });
    }
    s.items = next;
  }

  private async loadOwnItems(
    userId: number,
    s: MarketAutoBumpState,
  ): Promise<MarketItem[]> {
    const out: MarketItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await getUserItems(userId, page, {
        order_by: "pdate_to_down",
        show: "active",
        ...(s.categoryId !== null ? { category_id: s.categoryId } : {}),
      });
      if (!res.ok) break;
      for (const item of res.page.items) out.push(item);
      if (!res.page.hasNextPage) break;
      if (s.pageDelaySec > 0) await sleep(s.pageDelaySec * 1000);
    }
    return out;
  }

  private async bumpOne(
    item: MarketItem,
    s: MarketAutoBumpState,
    manual: boolean,
  ): Promise<{ result: MarketAutoBumpResult; stop: boolean }> {
    const itemId = idOf(item);
    if (itemId === null) return { result: "skipped", stop: false };
    if (!manual && s.maxDelaySec > 0) {
      const span = s.maxDelaySec - s.minDelaySec;
      const extra = span > 0 ? Math.floor(Math.random() * (span + 1)) : 0;
      await sleep((s.minDelaySec + extra) * 1000);
    }
    const res = await bumpItem(itemId);
    const title = titleOf(item);
    if (res.ok) {
      if (!s.cycleBumpedIds.includes(itemId)) s.cycleBumpedIds.push(itemId);
      this.addLog({ itemId, itemTitle: title, result: "ok", message: null });
      this.markItem(s, itemId, "ok", null);
      if (s.notifySuccess)
        void sendAlert(
          "bump",
          "Маркет: лот поднят",
          title ? `${title} (#${itemId})` : `Лот #${itemId}`,
        );
      return { result: "ok", stop: false };
    }
    const raw = res.errors[0] ?? res.reason ?? "Неизвестная ошибка";
    const message = stripHtml(raw);
    const { result, stop } = classifyBumpError(message);
    this.addLog({ itemId, itemTitle: title, result, message });
    this.markItem(s, itemId, result, message);
    if (result === "error" && s.notifyErrors)
      void sendAlert(
        "bump",
        "Маркет: ошибка автоподнятия",
        `${title ?? `Лот #${itemId}`}: ${message}`,
      );
    return { result, stop };
  }

  private async runOnce(
    s: MarketAutoBumpState,
    manual: boolean,
  ): Promise<{ ok: boolean; message?: string }> {
    this.busy = true;
    s.running = true;
    await this.commit();
    const summary: MarketAutoBumpSummary = {
      at: Date.now(),
      scanned: 0,
      bumped: 0,
      limited: 0,
      errors: 0,
    };
    try {
      const me = await fetchMePersonal();
      if (!me.ok) {
        const noToken = me.reason === "no_token";
        this.addLog({
          itemId: 0,
          itemTitle: null,
          result: "error",
          message: noToken ? "Нет токена" : "Профиль недоступен",
        });
        return { ok: false, message: noToken ? "no_token" : "profile" };
      }
      const userId = me.info?.userId ?? 0;
      if (userId <= 0) {
        this.addLog({
          itemId: 0,
          itemTitle: null,
          result: "error",
          message: "Профиль недоступен",
        });
        return { ok: false, message: "profile" };
      }
      const items = await this.loadOwnItems(userId, s);
      this.snapshotItems(items, s);
      const bumpable = items.filter((item) => isBumpable(item));
      s.totalItems = bumpable.length;
      if (bumpable.length === 0) {
        this.addLog({
          itemId: 0,
          itemTitle: null,
          result: "skipped",
          message: "Активных лотов не найдено",
        });
        return { ok: false, message: "no_items" };
      }
      const ids = new Set<number>();
      for (const item of bumpable) {
        const id = idOf(item);
        if (id !== null) ids.add(id);
      }
      const pending = [...ids].filter((id) => !s.cycleBumpedIds.includes(id));
      if (s.skipBumpedInCycle && pending.length === 0) {
        s.cycleBumpedIds = [];
        s.cycleStartedAt = Date.now();
        log.info("[market-autobump] cycle finished, starting a new one");
      }
      if (s.cycleStartedAt === null) s.cycleStartedAt = Date.now();
      const queue = s.shuffle ? shuffled(bumpable) : bumpable;
      for (const item of queue) {
        if (summary.bumped + summary.limited + summary.errors >= s.itemsPerRun)
          break;
        const id = idOf(item);
        if (id === null) continue;
        if (s.skipBumpedInCycle && s.cycleBumpedIds.includes(id)) continue;
        summary.scanned += 1;
        const outcome = await this.bumpOne(item, s, manual);
        if (outcome.result === "ok") summary.bumped += 1;
        else if (outcome.result === "limit") summary.limited += 1;
        else if (outcome.result === "error") summary.errors += 1;
        if (outcome.stop) break;
      }
      s.lastRunAt = summary.at;
      s.lastSummary = summary;
      log.info(
        `[market-autobump] run scanned=${summary.scanned} bumped=${summary.bumped} limited=${summary.limited} errors=${summary.errors}`,
      );
      return { ok: summary.errors === 0 };
    } catch (err) {
      log.warn("[market-autobump] run failed", err);
      return { ok: false, message: "run_failed" };
    } finally {
      this.busy = false;
      s.running = false;
      s.nextRunAt = nextRunAt(s.times, s.scheduleOffsetMin);
    }
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    const s = await this.load();
    if (!s.enabled) return;
    if (s.nextRunAt === null) {
      s.nextRunAt = nextRunAt(s.times, s.scheduleOffsetMin);
      return;
    }
    if (Date.now() < s.nextRunAt) return;
    await this.runOnce(s, false);
    await this.commit();
  }

  private reschedule(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  async start(): Promise<void> {
    await this.load();
    this.reschedule();
    log.info("[market-autobump] scheduler started");
  }
}

const store = new MarketAutoBumpStore();

export const getMarketAutoBumpState = (): Promise<MarketAutoBumpState> =>
  store.load();
export const setMarketAutoBumpGlobal = (patch: MarketAutoBumpGlobalPatch) =>
  store.setGlobal(patch);
export const runMarketAutoBumpNow = () => store.runNow();
export const resetMarketAutoBumpCycle = () => store.resetCycle();
export const clearMarketAutoBumpLog = () => store.clearLog();
export const refreshMarketAutoBumpItems = () => store.refreshItems();
export const bumpMarketAutoBumpItem = (itemId: number) =>
  store.bumpSingle(itemId);
export const startMarketAutoBump = () => store.start();
