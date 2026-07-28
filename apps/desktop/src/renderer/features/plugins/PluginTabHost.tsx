import { useEffect, useRef } from "react";
import { useViewStore } from "~/stores/view";
import { usePluginTabs } from "~/stores/pluginTabs";

export const PluginTabHost = () => {
  const view = useViewStore((s) => s.view);
  const tabs = usePluginTabs((s) => s.tabs);
  const ref = useRef<HTMLDivElement>(null);

  const tab = tabs.find((t) => t.id === view);

  useEffect(() => {
    const root = ref.current;
    if (!root || !tab) return;
    root.innerHTML = "";
    try {
      void tab.render(root);
    } catch (err) {
      console.error("[plugins] ошибка рендера вкладки", err);
    }
    return () => {
      root.innerHTML = "";
    };
  }, [tab, view]);

  if (!tab) {
    return (
      <div style={{ padding: 24, opacity: 0.6 }}>
        Плагин выключен или удалён.
      </div>
    );
  }

  return <div ref={ref} style={{ height: "100%", overflowY: "auto" }} />;
};
