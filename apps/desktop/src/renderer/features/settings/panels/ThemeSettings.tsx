import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import type { AppThemeId, AppThemePalette } from "@lzt/shared";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, X } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import {
  APP_THEMES,
  DEFAULT_CUSTOM_THEME,
  normalizeCustomTheme,
} from "~/theme/app-themes";
import styles from "./ThemeSettings.module.scss";

type PreviewSceneId = "chat" | "messages" | "topics" | "feed" | "market";

interface PreviewTheme {
  id: AppThemeId;
  palette: AppThemePalette;
}

const PREVIEW_SCENES: Array<{ id: PreviewSceneId; label: string }> = [
  { id: "chat", label: "Чат" },
  { id: "messages", label: "Сообщения" },
  { id: "topics", label: "Темы" },
  { id: "feed", label: "Лента" },
  { id: "market", label: "Маркет" },
];

const COLOR_FIELDS: Array<{
  key: Exclude<keyof AppThemePalette, "name">;
  label: string;
}> = [
  { key: "background", label: "Фон приложения" },
  { key: "surface", label: "Основная поверхность" },
  { key: "surfaceRaised", label: "Карточки" },
  { key: "surfaceOverlay", label: "Всплывающие блоки" },
  { key: "text", label: "Основной текст" },
  { key: "textSoft", label: "Дополнительный текст" },
  { key: "textMuted", label: "Приглушённый текст" },
  { key: "accent", label: "Акцент" },
  { key: "accentSoft", label: "Акцент при наведении" },
  { key: "accentDark", label: "Тёмный акцент" },
];

const getPreviewStyle = (palette: AppThemePalette): CSSProperties =>
  ({
    "--preview-bg": palette.background,
    "--preview-surface": palette.surface,
    "--preview-raised": palette.surfaceRaised,
    "--preview-overlay": palette.surfaceOverlay,
    "--preview-text": palette.text,
    "--preview-text-soft": palette.textSoft,
    "--preview-muted": palette.textMuted,
    "--preview-accent": palette.accent,
    "--preview-accent-soft": palette.accentSoft,
    "--preview-border": `color-mix(in srgb, ${palette.text} 12%, transparent)`,
  }) as CSSProperties;

const normalizePickerColor = (value: string, fallback: string): string =>
  /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

const ThemePreviewScene = memo(({ scene }: { scene: PreviewSceneId }) => (
  <div className={styles.previewApp}>
    <div className={styles.previewTopbar}>
      <span className={styles.previewBrand}>Lolzteam Desktop</span>
      <div className={styles.previewTopActions}>
        <span />
        <span />
        <span className={styles.previewAvatar}>L</span>
      </div>
    </div>
    <div className={styles.previewBody}>
      <aside className={styles.previewSidebar}>
        <span className={styles.previewNavActive} />
        <span />
        <span />
        <span />
        <span />
      </aside>
      <main className={styles.previewContent}>
        {scene === "chat" && (
          <div className={styles.chatScene}>
            <div className={styles.chatList}>
              <strong>Чаты</strong>
              {["Moderator", "Команда", "Поддержка", "Новости"].map((name, index) => (
                <div className={index === 0 ? styles.listActive : undefined} key={name}>
                  <span className={styles.miniAvatar}>{name[0]}</span>
                  <span><b>{name}</b><small>Новое сообщение</small></span>
                </div>
              ))}
            </div>
            <div className={styles.conversation}>
              <header><b>Moderator</b><small>в сети</small></header>
              <div className={styles.messages}>
                <span className={styles.messageIncoming}>Привет! Как проходит тестирование?</span>
                <span className={styles.messageOutgoing}>Отлично, новая тема уже применяется.</span>
                <span className={styles.messageIncoming}>Выглядит аккуратно 👍</span>
              </div>
              <div className={styles.composer}>Написать сообщение… <b>➤</b></div>
            </div>
          </div>
        )}

        {scene === "messages" && (
          <div className={styles.messagesScene}>
            <div className={styles.sceneHeading}><span><b>Личные сообщения</b><small>Все диалоги</small></span><button>Создать</button></div>
            {["Обновление приложения", "Вопрос по аккаунту", "Отчёт модерации"].map((title, index) => (
              <div className={styles.mailRow} key={title}>
                <span className={styles.miniAvatar}>{index + 1}</span>
                <span><b>{title}</b><small>Последнее сообщение в диалоге отображается здесь</small></span>
                <time>{index === 0 ? "сейчас" : `${index + 1} ч.`}</time>
              </div>
            ))}
          </div>
        )}

        {scene === "topics" && (
          <div className={styles.topicsScene}>
            <div className={styles.sceneHeading}><span><b>Темы форума</b><small>Популярные обсуждения</small></span><button>Создать тему</button></div>
            {["Большое обновление Lolzteam Desktop", "Полезные инструменты для Маркета", "Обсуждение нового интерфейса"].map((title, index) => (
              <article className={styles.topicCard} key={title}>
                <span className={styles.miniAvatar}>{["L", "M", "D"][index]}</span>
                <span><b>{title}</b><small>Краткое описание темы и последнее сообщение пользователя…</small></span>
                <em>{24 + index * 13}<small>ответов</small></em>
              </article>
            ))}
          </div>
        )}

        {scene === "feed" && (
          <div className={styles.feedScene}>
            <div className={styles.sceneHeading}><span><b>Лента</b><small>Последние события</small></span></div>
            {["God_likeGL опубликовал новую запись", "Обновлена тема приложения"].map((title, index) => (
              <article className={styles.feedCard} key={title}>
                <header><span className={styles.miniAvatar}>{index ? "T" : "G"}</span><span><b>{title}</b><small>{index ? "5 минут назад" : "только что"}</small></span></header>
                <p>Пример публикации с текстом, действиями и визуальным оформлением выбранной темы.</p>
                <footer><span>♡ 12</span><span>◯ 4</span><span>Поделиться</span></footer>
              </article>
            ))}
          </div>
        )}

        {scene === "market" && (
          <div className={styles.marketScene}>
            <div className={styles.sceneHeading}><span><b>Маркет</b><small>Рекомендации для вас</small></span><button>Корзина · 2</button></div>
            <div className={styles.marketGrid}>
              {["Steam", "Telegram", "Игровой аккаунт", "Social Club"].map((title, index) => (
                <article className={styles.productCard} key={title}>
                  <div className={styles.productImage}><span>{title[0]}</span></div>
                  <b>{title}</b>
                  <small>Надёжный продавец · гарантия</small>
                  <footer><strong>{690 + index * 410} ₽</strong><button>Купить</button></footer>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
));

interface ThemeCardProps {
  id: AppThemeId;
  palette: AppThemePalette;
  active: boolean;
  custom?: boolean;
  onApply: () => void;
  onPreview: () => void;
  onEdit?: () => void;
}

const ThemeCard = memo(({
  id,
  palette,
  active,
  custom,
  onApply,
  onPreview,
  onEdit,
}: ThemeCardProps) => (
  <article
    className={`${styles.themeCard} ${active ? styles.themeCardActive : ""}`}
    style={getPreviewStyle(palette)}
  >
    <div className={styles.themeMiniature}>
      <span className={styles.miniBar} />
      <span className={styles.miniSide} />
      <span className={styles.miniPanel} />
      <span className={styles.miniPanelSmall} />
      {custom && (
        <button type="button" className={styles.editThemeButton} onClick={onEdit} aria-label="Изменить свою тему">
          <Pencil size={14} />
        </button>
      )}
    </div>
    <div className={styles.themeMeta}>
      <span>{palette.name}</span>
      {active && <Check size={15} aria-label="Текущая тема" />}
    </div>
    <div className={styles.themeActions}>
      <button type="button" onClick={onApply}>Применить</button>
      <button type="button" onClick={onPreview}>Превью</button>
    </div>
    <span className={styles.themeId}>{id}</span>
  </article>
));

export const ThemeSettings = () => {
  const settings = useSettingsStore((state) => state.snapshot?.settings);
  const patch = useSettingsStore((state) => state.patch);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<AppThemePalette>(DEFAULT_CUSTOM_THEME);
  const draftRef = useRef<AppThemePalette>(DEFAULT_CUSTOM_THEME);
  const editorPreviewRef = useRef<HTMLDivElement>(null);
  const colorCommitTimer = useRef<number | null>(null);

  const activeTheme = settings?.appTheme ?? "dark";
  const customTheme = settings?.customTheme
    ? normalizeCustomTheme(settings.customTheme)
    : null;
  const currentScene = PREVIEW_SCENES[sceneIndex] ?? PREVIEW_SCENES[0]!;

  useEffect(() => {
    if (!previewTheme && !editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPreviewTheme(null);
      setEditorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen, previewTheme]);

  useEffect(
    () => () => {
      if (colorCommitTimer.current !== null) {
        window.clearTimeout(colorCommitTimer.current);
      }
    },
    [],
  );

  const openPreview = (id: AppThemeId, palette: AppThemePalette) => {
    setSceneIndex(0);
    setPreviewTheme({ id, palette });
  };

  const openEditor = () => {
    const next = normalizeCustomTheme(settings?.customTheme);
    draftRef.current = next;
    setDraft(next);
    setEditorOpen(true);
  };

  const applyTheme = (id: AppThemeId) => void patch({ appTheme: id });

  const saveCustomTheme = () => {
    if (colorCommitTimer.current !== null) {
      window.clearTimeout(colorCommitTimer.current);
      colorCommitTimer.current = null;
    }
    const next = normalizeCustomTheme(draftRef.current);
    void patch({ appTheme: "custom", customTheme: next });
    setEditorOpen(false);
  };

  const updateDraftName = (name: string) => {
    const next = { ...draftRef.current, name };
    draftRef.current = next;
    setDraft(next);
  };

  const updateDraftColor = (
    key: Exclude<keyof AppThemePalette, "name">,
    value: string,
  ) => {
    const color = normalizePickerColor(value, DEFAULT_CUSTOM_THEME[key]);
    const next = { ...draftRef.current, [key]: color };
    draftRef.current = next;
    const preview = editorPreviewRef.current;
    if (preview) {
      for (const [property, propertyValue] of Object.entries(getPreviewStyle(next))) {
        if (typeof propertyValue === "string") {
          preview.style.setProperty(property, propertyValue);
        }
      }
    }
    if (colorCommitTimer.current !== null) {
      window.clearTimeout(colorCommitTimer.current);
    }
    colorCommitTimer.current = window.setTimeout(() => {
      setDraft(draftRef.current);
      colorCommitTimer.current = null;
    }, 80);
  };

  const resetDraft = () => {
    draftRef.current = DEFAULT_CUSTOM_THEME;
    setDraft(DEFAULT_CUSTOM_THEME);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionTitle}>Тема приложения</span>
        <span className={styles.sectionDescription}>Меняет тему приложения</span>
      </div>

      <div className={styles.themeGrid}>
        {APP_THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            id={theme.id}
            palette={theme}
            active={activeTheme === theme.id}
            onApply={() => applyTheme(theme.id)}
            onPreview={() => openPreview(theme.id, theme)}
          />
        ))}

        {customTheme ? (
          <ThemeCard
            id="custom"
            palette={customTheme}
            active={activeTheme === "custom"}
            custom
            onApply={() => applyTheme("custom")}
            onPreview={() => openPreview("custom", customTheme)}
            onEdit={openEditor}
          />
        ) : (
          <button type="button" className={styles.addThemeCard} onClick={openEditor}>
            <Plus size={28} />
            <span>Своя тема</span>
          </button>
        )}
      </div>

      {previewTheme && (
        <div className={styles.modalBackdrop} onMouseDown={() => setPreviewTheme(null)}>
          <section className={styles.previewModal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <span><b>Превью: {previewTheme.palette.name}</b><small>{currentScene.label}</small></span>
              <button type="button" onClick={() => setPreviewTheme(null)} aria-label="Закрыть"><X size={19} /></button>
            </header>
            <div className={styles.previewViewport} style={getPreviewStyle(previewTheme.palette)}>
              <ThemePreviewScene scene={currentScene.id} />
            </div>
            <footer className={styles.previewFooter}>
              <button type="button" onClick={() => setSceneIndex((sceneIndex - 1 + PREVIEW_SCENES.length) % PREVIEW_SCENES.length)} aria-label="Предыдущее превью"><ChevronLeft size={18} /></button>
              <div className={styles.previewTabs}>
                {PREVIEW_SCENES.map((scene, index) => (
                  <button
                    type="button"
                    key={scene.id}
                    className={index === sceneIndex ? styles.previewTabActive : undefined}
                    onClick={() => setSceneIndex(index)}
                  >
                    {scene.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSceneIndex((sceneIndex + 1) % PREVIEW_SCENES.length)} aria-label="Следующее превью"><ChevronRight size={18} /></button>
              <button type="button" className={styles.applyPreviewButton} onClick={() => { applyTheme(previewTheme.id); setPreviewTheme(null); }}>Применить</button>
            </footer>
          </section>
        </div>
      )}

      {editorOpen && (
        <div className={styles.modalBackdrop} onMouseDown={() => setEditorOpen(false)}>
          <section className={styles.editorModal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <span><b>Редактор своей темы</b><small>Изменения сразу отображаются в превью</small></span>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Закрыть"><X size={19} /></button>
            </header>
            <div className={styles.editorBody}>
              <div className={styles.editorControls}>
                <label className={styles.nameField}>
                  <span>Название</span>
                  <input value={draft.name} maxLength={40} onChange={(event) => updateDraftName(event.target.value)} />
                </label>
                <div className={styles.colorGrid}>
                  {COLOR_FIELDS.map((field) => (
                    <label className={styles.colorField} key={field.key}>
                      <span>{field.label}</span>
                      <span className={styles.colorControl}>
                        <input
                          type="color"
                          value={normalizePickerColor(
                            draft[field.key],
                            DEFAULT_CUSTOM_THEME[field.key],
                          )}
                          onInput={(event) =>
                            updateDraftColor(field.key, event.currentTarget.value)
                          }
                        />
                        <code>{draft[field.key]}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div
                ref={editorPreviewRef}
                className={styles.editorPreview}
                style={getPreviewStyle(draft)}
              >
                <ThemePreviewScene scene={currentScene.id} />
                <div className={styles.editorSceneTabs}>
                  {PREVIEW_SCENES.map((scene, index) => (
                    <button type="button" key={scene.id} className={index === sceneIndex ? styles.previewTabActive : undefined} onClick={() => setSceneIndex(index)}>{scene.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <footer className={styles.editorFooter}>
              <button type="button" onClick={resetDraft}>Сбросить цвета</button>
              <span />
              <button type="button" onClick={() => setEditorOpen(false)}>Отмена</button>
              <button type="button" className={styles.saveButton} onClick={saveCustomTheme}>Сохранить и применить</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
