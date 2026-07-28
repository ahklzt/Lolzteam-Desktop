import { i18n } from "~/i18n";
import { pushToast } from "~/stores/toast";
import { registerPluginTab } from "~/stores/pluginTabs";

export interface PluginCleanup {
  styles: HTMLStyleElement[];
  unloaders: Array<() => void>;
  tabIds: string[];
}

export interface PluginTabDef {
  id: string;
  label: string;
  icon?: string;
  render: (root: HTMLElement) => void | Promise<void>;
}

export interface PluginSdk {
  api: typeof window.moderator;
  log: (...args: unknown[]) => void;
  notify: (title: string, message?: string) => void;
  css: (text: string) => HTMLStyleElement;
  i18n: {
    set: (lng: string, key: string, value: string) => void;
    setMany: (lng: string, resources: Record<string, unknown>) => void;
    t: (key: string) => string;
  };
  ui: {
    addTab: (def: PluginTabDef) => string;
  };
  storage: {
    get: <T = unknown>(key: string) => T | null;
    set: (key: string, value: unknown) => void;
    remove: (key: string) => void;
  };
  onUnload: (fn: () => void) => void;
}

export const createPluginSdk = (
  pluginId: string,
  cleanup: PluginCleanup,
): PluginSdk => {
  const prefix = `plugin:${pluginId}:`;
  return {
    api: window.moderator,
    log: (...args) => console.log(`[${prefix}]`, ...args),
    notify: (title, message) =>
      pushToast({ kind: "info", title, message: message ?? "" }),
    css: (text) => {
      const el = document.createElement("style");
      el.dataset.plugin = pluginId;
      el.textContent = text;
      document.head.appendChild(el);
      cleanup.styles.push(el);
      return el;
    },
    i18n: {
      set: (lng, key, value) => i18n.addResource(lng, "translation", key, value),
      setMany: (lng, resources) =>
        i18n.addResources(lng, "translation", resources),
      t: (key) => i18n.t(key),
    },
    ui: {
      addTab: (def) => {
        const fullId = `plugin:${pluginId}:${def.id}` as const;
        registerPluginTab({
          id: fullId,
          pluginId,
          label: def.label,
          icon: def.icon,
          render: def.render,
        });
        cleanup.tabIds.push(fullId);
        return fullId;
      },
    },
    storage: {
      get: <T = unknown>(key: string): T | null => {
        const raw = localStorage.getItem(prefix + key);
        if (raw == null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return null;
        }
      },
      set: (key, value) =>
        localStorage.setItem(prefix + key, JSON.stringify(value)),
      remove: (key) => localStorage.removeItem(prefix + key),
    },
    onUnload: (fn) => cleanup.unloaders.push(fn),
  };
};
