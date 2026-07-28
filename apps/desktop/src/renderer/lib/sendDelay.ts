import { useSettingsStore } from "~/stores/settings";
import { pushToast } from "~/stores/toast";

export const applySendDelay = async (): Promise<void> => {
  const s = useSettingsStore.getState().snapshot?.settings;
  if (!s?.delayedSend) return;
  const seconds = Math.max(0, Math.round(s.delayedSendSeconds ?? 0));
  if (seconds <= 0) return;
  pushToast({
    kind: "info",
    title: "Отложенная отправка",
    message: `Отправка через ${seconds} с…`,
  });
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};
