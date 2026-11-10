import { createRoot } from "react-dom/client";
import { clientConfig } from "../shared/config";
import { Chrome } from "./chrome";
import { demoHost } from "./demo-page";
import type { EsqiaProps } from "./index";
import { liveHost } from "./live-page";
import { CHROME_CSS, PAGE_CSS } from "./styles";

export function mount({ demo, toolbar }: EsqiaProps) {
  const editingHost = demo
    ? demoHost(demo.sources, clientConfig(demo))
    : liveHost;
  const host = document.createElement("esqia-ui");
  const shadow = host.attachShadow({ mode: "open" });
  const chromeStyle = document.createElement("style");
  chromeStyle.textContent = CHROME_CSS;
  const container = document.createElement("div");
  shadow.append(chromeStyle, container);
  const anchor = toolbar ? document.querySelector<HTMLElement>(toolbar) : null;
  (anchor ?? document.body).append(host);

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

  const root = createRoot(container);
  root.render(
    <Chrome editingHost={editingHost} host={host} inline={anchor !== null} />
  );

  return () => {
    media.removeEventListener("change", syncTheme);
    themeObserver.disconnect();
    setTimeout(() => {
      root.unmount();
      host.remove();
      pageStyle.remove();
    }, 0);
  };
}
