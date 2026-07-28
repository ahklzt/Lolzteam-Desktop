import type { Plugin } from "@lzt/shared";
import { clearPluginTabs } from "~/stores/pluginTabs";
import { createPluginSdk, type PluginCleanup } from "./plugin-sdk";

const active = new Map<string, PluginCleanup>();

const unloadAll = (): void => {
  for (const cleanup of active.values()) {
    for (const fn of cleanup.unloaders) {
      try {
        fn();
      } catch (err) {
        console.warn("[plugins] ошибка в onUnload", err);
      }
    }
    for (const el of cleanup.styles) el.remove();
  }
  active.clear();
  clearPluginTabs();
};

export const runPlugins = (plugins: Plugin[]): void => {
  unloadAll();
  for (const p of plugins) {
    if (!p.enabled) continue;
    const cleanup: PluginCleanup = { styles: [], unloaders: [], tabIds: [] };
    active.set(p.id, cleanup);
    const sdk = createPluginSdk(p.id, cleanup);
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("lzt", `"use strict";\n${p.code}`);
      fn(sdk);
    } catch (err) {
      console.error(`[plugin:${p.id}] Ошибка выполнения`, err);
    }
  }
};

export const reloadPlugins = async (): Promise<void> => {
  try {
    const { plugins } = await window.moderator.plugins.list();
    runPlugins(plugins);
  } catch (err) {
    console.error("[plugins] не удалось загрузить список", err);
  }
};
