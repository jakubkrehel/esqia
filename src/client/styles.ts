export const CHROME_CSS = `
:host {
  all: initial;
  --surface: oklch(1 0 0);
  --hover: oklch(0.972 0 0);
  --line: oklch(0.931 0 0);
  --text: oklch(0.244 0 0);
  --muted: oklch(0.54 0 0);
  --faint: oklch(0.61 0 0);
  --sky: oklch(74.6% 0.16 232.661);
  --outline: var(--sky);
  --expand: cubic-bezier(0.32, 0.72, 0, 1);
  --danger: oklch(0.577 0.245 27.325);
  --success: oklch(0.627 0.194 149.214);
  --shadow: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04);
}
:host([data-theme="dark"]) {
  --surface: oklch(0.178 0 0);
  --hover: oklch(0.213 0 0);
  --line: oklch(0.264 0 0);
  --text: oklch(0.949 0 0);
  --muted: oklch(0.773 0 0);
  --faint: oklch(0.583 0 0);
  --danger: oklch(0.704 0.191 22.216);
  --success: oklch(0.723 0.219 149.579);
  --shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
* { box-sizing: border-box; }
.layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font: 500 14px/1.25 var(--font-sans, -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif);
  -webkit-font-smoothing: antialiased; color: var(--text);
}
.layer > * { pointer-events: auto; }
button { font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
.bar, .toast { --inset-x: 20px; --inset-y: 20px; }
.toast { --inset-y: 68px; }
[data-corner$="left"] { left: calc(var(--inset-x) + env(safe-area-inset-left)); }
[data-corner$="right"] { right: calc(var(--inset-x) + env(safe-area-inset-right)); }
[data-corner^="top"] { top: calc(var(--inset-y) + env(safe-area-inset-top)); }
[data-corner^="bottom"] { bottom: calc(var(--inset-y) + env(safe-area-inset-bottom)); }
.bar {
  position: fixed; touch-action: none; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; padding: 0; border-radius: 9999px;
  background: var(--surface); box-shadow: var(--shadow);
  transition: padding 350ms var(--expand), box-shadow 200ms ease-out;
}
.bar[data-mode="edit"] { padding-inline-end: 4px; }
.bar[data-corner$="right"] { direction: rtl; }
.bar[data-dragging], .bar[data-dragging] * { cursor: grabbing; }
.trigger {
  width: 36px; height: 36px; padding: 0; border: 0; border-radius: 9999px; outline: none;
  display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
  background: transparent; background-clip: content-box; color: var(--muted);
  transition: padding 350ms var(--expand), background-color 200ms ease-out, color 200ms ease-out, transform 150ms ease-out;
}
.trigger:hover { background-color: var(--hover); color: var(--text); }
.trigger:active { transform: scale(0.96); }
.trigger:focus-visible { box-shadow: 0 0 0 4px rgb(0 0 0 / 0.1); }
.bar[data-mode="edit"] .trigger { padding: 4px; color: var(--text); }
.bar[data-mode="edit"] .trigger:focus-visible { box-shadow: inset 0 0 0 4px rgb(0 0 0 / 0.1); }
.tray { display: grid; grid-template-columns: 0fr; transition: grid-template-columns 350ms var(--expand); }
.bar[data-mode="edit"] .tray { grid-template-columns: 1fr; }
.tray-items { min-width: 0; overflow: hidden; display: flex; align-items: center; gap: 4px; }
.tray-items .sep { margin-inline: 4px; }
.action {
  height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap;
  transition: background-color 200ms ease-out, color 200ms ease-out, transform 150ms ease-out;
}
.action:hover:not([aria-disabled="true"]), .action[aria-expanded="true"] { background: var(--hover); color: var(--text); }
.action:active:not([aria-disabled="true"]) { transform: scale(0.96); }
.action[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.count { font-size: 13px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; }
.confirm {
  position: absolute; direction: ltr; bottom: calc(100% + 8px); transform-origin: bottom left;
  padding: 4px; border-radius: 9999px; background: var(--surface); box-shadow: var(--shadow);
  transition: opacity 200ms ease-out, scale 200ms ease-out;
}
.bar[data-corner^="top"] .confirm { top: calc(100% + 8px); bottom: auto; }
.tip {
  position: absolute; bottom: calc(100% + 8px); direction: ltr; pointer-events: none; white-space: nowrap;
  padding: 6px 10px; border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); color: var(--text);
  font-size: 14px; font-weight: 450; line-height: 20px;
  translate: -50% 0; transform-origin: bottom center; opacity: 0; scale: 0.95;
  transition: opacity 150ms ease-out, scale 150ms ease-out;
}
.tip[data-open] { opacity: 1; scale: 1; transition-duration: 200ms; }
.tip kbd { margin-left: 8px; font: inherit; color: var(--faint); }
.tip[data-instant] { transition-duration: 0s; }
@starting-style { .tip[data-open] { opacity: 0; scale: 0.95; } }
.bar[data-corner^="top"] .tip { top: calc(100% + 8px); bottom: auto; transform-origin: top center; }
.bar[data-corner="bottom-right"] .confirm { transform-origin: bottom right; }
.bar[data-corner="top-left"] .confirm { transform-origin: top left; }
.bar[data-corner="top-right"] .confirm { transform-origin: top right; }
@starting-style { .confirm { opacity: 0; scale: 0.96; } }
.confirm button {
  height: 28px; padding: 0 12px 0 10px; border: 0; border-radius: 9999px; white-space: nowrap; cursor: pointer; outline: none;
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--danger); background: color-mix(in oklab, var(--danger) 10%, transparent);
  transition: background-color 200ms ease-out, color 200ms ease-out, transform 150ms ease-out;
}
.confirm button:hover:not(:disabled), .confirm button:focus-visible { background: color-mix(in oklab, var(--danger) 16%, transparent); }
.confirm button:active:not(:disabled) { transform: scale(0.96); }
.confirm button:disabled { cursor: default; color: var(--faint); background: var(--hover); }
.confirm button[data-reverted], .confirm button[data-reverted]:hover { cursor: default; color: var(--success); background: color-mix(in oklab, var(--success) 12%, transparent); }
.swap { display: grid; }
.swap > * { grid-area: 1 / 1; display: grid; opacity: 0; scale: 0.5; filter: blur(2px); transition: opacity 200ms ease-out, scale 200ms ease-out, filter 200ms ease-out; }
.swap > [data-shown] { opacity: 1; scale: 1; filter: none; }
.swatch { width: 12px; height: 12px; border-radius: 9999px; transition: background-color 200ms ease-out; }
.mark { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }
.trigger[data-busy] .mark { animation: pulse 900ms ease-in-out infinite; }
.toast {
  position: fixed; max-width: min(420px, calc(100vw - 40px)); padding: 6px 12px; border-radius: 8px;
  background: var(--surface); box-shadow: var(--shadow); pointer-events: none !important;
}
.toast[data-tone="error"] { color: var(--danger); }
.outline {
  position: fixed; border-radius: 8px; pointer-events: none !important;
  box-shadow: 0 0 0 2px var(--outline);
}
.outline.dragging { background: color-mix(in oklab, var(--outline) 8%, transparent); }
.gutter { position: fixed; display: flex; gap: 2px; }
.gutter button {
  width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent;
  display: grid; place-items: center; padding: 0; color: var(--faint); cursor: pointer;
  transition: background-color 200ms ease-out, color 200ms ease-out;
}
.gutter svg { display: block;
}
.gutter button:hover, .gutter button[data-active] { background: var(--hover); color: var(--text); }
.gutter .grip { cursor: grab; touch-action: none; }
.gutter .grip:active { cursor: grabbing; }
.indicator { position: fixed; height: 2px; border-radius: 1px; background: var(--outline); pointer-events: none !important; }
.panel { position: fixed; background: var(--surface); box-shadow: var(--shadow); }
.toolbar[data-placement^="top"] { transform-origin: bottom center; }
.toolbar[data-placement^="bottom"] { transform-origin: top center; }
.toolbar[data-state="open"] { animation: toolbar-in 36ms linear(0, 0.317 25%, 0.586 50%, 0.811 75%, 1); }
.toolbar[data-state="closed"] { animation: toolbar-out 200ms forwards; pointer-events: none !important; }
@keyframes toolbar-in {
  from { opacity: 0; scale: 0.98; }
  to { opacity: 1; scale: 0.99; }
}
@keyframes toolbar-out {
  0% { opacity: 1; scale: 1; animation-timing-function: linear(0, 0.314 25%, 0.58 50%, 0.8 75%, 1); }
  13% { opacity: 1; scale: 0.99; animation-timing-function: step-start; }
  13.01% { opacity: 1; scale: 0.98; animation-timing-function: linear(0, 0.367 10%, 0.6 20%, 0.747 30%, 0.84 40%, 0.899 50%, 0.936 60%, 0.974 80%, 1); }
  100% { opacity: 0; scale: 0.98; }
}
.toolbar { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 9999px; white-space: nowrap; }
.toolbar button {
  height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 9999px;
  display: inline-grid; place-items: center; background: transparent; color: var(--muted); cursor: pointer;
  transition: background-color 200ms ease-out, color 200ms ease-out;
}
.toolbar button:hover { background: var(--hover); color: var(--text); }
.toolbar button[aria-pressed="true"] { background: var(--hover); color: var(--text); }
.toolbar input {
  height: 32px; width: 260px; padding: 0 12px; border: 0; background: transparent;
  color: inherit; font: inherit; outline: none;
}
.toolbar input::placeholder { color: var(--faint); }
.sep { flex-shrink: 0; width: 1px; height: 16px; margin: 0 4px; background: var(--line); }
.menu {
  min-width: 220px; max-height: 320px; overflow-y: auto; padding: 4px;
  display: flex; flex-direction: column; border-radius: 12px;
  box-shadow: 0 0 0 1px var(--line), 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
.menu button {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent;
  text-align: left; cursor: pointer;
  transition: background-color 200ms ease-out, color 200ms ease-out;
}
.menu button:hover, .menu button[data-active] { background: var(--hover); }
.menu button[data-tone="danger"] { color: var(--danger); }
.hint { color: var(--faint); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes pulse { 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

export const PAGE_CSS = `
[data-esqia-mode="edit"] [data-esqia-type="paragraph"] > *,
[data-esqia-mode="edit"] [data-esqia-type="heading"] > *,
[data-esqia-mode="edit"] [data-esqia-type="code"] > * { cursor: text; }
.esqia-editor { display: contents; }
.esqia-editor > .ProseMirror { font-feature-settings: inherit; font-variant-ligatures: inherit; white-space: pre-wrap; }
.esqia-editor > .ProseMirror { outline: none; caret-color: oklch(74.6% 0.16 232.661); }
[data-esqia-mode="edit"] [data-esqia-type="spacer"] { display: block !important; }
[data-esqia-mode="edit"] [data-esqia-type="spacer"],
.esqia-editor [data-esqia-spacer] { position: relative; }
[data-esqia-mode="edit"] [data-esqia-type="spacer"]::after,
.esqia-editor [data-esqia-spacer]::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 1px dashed currentColor; opacity: 0;
}
[data-esqia-mode="edit"] [data-esqia-type="spacer"]:hover::after,
.esqia-editor [data-esqia-spacer]:hover::after { opacity: 0.15; }
.esqia-editor .ProseMirror-selectednode { outline: 2px solid oklch(74.6% 0.16 232.661); outline-offset: 2px; border-radius: 4px; }
.esqia-editor .ProseMirror-selectednode[data-esqia-spacer]::after { opacity: 0.4; }
.esqia-editor [data-esqia-jsx-block] { margin: 1.5rem 0; }
.esqia-editor [data-esqia-jsx-block] img,
.esqia-editor [data-esqia-jsx-block] video { display: block; max-width: 100%; height: auto; border-radius: 8px; }
.esqia-editor [data-esqia-jsx-block] code {
  display: block; padding: 10px 12px; border-radius: 8px; white-space: pre-wrap;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in oklab, currentColor 6%, transparent);
}
.esqia-editor [data-esqia-jsx-inline] {
  padding: 0 4px; border-radius: 4px; font: 0.8em ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in oklab, currentColor 8%, transparent);
}
.esqia-editor [data-esqia-jsx] { text-decoration: underline dotted; text-underline-offset: 3px; }
.esqia-editor .is-empty::before {
  content: attr(data-placeholder); float: left; height: 0; pointer-events: none; opacity: 0.35;
}
`;
