import { cpSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { LZT_CONFIG } from "@lzt/shared";
import { app } from "electron";

const LEGACY_DIR_NAMES = [
  "lzt-moderator",
  "LZT Moderation",
  "LZT Moderator",
  "Lolzteam Desktop Utils",
  "lzt-desktop",
  "@lzt/desktop",
  "desktop",
];

const migrateLegacyUserData = (target: string): void => {
  if (existsSync(target)) return;
  const parent = dirname(target);
  for (const name of LEGACY_DIR_NAMES) {
    const legacy = join(parent, name);
    if (!existsSync(legacy)) continue;
    try {
      renameSync(legacy, target);
      return;
    } catch {
      try {
        cpSync(legacy, target, { recursive: true });
        return;
      } catch {
        continue;
      }
    }
  }
};

export const setupAppIdentity = (): void => {
  app.setName(LZT_CONFIG.appName);
  app.setAppUserModelId(LZT_CONFIG.appId);
  const userData = join(app.getPath("appData"), LZT_CONFIG.appName);
  migrateLegacyUserData(userData);
  app.setPath("userData", userData);
  app.setPath("sessionData", userData);
};
