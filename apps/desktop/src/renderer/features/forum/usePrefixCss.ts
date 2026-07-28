import { useEffect } from "react";
import type { ForumPrefixCssResult } from "@lzt/shared";

let injected = false;

export const usePrefixCss = (): void => {
  useEffect(() => {
    if (injected) return;
    injected = true;
    void (async () => {
      try {
        const bridge = window.moderator.forum as unknown as {
          getPrefixCss: () => Promise<ForumPrefixCssResult>;
        };
        const res = await bridge.getPrefixCss();
        if (!res.ok || !res.css) {
          injected = false;
          return;
        }
        if (document.getElementById("lzt-thread-prefixes")) return;
        const el = document.createElement("style");
        el.id = "lzt-thread-prefixes";
        el.textContent = res.css;
        document.head.appendChild(el);
      } catch {
        injected = false;
      }
    })();
  }, []);
};
