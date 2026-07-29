import "./styles/global.scss";
import "./styles/forum.css";
import "./styles/settings-effects.scss";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { ChatWindowApp } from "./features/chat/ChatWindowApp";
import { initI18n } from "./i18n";
import { initErrorReporting } from "./lib/error-reporter";
import { useSettingsStore } from "./stores/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

const isChatWindow = window.location.hash.startsWith("#/chat-window");

async function bootstrap() {
  try {
    const snapshot = await window.moderator.settings.get();
    useSettingsStore.getState().setSnapshot(snapshot);
    await initI18n(snapshot.effectiveLocale);
  } catch {
    await initI18n("ru");
  }

  initErrorReporting();

  createRoot(rootEl!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {isChatWindow ? <ChatWindowApp /> : <App />}
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
