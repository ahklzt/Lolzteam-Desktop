import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import log from "electron-log/main";

export const atomicWrite = async (
  file: string,
  data: string | Buffer,
  mode = 0o600,
): Promise<void> => {
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tmp, data, { mode });
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
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
