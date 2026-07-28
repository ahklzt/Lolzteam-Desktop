import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  AUTOBUMP_LOG_LIMIT,
  DEFAULT_AUTOBUMP_STATE,
  DEFAULT_AUTOBUMP_THREAD,
  IPC,
  type AutoBumpGlobalPatch,
  type AutoBumpLogEntry,
  type AutoBumpResult,
  type AutoBumpState,
  type AutoBumpThread,
} from "@lzt/shared";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";
import { bumpThread, fetchForumThread } from "./forum-api";

const FILE_NAME = "autobump.json";
const stateFile = () => join(app.getPath("userData"), FILE_NAME);

const newId = (): string =>
  `ab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const localDayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const nowMinutes = (d = new Date()): number => d.getHours() * 60 + d.getMinutes();

const inWindow = (t: AutoBumpThread, cur: number): boolean => {
  if (t.windowStartMin === t.windowEndMin) return true;
  if (t.windowStartMin < t.windowEndMin)
    return cur >= t.windowStartMin && cur < t.windowEndMin;
  return cur >= t.windowStartMin || cur < t.windowEndMin;
};

const parseThreadId = (ref: string): number | null => {
  const s = ref.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const clean = s.replace(/[?#].*$/, "");
  const tail = clean.match(/(\d+)\/?$/);
  if (tail) return Number(tail[1]);
  const any = clean.match(/threads\/(?:.*?\.)?(\d+)/i);
  return any ? Number(any[1]) : null;
};

const looksLikeCooldown = (msg: string | null): boolean => {
  if (!msg) return false;
  return /(bump|снова|подожд|ещё рано|еще рано|wait|later|too soon|часо|минут)/i.test(
    msg,
  );
};

const sanitizeThread = (t: AutoBumpThread): AutoBumpThread => {
  const clampMin = (v: number) => Math.min(1439, Math.max(0, Math.floor(v || 0)));
  return {
    ...t,
    windowStartMin: clampMin(t.windowStartMin),
    windowEndMin: clampMin(t.windowEndMin),
    intervalMin: Math.max(1, Math.floor(t.intervalMin || 1)),
    maxPerDay: Math.max(0, Math.floor(t.maxPerDay || 0)),
    weekdays: Array.isArray(t.weekdays)
      ? [...new Set(t.weekdays.filter((d) => d >= 0 && d <= 6))]
      : [],
  };
};

class AutoBumpStore extends EventEmitter {
  private state: AutoBumpState | null = null;
  private timer: NodeJS.Timeout | null = null;
  private tickMs = DEFAULT_AUTOBUMP_STATE.tickSeconds * 1000;
  private ticking = false;

  async load(): Promise<AutoBumpState> {
    if (this.state) return this.state;
    try {
      const raw = await fs.readFile(stateFile(), "utf8");
      const parsed = JSON.parse(raw) as Partial<AutoBumpState>;
      this.state = {
        ...DEFAULT_AUTOBUMP_STATE,
        ...parsed,
        threads: Array.isArray(parsed.threads) ? parsed.threads : [],
        log: Array.isArray(parsed.log) ? parsed.log : [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT")
        log.warn("[autobump] load failed, using defaults", err);
      this.state = { ...DEFAULT_AUTOBUMP_STATE };
    }
    return this.state;
  }

  private async persist(): Promise<void> {
    if (!this.state) return;
    try {
      const tmp = `${stateFile()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.state), { mode: 0o600 });
      await fs.rename(tmp, stateFile());
    } catch (err) {
      log.warn("[autobump] persist failed", err);
    }
  }

  private async commit(): Promise<AutoBumpState> {
    await this.persist();
    const payload = this.state as AutoBumpState;
    for (const win of BrowserWindow.getAllWindows())
      if (!win.isDestroyed())
        win.webContents.send(IPC.AUTOBUMP_CHANGED, payload);
    return payload;
  }

  private addLog(entry: Omit<AutoBumpLogEntry, "id" | "ts">): void {
    if (!this.state) return;
    const rec: AutoBumpLogEntry = { id: newId(), ts: Date.now(), ...entry };
    this.state.log = [rec, ...this.state.log].slice(0, AUTOBUMP_LOG_LIMIT);
    const line = `[autobump] thread ${rec.threadId} → ${rec.result}${
      rec.message ? `: ${rec.message}` : ""
    }`;
    if (rec.result === "error") log.warn(line);
    else log.info(line);
  }

  async setGlobal(patch: AutoBumpGlobalPatch): Promise<AutoBumpState> {
    const s = await this.load();
    if (typeof patch.enabled === "boolean") s.enabled = patch.enabled;
    if (typeof patch.tickSeconds === "number" && patch.tickSeconds >= 5)
      s.tickSeconds = Math.floor(patch.tickSeconds);
    if (typeof patch.jitterMin === "number" && patch.jitterMin >= 0)
      s.jitterMin = Math.floor(patch.jitterMin);
    this.reschedule();
    return this.commit();
  }

  async addThread(
    ref: string,
  ): Promise<{ ok: boolean; state?: AutoBumpState; message?: string }> {
    const s = await this.load();
    const threadId = parseThreadId(ref);
    if (threadId === null)
      return { ok: false, message: "Не удалось распознать ID/ссылку темы" };
    if (s.threads.some((t) => t.threadId === threadId))
      return { ok: false, message: "Эта тема уже добавлена" };
    const res = await fetchForumThread(threadId);
    if (!res.ok)
      return {
        ok: false,
        message:
          res.reason === "no_token"
            ? "Сначала войдите по токену во вкладке «Профиль»"
            : "Тема не найдена или нет доступа",
      };
    const th = res.thread;
    const thread: AutoBumpThread = {
      threadId,
      title: th.title ?? null,
      prefixes: th.prefixes ?? [],
      replyCount: th.replyCount ?? null,
      viewCount: th.viewCount ?? null,
      createDate: th.createDate ?? null,
      creatorUsername: th.creator?.username ?? null,
      ...DEFAULT_AUTOBUMP_THREAD,
    };
    s.threads = [thread, ...s.threads];
    return { ok: true, state: await this.commit() };
  }

  async updateThread(
    threadId: number,
    patch: Partial<AutoBumpThread>,
  ): Promise<AutoBumpState> {
    const s = await this.load();
    s.threads = s.threads.map((t) =>
      t.threadId === threadId
        ? sanitizeThread({ ...t, ...patch, threadId })
        : t,
    );
    return this.commit();
  }

  async removeThread(threadId: number): Promise<AutoBumpState> {
    const s = await this.load();
    s.threads = s.threads.filter((t) => t.threadId !== threadId);
    return this.commit();
  }

  async clearLog(): Promise<AutoBumpState> {
    const s = await this.load();
    s.log = [];
    return this.commit();
  }

  async bumpNow(
    threadId: number,
  ): Promise<{ ok: boolean; state?: AutoBumpState; message?: string }> {
    const s = await this.load();
    const t = s.threads.find((x) => x.threadId === threadId);
    if (!t) return { ok: false, message: "Тема не найдена в списке" };
    const r = await this.doBump(t, true);
    return {
      ok: r.result === "ok",
      state: await this.commit(),
      message: r.message ?? undefined,
    };
  }

  private async doBump(
    t: AutoBumpThread,
    manual: boolean,
  ): Promise<{ result: AutoBumpResult; message: string | null }> {
    const res = await bumpThread(t.threadId);
    const dayKey = localDayKey();
    if (t.dayKey !== dayKey) {
      t.dayKey = dayKey;
      t.bumpsToday = 0;
    }
    let result: AutoBumpResult;
    let message: string | null = null;
    if (res.ok) {
      result = "ok";
      t.lastBumpAt = Date.now();
      t.bumpsToday += 1;
    } else {
      message = res.message ?? null;
      result = looksLikeCooldown(message) ? "cooldown" : "error";
    }
    t.lastResult = result;
    t.lastMessage = message;
    t.nextBumpAt = Date.now() + this.effectiveIntervalMs(t);
    this.addLog({
      threadId: t.threadId,
      threadTitle: t.title,
      result,
      message: manual ? `вручную${message ? `: ${message}` : ""}` : message,
    });
    return { result, message };
  }

  private effectiveIntervalMs(t: AutoBumpThread): number {
    const jitter = this.state?.jitterMin ?? 0;
    const extra = jitter > 0 ? Math.floor(Math.random() * (jitter + 1)) : 0;
    return (t.intervalMin + extra) * 60_000;
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const s = await this.load();
      if (!s.enabled) return;
      const now = Date.now();
      const cur = nowMinutes();
      const day = new Date().getDay();
      let changed = false;
      for (const t of s.threads) {
        if (!t.enabled) continue;
        if (t.weekdays.length > 0 && !t.weekdays.includes(day)) continue;
        if (!inWindow(t, cur)) continue;
        if (t.nextBumpAt !== null && now < t.nextBumpAt) continue;
        const dayKey = localDayKey();
        const used = t.dayKey === dayKey ? t.bumpsToday : 0;
        if (t.maxPerDay > 0 && used >= t.maxPerDay) continue;
        await this.doBump(t, false);
        changed = true;
      }
      if (changed) await this.commit();
    } catch (err) {
      log.warn("[autobump] tick failed", err);
    } finally {
      this.ticking = false;
    }
  }

  private reschedule(): void {
    const sec = this.state?.tickSeconds ?? DEFAULT_AUTOBUMP_STATE.tickSeconds;
    const ms = Math.max(5, sec) * 1000;
    if (this.timer && ms === this.tickMs) return;
    if (this.timer) clearInterval(this.timer);
    this.tickMs = ms;
    this.timer = setInterval(() => void this.tick(), ms);
  }

  async start(): Promise<void> {
    await this.load();
    this.reschedule();
    log.info("[autobump] scheduler started");
  }
}

const store = new AutoBumpStore();

export const getAutoBumpState = (): Promise<AutoBumpState> => store.load();
export const setAutoBumpGlobal = (p: AutoBumpGlobalPatch) => store.setGlobal(p);
export const addAutoBumpThread = (ref: string) => store.addThread(ref);
export const updateAutoBumpThread = (
  id: number,
  patch: Partial<AutoBumpThread>,
) => store.updateThread(id, patch);
export const removeAutoBumpThread = (id: number) => store.removeThread(id);
export const bumpAutoBumpNow = (id: number) => store.bumpNow(id);
export const clearAutoBumpLog = () => store.clearLog();
export const startAutoBump = () => store.start();
