import { create } from "zustand";

export interface PluginTab {
  id: `plugin:${string}`;
  pluginId: string;
  label: string;
  icon?: string;
  render: (root: HTMLElement) => void | Promise<void>;
}

interface PluginTabsState {
  tabs: PluginTab[];
}

export const usePluginTabs = create<PluginTabsState>(() => ({ tabs: [] }));

export const registerPluginTab = (tab: PluginTab): void =>
  usePluginTabs.setState((s) => ({
    tabs: [...s.tabs.filter((t) => t.id !== tab.id), tab],
  }));

export const clearPluginTabs = (): void => usePluginTabs.setState({ tabs: [] });
