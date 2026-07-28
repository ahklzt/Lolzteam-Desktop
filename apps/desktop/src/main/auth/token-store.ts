import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import log from "electron-log/main";
import { atomicWrite, backupCorrupt } from "../services/atomic-store";

const FILE_NAME = "token.bin";
const META_NAME = "token.meta";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const tokenFile = () => join(app.getPath("userData"), FILE_NAME);
const metaFile = () => join(app.getPath("userData"), META_NAME);

class TokenStore extends EventEmitter {
  private cached: string | null | undefined = undefined;

  async load(): Promise<string | null> {
    if (this.cached !== undefined) return this.cached;
    try {
      const buf = await fs.readFile(tokenFile());
      let token: string;
      if (!safeStorage.isEncryptionAvailable()) {
        log.warn("[auth] safeStorage unavailable, reading token as plaintext");
        token = buf.toString("utf8");
      } else {
        token = safeStorage.decryptString(buf);
      }

      if (await this.isExpired()) {
        log.info("[auth] сохранённый токен старше месяца — очищаем");
        await this.clear();
        return null;
      }

      this.cached = token;
      return this.cached;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.cached = null;
        return null;
      }
      log.error("[auth] failed to read token", err);
      await backupCorrupt(tokenFile());
      this.cached = null;
      return null;
    }
  }

  private async isExpired(): Promise<boolean> {
    try {
      const raw = await fs.readFile(metaFile(), "utf8");
      const savedAt = Number.parseInt(raw, 10);
      if (!Number.isFinite(savedAt)) return false;
      return Date.now() - savedAt > MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  async save(token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn("[auth] safeStorage unavailable, keeping token in memory only");
      await fs.unlink(tokenFile()).catch(() => {});
      this.cached = token;
      this.emit("change", token);
      return;
    }
    const payload = safeStorage.encryptString(token);
    await atomicWrite(tokenFile(), payload);
    await atomicWrite(metaFile(), String(Date.now()));
    this.cached = token;
    this.emit("change", token);
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(tokenFile());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log.warn("[auth] failed to delete token file", err);
      }
    }
    await fs.unlink(metaFile()).catch(() => {});
    this.cached = null;
    this.emit("change", null);
  }
}

const store = new TokenStore();

export const saveToken = (token: string) => store.save(token);
export const loadToken = () => store.load();
export const clearToken = () => store.clear();
export const onTokenChange = (handler: (token: string | null) => void) => {
  store.on("change", handler);
  return () => store.off("change", handler);
};
