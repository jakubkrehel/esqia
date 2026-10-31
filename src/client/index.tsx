import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { configured } from "./api";
import { CHROME_CSS, Chrome, PAGE_CSS } from "./chrome";

/**
 * Mount once in the root layout during development. Renders nothing unless
 * `withEsqia` started the sidecar and the page has MDX blocks.
 */
export function Esqia() {
  useEffect(() => {
    if (!configured) {
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

    // Sites switch themes with a media query or a class on <html>; the computed color-scheme reflects either.
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

    // A separate root, so React attaches its listeners inside the shadow root and events keep their real targets.
    const root = createRoot(mount);
    root.render(<Chrome host={host} />);

    return () => {
      // The layout can unmount this while React is mid-render; unmounting a second root synchronously there throws a warning.
      media.removeEventListener("change", syncTheme);
      themeObserver.disconnect();
      setTimeout(() => {
        root.unmount();
        host.remove();
        pageStyle.remove();
      }, 0);
    };
  }, []);

  return null;
}
