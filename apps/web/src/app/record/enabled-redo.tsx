"use client";

import { useEffect } from "react";

const CSS = `
.action[aria-label="Redo"] { opacity: 1; cursor: pointer; }
.action[aria-label="Redo"]:hover { background: var(--hover); color: var(--text); }
.action[aria-label="Redo"]:active { transform: scale(0.96); }
`;

export function EnabledRedo() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    const attach = () => {
      const shadow = document.querySelector("esqia-ui")?.shadowRoot;
      if (shadow && style.getRootNode() !== shadow) {
        shadow.append(style);
      }
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      style.remove();
    };
  }, []);

  return null;
}
