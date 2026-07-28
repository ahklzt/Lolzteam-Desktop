import { DEFAULT_AVATAR_PLACEHOLDER } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";

export const useAvatarOverride = (): string | null => {
  const hide = useSettingsStore(
    (s) => s.snapshot?.settings.hideAvatars ?? false,
  );
  const custom = useSettingsStore(
    (s) => s.snapshot?.settings.avatarPlaceholder ?? null,
  );
  if (!hide) return null;
  return custom && custom.length > 0 ? custom : DEFAULT_AVATAR_PLACEHOLDER;
};

export const useAvatarSrc = (
  url: string | null | undefined,
): string | null => {
  const override = useAvatarOverride();
  return override ?? url ?? null;
};
