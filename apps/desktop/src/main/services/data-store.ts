import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  DATA_DIRS,
  HISTORY_ENTRY_LIMIT,
  IPC,
  getForumWebBase,
  type DataUsage,
  type HistoryContainer,
  type HistoryEntry,
  type HistoryKind,
  type HistoryMarkers,
  type HistoryObservePayload,
  type HistoryObserveResult,
  type HistoryPage,
  type HistoryQuery,
  type HistorySource,
} from "@lzt/shared";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";
import { atomicWrite } from "./atomic-store";
import { getCachedSettings, getSettings } from "../settings/settings-store";

const dataRoot = () => join(app.getPath("userData"), "data");
const dirPath = (rel: string) => join(dataRoot(), rel);
const indexFile = () => join(dirPath("comment_data"), "history-index.json");
const mediaDir = () => dirPath("cache/media_cache");
const mediaFile = (id: string) => join(mediaDir(), `${id}.webp`);
const snapshotFile = (
  source: HistorySource,
  container: HistoryContainer,
  containerId: number,
) => join(dirPath("threads_data"), `snap-${source}-${container}-${containerId}.json`);

interface SnapItem {
  bodyHtml: string;
  createDate: number | null;
  username: string | null;
  usernameHtml: string | null;
  userId: number | null;
  avatarUrl: string | null;
  title: string | null;
  imageUrls: string[];
  firstSeenAt: number;
}
interface Snapshot {
  items: Record<string, SnapItem>;
  updatedAt: number;
}

const sha1 = (s: string): string => createHash("sha1").update(s).digest("hex");
const mediaIdForUrl = (url: string): string => sha1(url);

const normalizeBody = (html: string): string =>
  (html || "").replace(/\s+/g, " ").trim();

async function ensureDirs(): Promise<void> {
  await fs.mkdir(dataRoot(), { recursive: true });
  for (const d of DATA_DIRS) {
    await fs.mkdir(dirPath(d), { recursive: true }).catch(() => {});
  }
}

class HistoryStore {
  private entries: HistoryEntry[] | null = null;
  private timer: NodeJS.Timeout | null = null;

  async load(): Promise<HistoryEntry[]> {
    if (this.entries) return this.entries;
    try {
      const raw = await fs.readFile(indexFile(), "utf8");
      const parsed = JSON.parse(raw) as HistoryEntry[];
      this.entries = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT")
        log.warn("[data-store] load index failed, using empty", err);
      this.entries = [];
    }
    return this.entries;
  }

  private async persist(): Promise<void> {
    if (!this.entries) return;
    try {
      await fs.mkdir(dirPath("comment_data"), { recursive: true });
      await atomicWrite(indexFile(), JSON.stringify(this.entries));
    } catch (err) {
      log.warn("[data-store] persist index failed", err);
    }
  }

  private async commit(): Promise<void> {
    await this.persist();
    const markers = this.markers();
    for (const win of BrowserWindow.getAllWindows())
      if (!win.isDestroyed()) win.webContents.send(IPC.HISTORY_CHANGED, markers);
  }

  markers(): HistoryMarkers {
    const edited: Record<string, true> = {};
    const deleted: Record<string, true> = {};
    for (const e of this.entries ?? []) {
      const key =
        e.messageId != null ? `m${e.messageId}` : e.postId != null ? `p${e.postId}` : null;
      if (!key) continue;
      if (e.kind === "editedPost" || e.kind === "editedChatMessage") edited[key] = true;
      if (e.kind === "deletedPost" || e.kind === "deletedChatMessage") deleted[key] = true;
    }
    return { edited, deleted };
  }

  query(q: HistoryQuery): HistoryPage {
    let list = [...(this.entries ?? [])];
    if (q.source) list = list.filter((e) => e.source === q.source);
    if (q.kinds && q.kinds.length)
      list = list.filter((e) => q.kinds!.includes(e.kind));
    if (q.search) {
      const needle = q.search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.bodyHtml || "").toLowerCase().includes(needle) ||
          (e.threadTitle || "").toLowerCase().includes(needle) ||
          (e.author.username || "").toLowerCase().includes(needle),
      );
    }
    list.sort((a, b) => b.recordedAt - a.recordedAt);
    const total = list.length;
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 50;
    return { entries: list.slice(offset, offset + limit), total };
  }

  getEntry(id: string): HistoryEntry | null {
    return (this.entries ?? []).find((e) => e.id === id) ?? null;
  }

  private upsert(entry: HistoryEntry): void {
    if (!this.entries) this.entries = [];
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    else this.entries.unshift(entry);
    if (this.entries.length > HISTORY_ENTRY_LIMIT)
      this.entries = this.entries
        .sort((a, b) => b.recordedAt - a.recordedAt)
        .slice(0, HISTORY_ENTRY_LIMIT);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.load();
    this.entries = (this.entries ?? []).filter((e) => e.id !== id);
    await this.commit();
  }

  async clear(kinds?: HistoryKind[]): Promise<void> {
    await this.load();
    if (kinds && kinds.length)
      this.entries = (this.entries ?? []).filter((e) => !kinds.includes(e.kind));
    else this.entries = [];
    await this.commit();
  }

  private async loadSnapshot(
    source: HistorySource,
    container: HistoryContainer,
    containerId: number,
  ): Promise<Snapshot> {
    try {
      const raw = await fs.readFile(
        snapshotFile(source, container, containerId),
        "utf8",
      );
      const parsed = JSON.parse(raw) as Snapshot;
      if (parsed && parsed.items) return parsed;
    } catch {
    }
    return { items: {}, updatedAt: 0 };
  }

  private async saveSnapshot(
    source: HistorySource,
    container: HistoryContainer,
    containerId: number,
    snap: Snapshot,
  ): Promise<void> {
    try {
      await fs.mkdir(dirPath("threads_data"), { recursive: true });
      await atomicWrite(
        snapshotFile(source, container, containerId),
        JSON.stringify(snap),
      );
    } catch (err) {
      log.warn("[data-store] save snapshot failed", err);
    }
  }

  private entryId(kind: HistoryKind, refId: number): string {
    return `${kind}:${refId}`;
  }

  private urlFor(
    source: HistorySource,
    container: HistoryContainer,
    refId: number,
  ): string | null {
    if (source !== "forum") return null;
    const base = getForumWebBase();
    if (container === "threads") return `${base}/threads/${refId}/`;
    return `${base}/posts/${refId}/`;
  }

  async observe(payload: HistoryObservePayload): Promise<HistoryObserveResult> {
    const settings = getCachedSettings() ?? (await getSettings());
    const isThreads = payload.container === "threads";
    const wantDeleted = isThreads
      ? settings.saveDeletedThreads
      : settings.saveDeletedMessages;
    const wantEdited = !isThreads && settings.saveEditHistory;
    if (!wantDeleted && !wantEdited) return { newDeleted: 0, newEdited: 0 };

    await this.load();
    const { source, container, containerId } = payload;
    const snap = await this.loadSnapshot(source, container, containerId);
    const now = Date.now();
    const prev = snap.items;
    const curIds = new Set<string>();
    let newEdited = 0;
    let newDeleted = 0;

    const deletedKind: HistoryKind = isThreads
      ? "deletedThread"
      : source === "chat"
        ? "deletedChatMessage"
        : "deletedPost";
    const editedKind: HistoryKind =
      source === "chat" ? "editedChatMessage" : "editedPost";

    const nextItems: Record<string, SnapItem> = payload.complete ? {} : { ...prev };

    for (const item of payload.items) {
      const key = String(item.id);
      curIds.add(key);
      const before = prev[key];
      const imageUrls = item.imageUrls ?? [];
      const snapItem: SnapItem = {
        bodyHtml: item.bodyHtml,
        createDate: item.createDate,
        username: item.author.username,
        usernameHtml: item.author.usernameHtml,
        userId: item.author.userId,
        avatarUrl: item.author.avatarUrl,
        title: item.title ?? before?.title ?? null,
        imageUrls,
        firstSeenAt: before?.firstSeenAt ?? now,
      };
      nextItems[key] = snapItem;

      if (
        wantEdited &&
        before &&
        normalizeBody(before.bodyHtml) !== normalizeBody(item.bodyHtml)
      ) {
        const id = this.entryId(editedKind, item.id);
        const existing = this.getEntry(id);
        const revisions = existing
          ? [...existing.revisions]
          : [
              {
                bodyHtml: before.bodyHtml,
                at: before.firstSeenAt,
                mediaIds: [],
              },
            ];
        revisions.push({
          bodyHtml: item.bodyHtml,
          at: now,
          mediaIds: imageUrls.map(mediaIdForUrl),
        });
        const entry: HistoryEntry = {
          id,
          kind: editedKind,
          source,
          postId: source === "forum" ? item.id : null,
          threadId: source === "forum" ? containerId : null,
          messageId: source === "chat" ? item.id : null,
          roomId: source === "chat" ? containerId : null,
          threadTitle: payload.threadTitle,
          author: {
            userId: item.author.userId,
            username: item.author.username,
            usernameHtml: item.author.usernameHtml,
            avatarUrl: item.author.avatarUrl,
          },
          bodyHtml: item.bodyHtml,
          mediaIds: imageUrls.map(mediaIdForUrl),
          revisions,
          url: this.urlFor(source, container, item.id),
          createdAt: (item.createDate ?? 0) * 1000,
          firstSeenAt: before.firstSeenAt,
          recordedAt: now,
          updatedAt: now,
        };
        this.upsert(entry);
        newEdited++;
      }
    }

    if (payload.complete && wantDeleted) {
      for (const [key, before] of Object.entries(prev)) {
        if (curIds.has(key)) continue;
        const refId = Number(key);
        if (!Number.isFinite(refId)) continue;
        const id = this.entryId(deletedKind, refId);
        if (this.getEntry(id)) continue;
        const entry: HistoryEntry = {
          id,
          kind: deletedKind,
          source,
          postId: source === "forum" && !isThreads ? refId : null,
          threadId: isThreads ? refId : source === "forum" ? containerId : null,
          messageId: source === "chat" ? refId : null,
          roomId: source === "chat" ? containerId : null,
          threadTitle: isThreads ? before.title ?? before.bodyHtml : payload.threadTitle,
          author: {
            userId: before.userId,
            username: before.username,
            usernameHtml: before.usernameHtml,
            avatarUrl: before.avatarUrl,
          },
          bodyHtml: before.bodyHtml,
          mediaIds: before.imageUrls.map(mediaIdForUrl),
          revisions: [],
          url: this.urlFor(source, container, refId),
          createdAt: (before.createDate ?? 0) * 1000,
          firstSeenAt: before.firstSeenAt,
          recordedAt: now,
          updatedAt: now,
        };
        this.upsert(entry);
        newDeleted++;
      }
    }

    await this.saveSnapshot(source, container, containerId, {
      items: nextItems,
      updatedAt: now,
    });
    if (newEdited > 0 || newDeleted > 0) await this.commit();
    return { newDeleted, newEdited };
  }

  async cacheMedia(url: string, webpBase64: string): Promise<{ id: string }> {
    const id = mediaIdForUrl(url);
    try {
      await fs.mkdir(mediaDir(), { recursive: true });
      const b64 = webpBase64.replace(/^data:[^,]+,/, "");
      await atomicWrite(mediaFile(id), Buffer.from(b64, "base64"));
    } catch (err) {
      log.warn("[data-store] cacheMedia failed", err);
    }
    return { id };
  }

  async getMedia(id: string): Promise<{ dataUrl: string } | null> {
    try {
      const buf = await fs.readFile(mediaFile(id));
      return { dataUrl: `data:image/webp;base64,${buf.toString("base64")}` };
    } catch {
      return null;
    }
  }

  async usage(): Promise<DataUsage> {
    await this.load();
    const categories: Record<string, number> = {};
    let totalBytes = 0;
    let mediaCount = 0;
    const dirSize = async (rel: string): Promise<number> => {
      let sum = 0;
      try {
        const entries = await fs.readdir(dirPath(rel), { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isFile()) {
            const st = await fs.stat(join(dirPath(rel), ent.name)).catch(() => null);
            if (st) {
              sum += st.size;
              if (rel === "cache/media_cache") mediaCount++;
            }
          }
        }
      } catch {
      }
      return sum;
    };
    for (const d of DATA_DIRS) {
      const size = await dirSize(d);
      categories[d] = size;
      totalBytes += size;
    }
    return {
      categories,
      totalBytes,
      mediaCount,
      entryCount: (this.entries ?? []).length,
    };
  }

  async purge(): Promise<number> {
    await this.load();
    const settings = getCachedSettings() ?? (await getSettings());
    const days = settings.historyRetentionDays;
    let removed = 0;
    if (days > 0) {
      const cutoff = Date.now() - days * 86_400_000;
      const before = (this.entries ?? []).length;
      this.entries = (this.entries ?? []).filter((e) => e.recordedAt >= cutoff);
      removed = before - (this.entries ?? []).length;
    }
    try {
      const referenced = new Set<string>();
      for (const e of this.entries ?? []) {
        for (const m of e.mediaIds) referenced.add(m);
        for (const r of e.revisions) for (const m of r.mediaIds) referenced.add(m);
      }
      const files = await fs.readdir(mediaDir()).catch(() => [] as string[]);
      for (const f of files) {
        const id = f.replace(/\.webp$/, "");
        if (!referenced.has(id))
          await fs.unlink(join(mediaDir(), f)).catch(() => {});
      }
    } catch {
    }
    if (removed > 0) await this.commit();
    return removed;
  }

  async start(): Promise<void> {
    await ensureDirs();
    await this.load();
    await this.purge().catch((err) => log.warn("[data-store] purge failed", err));
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(
      () => void this.purge().catch(() => {}),
      24 * 60 * 60 * 1000,
    );
    log.info("[data-store] history storage started");
  }
}

const store = new HistoryStore();

export const startHistory = (): Promise<void> => store.start();
export const queryHistory = (q: HistoryQuery): Promise<HistoryPage> =>
  store.load().then(() => store.query(q));
export const getHistoryEntry = (id: string): Promise<HistoryEntry | null> =>
  store.load().then(() => store.getEntry(id));
export const observeHistory = (
  p: HistoryObservePayload,
): Promise<HistoryObserveResult> => store.observe(p);
export const deleteHistoryEntry = (id: string): Promise<void> =>
  store.deleteEntry(id);
export const clearHistory = (kinds?: HistoryKind[]): Promise<void> =>
  store.clear(kinds);
export const getHistoryMarkers = (): Promise<HistoryMarkers> =>
  store.load().then(() => store.markers());
export const cacheHistoryMedia = (
  url: string,
  webpBase64: string,
): Promise<{ id: string }> => store.cacheMedia(url, webpBase64);
export const getHistoryMedia = (
  id: string,
): Promise<{ dataUrl: string } | null> => store.getMedia(id);
export const getDataUsage = (): Promise<DataUsage> => store.usage();
export const purgeHistory = (): Promise<number> => store.purge();
