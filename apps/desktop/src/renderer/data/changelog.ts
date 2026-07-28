import type { Locale } from "@lzt/shared";

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { ru: string[]; en: string[] };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.0.2",
    date: "2026-07-29",
    changes: {
      ru: [
        "Запуск бета-тестирования приложения",
        "Исправление входа в профиль через модальное окно пользователя",
        "Исправление плагинов приложения",
        "Обновлена логика авторизации и удален вход в окне приложения",
      ],
      en: [
        "Beta testing launch",
        "Fixed opening a user profile from the mini-profile modal",
        "Fixed application plugins",
        "Reworked authorization logic and removed in-app window login",
      ],
    },
  },
  {
    version: "0.0.1",
    date: "2026-07-19",
    changes: {
      ru: ["Начало разработки Lolzteam Desktop"],
      en: ["Started development of Lolzteam Desktop"],
    },
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";

export const formatDate = (iso: string, locale: Locale): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
};
