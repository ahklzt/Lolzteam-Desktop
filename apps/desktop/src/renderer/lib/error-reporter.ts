import { useSettingsStore } from "../stores/settings";
import { useViewStore } from "../stores/view";

const REPORT_DEDUPLICATION_MS = 10_000;

const reportedErrors = new WeakSet<Error>();
let initialized = false;
let lastSignature = "";
let lastSubmittedAt = 0;

const serializeError = (error: unknown): string => {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join("\n");
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const currentView = (): string => {
  if (window.location.hash.startsWith("#/chat-window")) return "chat";
  return useViewStore.getState().view;
};

export const reportRendererError = (error: unknown, details?: string | null): void => {
  if (useSettingsStore.getState().snapshot?.settings.errorReports === false) return;
  if (error instanceof Error) {
    if (reportedErrors.has(error)) return;
    reportedErrors.add(error);
  }

  const serialized = [serializeError(error), details?.trim()].filter(Boolean).join("\n\n");
  if (!serialized) return;

  const view = currentView();
  const signature = `${view}\n${serialized}`;
  const now = Date.now();
  if (signature === lastSignature && now - lastSubmittedAt < REPORT_DEDUPLICATION_MS) return;
  lastSignature = signature;
  lastSubmittedAt = now;

  void window.moderator.profile
    .submitErrorReport({ view, error: serialized, occurredAt: now })
    .catch((submitError: unknown) => {
      console.warn("[error-report] не удалось отправить отчет", submitError);
    });
};

export const initErrorReporting = (): void => {
  if (initialized) return;
  initialized = true;
  window.addEventListener("error", (event) => {
    reportRendererError(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportRendererError(event.reason);
  });
};
