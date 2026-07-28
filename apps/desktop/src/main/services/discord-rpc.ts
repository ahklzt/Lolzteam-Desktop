import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { join } from "node:path";
import {
  DEFAULT_DISCORD_RPC_SETTINGS,
  DISCORD_APP_ID,
  DISCORD_RPC_MIN_ANIMATION_SEC,
  IPC,
  describePresence,
  type DiscordPresenceActivity,
  type DiscordRpcSettings,
  type DiscordRpcSnapshot,
  type DiscordRpcStatus,
} from "@lzt/shared";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";

const FILE_NAME = "discord-rpc.json";
const settingsFile = () => join(app.getPath("userData"), FILE_NAME);

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

const ipcPath = (id: number): string => {
  if (process.platform === "win32") return `\\\\?\\pipe\\discord-ipc-${id}`;
  const base =
    process.env.XDG_RUNTIME_DIR ||
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    "/tmp";
  return join(base, `discord-ipc-${id}`);
};

const safeParse = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const normButtonUrl = (url: string): string | null => {
  const u = (url || "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(u)) return "https://" + u;
  return null;
};

class DiscordRpc extends EventEmitter {
  private settings: DiscordRpcSettings | null = null;
  private socket: Socket | null = null;
  private connected = false;
  private connecting = false;
  private lastError: string | null = null;
  private activity: DiscordPresenceActivity = { kind: "idle" };
  private startTimestamp = Date.now();
  private readBuf = Buffer.alloc(0);
  private reconnectTimer: NodeJS.Timeout | null = null;
  private animTimer: NodeJS.Timeout | null = null;
  private animStep = 0;
  private nonce = 0;
  private lastActivityJson: string | null = null;

  async load(): Promise<DiscordRpcSettings> {
    if (this.settings) return this.settings;
    try {
      const raw = await fs.readFile(settingsFile(), "utf8");
      const parsed = JSON.parse(raw) as Partial<DiscordRpcSettings>;
      this.settings = {
        ...DEFAULT_DISCORD_RPC_SETTINGS,
        ...parsed,
        animationLines: Array.isArray(parsed.animationLines)
          ? parsed.animationLines.filter(
              (x): x is string => typeof x === "string",
            )
          : [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT")
        log.warn("[discord-rpc] load failed, using defaults", err);
      this.settings = { ...DEFAULT_DISCORD_RPC_SETTINGS };
    }
    return this.settings;
  }

  private async persist(): Promise<void> {
    if (!this.settings) return;
    try {
      const tmp = `${settingsFile()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.settings), { mode: 0o600 });
      await fs.rename(tmp, settingsFile());
    } catch (err) {
      log.warn("[discord-rpc] persist failed", err);
    }
  }

  private status(): DiscordRpcStatus {
    return {
      enabled: this.settings?.enabled ?? false,
      connected: this.connected,
      lastError: this.lastError,
    };
  }

  private snapshot(): DiscordRpcSnapshot {
    return {
      settings: this.settings ?? { ...DEFAULT_DISCORD_RPC_SETTINGS },
      status: this.status(),
    };
  }

  private broadcast(): void {
    const payload = this.snapshot();
    for (const win of BrowserWindow.getAllWindows())
      if (!win.isDestroyed())
        win.webContents.send(IPC.DISCORD_RPC_CHANGED, payload);
  }

  async getSnapshot(): Promise<DiscordRpcSnapshot> {
    await this.load();
    return this.snapshot();
  }

  async setSettings(
    patch: Partial<DiscordRpcSettings>,
  ): Promise<DiscordRpcSnapshot> {
    const s = await this.load();
    const wasEnabled = s.enabled;
    this.settings = { ...s, ...patch };
    this.settings.animationIntervalSec = Math.max(
      DISCORD_RPC_MIN_ANIMATION_SEC,
      Math.floor(
        this.settings.animationIntervalSec || DISCORD_RPC_MIN_ANIMATION_SEC,
      ),
    );
    await this.persist();

    if (this.settings.enabled && !wasEnabled) {
      this.connect();
    } else if (!this.settings.enabled && wasEnabled) {
      this.disconnect("disabled");
    } else if (this.settings.enabled && this.connected) {
      this.restartAnimation();
      this.pushActivity(true);
    }
    this.broadcast();
    return this.snapshot();
  }

  async setActivity(activity: DiscordPresenceActivity): Promise<void> {
    await this.load();
    this.activity = activity ?? { kind: "idle" };
    this.animStep = 0;
    if (this.connected) this.pushActivity(true);
  }

  async reconnect(): Promise<DiscordRpcSnapshot> {
    await this.load();
    if (this.settings?.enabled) {
      this.disconnect("manual-reconnect");
      this.connect();
    }
    return this.snapshot();
  }

  async start(): Promise<void> {
    await this.load();
    if (this.settings?.enabled) this.connect();
    log.info("[discord-rpc] service started");
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.settings?.enabled) return;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => this.connect(), 15_000);
  }

  private connect(): void {
    if (this.connecting || this.connected) return;
    if (!this.settings?.enabled) return;
    this.connecting = true;
    this.tryPipe(0);
  }

  private tryPipe(id: number): void {
    if (id > 9) {
      this.connecting = false;
      this.lastError = "Клиент Discord не найден (запущен ли Discord?)";
      this.scheduleReconnect();
      this.broadcast();
      return;
    }
    const sock = createConnection(ipcPath(id));
    let settled = false;

    sock.on("connect", () => {
      settled = true;
      this.socket = sock;
      this.readBuf = Buffer.alloc(0);
      this.write(OP_HANDSHAKE, { v: 1, client_id: DISCORD_APP_ID });
    });
    sock.on("data", (chunk: Buffer) => this.onData(chunk));
    sock.on("error", () => {
      if (settled) return;
      sock.destroy();
      this.tryPipe(id + 1);
    });
    sock.on("close", () => {
      if (this.socket === sock) this.onDisconnect();
    });
  }

  private write(op: number, data: unknown): void {
    if (!this.socket || this.socket.destroyed) return;
    try {
      this.socket.write(this.encode(op, data));
    } catch (err) {
      log.warn("[discord-rpc] write failed", err);
    }
  }

  private encode(op: number, data: unknown): Buffer {
    const json = Buffer.from(JSON.stringify(data), "utf8");
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(json.length, 4);
    return Buffer.concat([header, json]);
  }

  private onData(chunk: Buffer): void {
    this.readBuf = Buffer.concat([this.readBuf, chunk]);
    while (this.readBuf.length >= 8) {
      const op = this.readBuf.readInt32LE(0);
      const len = this.readBuf.readInt32LE(4);
      if (this.readBuf.length < 8 + len) break;
      const body = this.readBuf.subarray(8, 8 + len).toString("utf8");
      this.readBuf = this.readBuf.subarray(8 + len);
      this.onFrame(op, body);
    }
  }

  private onFrame(op: number, body: string): void {
    if (op === OP_PING) {
      this.write(OP_PONG, body ? safeParse(body) : {});
      return;
    }
    if (op === OP_CLOSE) {
      this.onDisconnect();
      return;
    }
    if (op === OP_FRAME) {
      const msg = safeParse(body) as { evt?: string } | null;
      if (msg && msg.evt === "READY") {
        this.connecting = false;
        this.connected = true;
        this.lastError = null;
        this.startTimestamp = Date.now();
        this.lastActivityJson = null;
        this.restartAnimation();
        this.pushActivity(true);
        this.broadcast();
        log.info("[discord-rpc] connected");
      }
    }
  }

  private onDisconnect(): void {
    const was = this.connected || this.connecting;
    this.connected = false;
    this.connecting = false;
    this.lastActivityJson = null;
    this.stopAnimation();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    if (was) this.broadcast();
    this.scheduleReconnect();
  }

  private disconnect(reason: string): void {
    this.clearReconnect();
    this.stopAnimation();
    this.lastError = null;
    if (this.socket) {
      this.write(OP_FRAME, {
        cmd: "SET_ACTIVITY",
        args: { pid: process.pid, activity: null },
        nonce: String(++this.nonce),
      });
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.connecting = false;
    log.info(`[discord-rpc] disconnected (${reason})`);
  }

  private pushActivity(force = false): void {
    const s = this.settings;
    if (!s || !this.connected) return;

    const detail = s.showDetails ? describePresence(this.activity) : null;
    const details = detail ?? (s.idleDetails || undefined);
    const state = this.animatedState(s);

    const assets: Record<string, string> = {};
    if (s.largeImageKey) assets.large_image = s.largeImageKey;
    if (s.largeImageText) assets.large_text = s.largeImageText;
    if (s.smallImageKey) assets.small_image = s.smallImageKey;
    if (s.smallImageText) assets.small_text = s.smallImageText;

    const buttons: Array<{ label: string; url: string }> = [];
    const addButton = (label: string, url: string): void => {
      const clean = normButtonUrl(url);
      if (label.trim() && clean && buttons.length < 2)
        buttons.push({ label: label.trim().slice(0, 32), url: clean });
    };
    addButton(s.button1Label, s.button1Url);
    addButton(s.button2Label, s.button2Url);

    const activity: Record<string, unknown> = { type: 0 };
    if (details) activity.details = details.slice(0, 128);
    if (state) activity.state = state.slice(0, 128);
    if (s.showElapsed) activity.timestamps = { start: this.startTimestamp };
    if (Object.keys(assets).length > 0) activity.assets = assets;
    if (buttons.length > 0) activity.buttons = buttons;

    const activityJson = JSON.stringify(activity);
    if (!force && activityJson === this.lastActivityJson) return;
    this.lastActivityJson = activityJson;

    this.write(OP_FRAME, {
      cmd: "SET_ACTIVITY",
      args: { pid: process.pid, activity },
      nonce: String(++this.nonce),
    });
  }

  private animatedState(s: DiscordRpcSettings): string {
    switch (s.animation) {
      case "none":
        return s.stateText;
      case "cycle": {
        const lines =
          s.animationLines.length > 0 ? s.animationLines : [s.stateText];
        return lines[this.animStep % lines.length] ?? s.stateText;
      }
      case "typewriter": {
        const text = s.stateText || "";
        if (!text) return text;
        const shown = (this.animStep % text.length) + 1;
        const caret = shown < text.length ? "\u258d" : "";
        return text.slice(0, shown) + caret;
      }
      case "pulse":
      default: {
        const frames = ["\u2726", "\u2727", "\u2729", "\u2727"];
        const mark = frames[this.animStep % frames.length] ?? "\u2726";
        return `${mark} ${s.stateText}`.trim();
      }
    }
  }

  private restartAnimation(): void {
    this.stopAnimation();
    const s = this.settings;
    if (!s || !this.connected) return;
    if (s.animation === "none") return;
    const ms =
      Math.max(DISCORD_RPC_MIN_ANIMATION_SEC, s.animationIntervalSec) * 1000;
    this.animTimer = setInterval(() => {
      this.animStep = (this.animStep + 1) % 100000;
      this.pushActivity();
    }, ms);
  }

  private stopAnimation(): void {
    if (this.animTimer) {
      clearInterval(this.animTimer);
      this.animTimer = null;
    }
  }
}

const rpc = new DiscordRpc();

export const startDiscordRpc = (): Promise<void> => rpc.start();
export const getDiscordRpcSnapshot = (): Promise<DiscordRpcSnapshot> =>
  rpc.getSnapshot();
export const setDiscordRpcSettings = (p: Partial<DiscordRpcSettings>) =>
  rpc.setSettings(p);
export const setDiscordRpcActivity = (a: DiscordPresenceActivity) =>
  rpc.setActivity(a);
export const reconnectDiscordRpc = (): Promise<DiscordRpcSnapshot> =>
  rpc.reconnect();
