import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Trash2,
} from "lucide-react";
import type { Plugin, PluginInput } from "@lzt/shared";
import { Toggle } from "~/widgets/Toggle/Toggle";
import { pushToast } from "~/stores/toast";
import { reloadPlugins } from "./plugin-host";
import { CodeEditor } from "./CodeEditor";
import { PluginsDoc } from "./PluginsDoc";
import styles from "./PluginsPanel.module.scss";

const EMPTY: PluginInput = {
  name: "",
  author: "",
  authorUrl: "",
  description: "",
  code: `// Ваш код плагина. Доступный объект — lzt.
lzt.ui.addTab({
  id: 'hello',
  label: 'Привет',
  icon: '👋',
  render(root) {
    root.innerHTML = '<div style="padding:24px">Привет из плагина!</div>';
  }
});
`,
};

const fmtDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export const PluginsPanel = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PluginInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await window.moderator.plugins.list();
    setPlugins(res.plugins);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [plugins, query]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setMode("editor");
  };

  const openEdit = (p: Plugin) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      author: p.author,
      authorUrl: p.authorUrl,
      description: p.description,
      code: p.code,
    });
    setMode("editor");
  };

  const save = async () => {
    if (!form.name.trim()) {
      pushToast({ kind: "error", title: "Укажите название плагина" });
      return;
    }
    setSaving(true);
    const res = await window.moderator.plugins.save(form, editingId ?? undefined);
    setSaving(false);
    if (!res.ok) {
      pushToast({ kind: "error", title: "Ошибка сохранения", message: res.message });
      return;
    }
    await load();
    await reloadPlugins();
    pushToast({ kind: "success", title: "Плагин сохранён" });
    setMode("list");
  };

  const remove = async (p: Plugin) => {
    await window.moderator.plugins.remove(p.id);
    await load();
    await reloadPlugins();
    pushToast({ kind: "info", title: "Плагин удалён" });
  };

  const toggle = async (p: Plugin, enabled: boolean) => {
    setPlugins((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, enabled } : x)),
    );
    await window.moderator.plugins.toggle(p.id, enabled);
    await reloadPlugins();
  };

  const openAuthor = (url: string) => {
    if (url) window.moderator.app.openExternal(url);
  };

  if (mode === "editor") {
    return (
      <div className={styles.wrap}>
        <div className={styles.editorHead}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setMode("list")}
          >
            <ArrowLeft size={16} />
            <span>Назад к списку</span>
          </button>
          <span className={styles.editorTitle}>
            {editingId ? "Редактирование плагина" : "Новый плагин"}
          </span>
        </div>

        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Название приложения</span>
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Мой плагин"
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span className={styles.label}>Автор</span>
              <input
                className={styles.input}
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Никнейм"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Ссылка на автора</span>
              <input
                className={styles.input}
                value={form.authorUrl}
                onChange={(e) => setForm({ ...form, authorUrl: e.target.value })}
                placeholder="https://lolz.live/username"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Описание</span>
            <input
              className={styles.input}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Краткое описание, что делает плагин"
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Код (JavaScript)</span>
            <CodeEditor
              value={form.code}
              onChange={(code) => setForm({ ...form, code })}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setMode("list")}
            >
              Отмена
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск плагинов…"
          />
        </div>
        <button type="button" className={styles.primaryBtn} onClick={openNew}>
          <Plus size={16} />
          <span>Добавить</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <Puzzle size={28} />
          <p>
            {query
              ? "Ничего не найдено."
              : "Плагинов пока нет. Нажмите «Добавить», чтобы создать первый."}
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {filtered.map((p) => (
            <li key={p.id} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.cardTop}>
                  <span className={styles.cardName}>{p.name}</span>
                  <Toggle
                    checked={p.enabled}
                    onChange={(v) => void toggle(p, v)}
                    ariaLabel="Включить плагин"
                  />
                </div>
                <div className={styles.cardMeta}>
                  {p.authorUrl ? (
                    <button
                      type="button"
                      className={styles.authorBtn}
                      onClick={() => openAuthor(p.authorUrl)}
                    >
                      {p.author || "Автор"}
                      <ExternalLink size={12} />
                    </button>
                  ) : (
                    <span className={styles.author}>{p.author || "Автор"}</span>
                  )}
                  <span className={styles.dot}>·</span>
                  <span className={styles.date}>{fmtDate(p.createdAt)}</span>
                </div>
                {p.description && (
                  <p className={styles.cardDesc}>{p.description}</p>
                )}
              </div>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => openEdit(p)}
                  title="Редактировать"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={() => void remove(p)}
                  title="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PluginsDoc />
    </div>
  );
};
