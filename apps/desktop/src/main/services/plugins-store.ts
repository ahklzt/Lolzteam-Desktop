import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "electron";
import log from "electron-log/main";
import type { Plugin, PluginInput } from "@lzt/shared";
import { atomicWrite } from "./atomic-store";

const FILE_NAME = "plugins.json";
const dataFile = () => join(app.getPath("userData"), FILE_NAME);

interface PluginsShape {
  plugins: Plugin[];
  seeded?: boolean;
}

let cached: PluginsShape | null = null;

  const SAMPLE_CODE = `// «Доходы и расходы по дням» — пример плагина для Lolzteam Desktop.
// Показывает, как получать данные через API и добавлять вкладку в сайдбар.

// 1) Стили плагина (можно как угодно много CSS).
lzt.css('.di-wrap{padding:24px;max-width:720px;margin:0 auto}.di-title{font-size:20px;font-weight:700;margin-bottom:16px}.di-day{display:flex;justify-content:space-between;padding:10px 14px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:8px}.di-in{color:#00ba78;font-weight:700}.di-out{color:#ea4c4c;font-weight:700}');

// 2) Добавляем новую вкладку в нижний сайдбар.
lzt.ui.addTab({
  id: 'daily',
  label: 'Доходы/Расходы',
  icon: '💰',
  async render(root) {
    root.innerHTML = '<div class="di-wrap"><div class="di-title">Загрузка платежей…</div></div>';

    // Получаем историю платежей через наш API (main -> lzt.market).
    const res = await lzt.api.market.getPayments({ page: 1 });
    if (!res.ok) {
      root.innerHTML = '<div class="di-wrap">Ошибка: ' + (res.message || res.reason) + '</div>';
      return;
    }

    // Группируем платежи по дню и суммируем приход/расход.
    const byDay = {};
    for (const p of res.page.payments) {
      const day = new Date(p.operation_date * 1000).toLocaleDateString('ru-RU');
      if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
      byDay[day].income += p.incoming_sum || 0;
      byDay[day].expense += p.outgoing_sum || 0;
    }

    // Рисуем результат.
    const rows = Object.keys(byDay).map(function (day) {
      const v = byDay[day];
      return '<div class="di-day"><span>' + day + '</span><span>' +
        '<span class="di-in">+' + v.income.toFixed(2) + '</span>&nbsp;&nbsp;' +
        '<span class="di-out">-' + v.expense.toFixed(2) + '</span></span></div>';
    }).join('');

    root.innerHTML = '<div class="di-wrap"><div class="di-title">Доходы и расходы по дням</div>' +
      (rows || '<div>Нет платежей за первую страницу.</div>') + '</div>';
  }
});

// 3) Можно переводить фразы и вешать обработчики очистки:
// lzt.i18n.set('ru', 'nav.market', 'Мой Маркет');
// lzt.onUnload(() => console.log('плагин выгружен'));
`;

const makeSample = (): Plugin => {
  const now = Date.now();
  return {
    id: randomUUID(),
    name: "Доходы и расходы по дням",
    author: "Lolzteam Desktop",
    authorUrl: "",
    description:
      "Пример плагина: получает историю платежей через API и добавляет вкладку со сводкой доходов/расходов по дням.",
    code: SAMPLE_CODE,
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };
};

const persist = async (data: PluginsShape): Promise<void> => {
  cached = data;
  await atomicWrite(dataFile(), JSON.stringify(data, null, 2));
};

const load = async (): Promise<PluginsShape> => {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<PluginsShape>;
    cached = {
      plugins: Array.isArray(parsed.plugins) ? (parsed.plugins as Plugin[]) : [],
      seeded: parsed.seeded === true,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("[plugins] load failed, using empty", err);
    }
    cached = { plugins: [], seeded: false };
  }
  if (!cached.seeded && cached.plugins.length === 0) {
    cached = { plugins: [makeSample()], seeded: true };
    await persist(cached);
  }
  return cached;
};

const sanitize = (input: Partial<PluginInput>): PluginInput => ({
  name: String(input.name ?? "").trim().slice(0, 120),
  author: String(input.author ?? "").trim().slice(0, 80),
  authorUrl: String(input.authorUrl ?? "").trim().slice(0, 500),
  description: String(input.description ?? "").trim().slice(0, 1000),
  code: String(input.code ?? ""),
});

export const listPlugins = async (): Promise<Plugin[]> => (await load()).plugins;

export const savePlugin = async (
  input: Partial<PluginInput>,
  id?: string,
): Promise<Plugin> => {
  const data = await load();
  const clean = sanitize(input);
  if (!clean.name) throw new Error("Название обязательно");
  const now = Date.now();
  if (id) {
    const idx = data.plugins.findIndex((p) => p.id === id);
    const existing = idx === -1 ? undefined : data.plugins[idx];
    if (!existing) throw new Error("Плагин не найден");
    const updated: Plugin = { ...existing, ...clean, updatedAt: now };
    const nextPlugins = [...data.plugins];
    nextPlugins[idx] = updated;
    await persist({ ...data, plugins: nextPlugins });
    return updated;
  }
  const created: Plugin = {
    id: randomUUID(),
    ...clean,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await persist({ ...data, plugins: [created, ...data.plugins] });
  return created;
};

export const deletePlugin = async (id: string): Promise<void> => {
  const data = await load();
  await persist({ ...data, plugins: data.plugins.filter((p) => p.id !== id) });
};

export const togglePlugin = async (
  id: string,
  enabled: boolean,
): Promise<void> => {
  const data = await load();
  const nextPlugins = data.plugins.map((p) =>
    p.id === id ? { ...p, enabled, updatedAt: Date.now() } : p,
  );
  await persist({ ...data, plugins: nextPlugins });
};
