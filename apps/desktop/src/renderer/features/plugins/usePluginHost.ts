import { useEffect } from "react";
import { reloadPlugins } from "./plugin-host";

export const usePluginHost = (): void => {
  useEffect(() => {
    void reloadPlugins();
  }, []);
};
