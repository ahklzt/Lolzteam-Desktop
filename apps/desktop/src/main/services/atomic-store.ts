import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import log from "electron-log/main";

const REPLACE_RETRY_DELAYS = [20, 60, 140, 300] as const;
const RETRYABLE_REPLACE_ERRORS = new Set(["EACCES", "EBUSY", "EPERM"]);

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const replaceFile = async (
  tmp: string,
  file: string,
  mode: number,
): Promise<void> => {
  for (const delay of REPLACE_RETRY_DELAYS) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !RETRYABLE_REPLACE_ERRORS.has(code)) throw error;
      await wait(delay);
    }
  }

  await fs.copyFile(tmp, file);
  await fs.chmod(file, mode).catch(() => {});
};

export const atomicWrite = async (
  file: string,
  data: string | Buffer,
  mode = 0o600,
): Promise<void> => {
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tmp, data, { mode });
    await replaceFile(tmp, file, mode);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
};

export const backupCorrupt = async (file: string): Promise<void> => {
  const backup = `${file}.corrupt-${Date.now()}`;
  try {
    await fs.rename(file, backup);
    log.warn(`[store] битый файл отложен как ${backup}`);
  } catch (err) {
    log.warn(`[store] не удалось отложить битый файл ${file}`, err);
  }
};
