import { APP_ICON_DATA_URLS } from "@lzt/shared";
import { nativeImage, type NativeImage } from "electron";
import log from "electron-log/main";
import { APP_ICON_DATA_URL } from "./icon-data";

const REMOTE_ICON_URL = "https" + "://lolz.team/public/brand/favicon-32x32.png";

const DEFAULT_ICON_ID = 1;

export const getBundledIcon = (): NativeImage => {
  const url = APP_ICON_DATA_URLS[DEFAULT_ICON_ID - 1];
  if (url) {
    const img = nativeImage.createFromDataURL(url);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createFromDataURL(APP_ICON_DATA_URL);
};

export const getIconById = (id: number): NativeImage => {
  const url = APP_ICON_DATA_URLS[id - 1];
  if (!url) return getBundledIcon();
  const img = nativeImage.createFromDataURL(url);
  return img.isEmpty() ? getBundledIcon() : img;
};

export const fetchRemoteAppIcon = async (): Promise<NativeImage | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(REMOTE_ICON_URL, { signal: controller.signal });
    if (!res.ok) {
      log.warn("[icon] remote favicon http", res.status);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const img = nativeImage.createFromBuffer(buf);
    if (img.isEmpty()) {
      log.warn("[icon] remote favicon decoded empty");
      return null;
    }
    return img;
  } catch (err) {
    log.info("[icon] remote favicon unavailable, using bundled", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
};
