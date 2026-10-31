import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { clientConfig, type EsqiaOptions } from "../shared/config";
import { configured, startDemo } from "./api";
import { CHROME_CSS, Chrome, PAGE_CSS } from "./chrome";

export interface EsqiaProps {
  demo?: EsqiaOptions & { sources: Record<string, string> };
}

export function Esqia({ demo }: EsqiaProps) {
  useEffect(() => {
    if (demo) {
      startDemo(demo.sources, clientConfig(demo));
    } else if (!configured) {
      return;
    }
    const host = document.createElement("esqia-ui");
    const shadow = host.attachShadow({ mode: "open" });
    const chromeStyle = document.createElement("style");
    chromeStyle.textContent = CHROME_CSS;
    const mount = document.createElement("div");
    shadow.append(chromeStyle, mount);
    document.body.append(host);

    const pageStyle = document.createElement("style");
    pageStyle.dataset.esqia = "";
    pageStyle.textContent = PAGE_CSS;
    document.head.append(pageStyle);

    const syncTheme = () => {
      host.dataset.theme = getComputedStyle(
        document.documentElement
      ).colorScheme.includes("dark")
        ? "dark"
        : "light";
    };
    syncTheme();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", syncTheme);
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
      attributes: true,
    });

    const root = createRoot(mount);
    root.render(<Chrome host={host} />);

    return () => {
      media.removeEventListener("change", syncTheme);
      themeObserver.disconnect();
      setTimeout(() => {
        root.unmount();
        host.remove();
        pageStyle.remove();
      }, 0);
    };
  }, [demo]);

  return null;
}
