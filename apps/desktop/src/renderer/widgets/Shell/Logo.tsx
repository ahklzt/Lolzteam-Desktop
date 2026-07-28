import { APP_ICON_DATA_URLS } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { APP_ICON_DATA_URL } from "~/lib/appIcon";

export const Logo = ({ size = 28 }: { size?: number }) => {
  const appIconId = useSettingsStore(
    (s) => s.snapshot?.settings.appIconId ?? 1,
  );
  const src = APP_ICON_DATA_URLS[appIconId - 1] ?? APP_ICON_DATA_URL;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ borderRadius: 8, display: "block", objectFit: "contain" }}
      draggable={false}
    />
  );
};
