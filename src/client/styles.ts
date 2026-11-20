import { BLOCK_SELECTOR } from "../shared/wrapper";
import { blockOfType } from "./blocks";
import { PAD } from "./geometry";

export const CHROME_CSS = `
:host {
  all: initial;
  --surface: oklch(1 0 0);
  --hover: oklch(0.972 0 0);
  --menu-hover: oklch(0.955 0 0);
  --toolbar-hover: oklch(0.955 0 0);
  --line: oklch(0.931 0 0);
  --text: oklch(0.244 0 0);
  --muted: oklch(0.54 0 0);
  --faint: oklch(0.61 0 0);
  --key-line: rgb(0 0 0 / 0.06);
  --sky: oklch(74.6% 0.16 232.661);
  --outline: var(--sky);
  --expand: cubic-bezier(0.32, 0.72, 0, 1);
  --danger: oklch(0.577 0.245 27.325);
  --success: oklch(0.627 0.194 149.214);
  --shadow: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04);
  font: 500 14px/1.25 var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  -webkit-font-smoothing: antialiased; color: var(--text);
}
:host([data-theme="dark"]) {
  --surface: oklch(0.215 0 0);
  --hover: oklch(0.24 0 0);
  --menu-hover: oklch(0.268 0 0);
  --toolbar-hover: oklch(0.268 0 0);
  --line: oklch(0.282 0 0);
  --text: oklch(0.949 0 0);
  --muted: oklch(0.773 0 0);
  --faint: oklch(0.583 0 0);
  --key-line: rgb(255 255 255 / 0.08);
  --danger: oklch(0.704 0.191 22.216);
  --success: oklch(0.723 0.219 149.579);
  --shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
* { box-sizing: border-box; }
.layer, .page { pointer-events: none; z-index: 2147483000; }
.layer { position: fixed; inset: 0; }
.page { position: absolute; top: 0; left: 0; }
.layer > *, .page > * { pointer-events: auto; }
button { font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
.bar, .notice { --inset-x: 20px; --inset-y: 20px; }
.notice { --inset-y: 68px; }
[data-corner$="left"] { left: calc(var(--inset-x) + env(safe-area-inset-left)); }
[data-corner$="right"] { right: calc(var(--inset-x) + env(safe-area-inset-right)); }
[data-corner^="top"] { top: calc(var(--inset-y) + env(safe-area-inset-top)); }
[data-corner^="bottom"] { bottom: calc(var(--inset-y) + env(safe-area-inset-bottom)); }
.bar {
  position: fixed; touch-action: none; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; padding: 0; border-radius: 9999px;
  background: var(--surface); box-shadow: var(--shadow);
  transition: box-shadow 200ms ease-out;
}
.bar[data-inline] { position: relative; inset: auto; width: fit-content; }
.bar[data-corner$="right"] { direction: rtl; }
.bar[data-dragging], .bar[data-dragging] * { cursor: grabbing; }
.notice {
  position: fixed; max-width: min(420px, calc(100vw - 40px)); padding: 6px 12px; border-radius: 8px;
  background: var(--surface); box-shadow: var(--shadow); color: var(--danger); pointer-events: none !important;
  font-weight: 450; line-height: 20px; transition: opacity 200ms ease-out, scale 200ms ease-out;
}
@starting-style { .notice { opacity: 0; scale: 0.96; } }
.trigger {
  width: 36px; height: 36px; padding: 0; border: 0; border-radius: 9999px; outline: none;
  display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
  position: relative; isolation: isolate; background: transparent; color: var(--muted);
  transition: color 200ms ease-out, transform 150ms ease-out;
}
.trigger::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
  transition: scale 350ms var(--expand), background-color 200ms ease-out;
}
.trigger:hover { color: var(--text); }
.trigger:hover::before { background-color: var(--hover); }
.trigger:active { transform: scale(0.96); }
.trigger:focus-visible { box-shadow: 0 0 0 2px var(--faint); }
.bar[data-mode="edit"] .trigger { color: var(--text); }
.bar[data-mode="edit"] .trigger::before { scale: calc(28 / 36); }
.bar[data-mode="edit"] .trigger:focus-visible { box-shadow: inset 0 0 0 2px var(--faint); }
.tray {
  display: grid; grid-template-columns: 0fr; align-self: stretch; overflow: clip;
  border-start-end-radius: 9999px; border-end-end-radius: 9999px;
  transition: grid-template-columns 350ms var(--expand);
}
.bar[data-mode="edit"] .tray { grid-template-columns: 1fr; }
.tray-items { min-width: 0; display: flex; align-items: center; gap: 4px; }
.tray-items > :last-child { margin-inline-end: 4px; }
.tray-items .sep { margin-inline: 4px; }
.action {
  height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap;
  transition: color 200ms ease-out, transform 150ms ease-out;
}
.action { position: relative; }
.action::after { content: ""; position: absolute; inset: -4px -2px; }
.sep + .action::after { inset-inline-start: -8px; }
.action:has(+ .sep)::after { inset-inline-end: -8px; }
.action:hover:not([aria-disabled="true"]), .action[aria-expanded="true"] { background: var(--hover); color: var(--text); }
.action:active:not([aria-disabled="true"]) { transform: scale(0.96); }
.action[aria-disabled="true"] { color: color-mix(in oklab, var(--muted) 40%, transparent); cursor: not-allowed; }
.confirm {
  direction: ltr; transform-origin: var(--transform-origin); outline: none;
  padding: 4px; border-radius: 9999px; background: var(--surface); box-shadow: var(--shadow);
  transition: opacity 200ms ease-out, scale 200ms ease-out;
}
.tip {
  direction: ltr; pointer-events: none; white-space: nowrap;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); color: var(--text);
  font-size: 14px; font-weight: 450; line-height: 20px;
  transform-origin: var(--transform-origin); will-change: transform;
  transition: opacity 200ms ease-out, scale 200ms ease-out;
}
:host([data-theme="dark"]) .tip { --surface: oklch(0.195 0 0); }
.tip[data-starting-style], .tip[data-ending-style] { opacity: 0; scale: 0.95; }
.tip[data-ending-style] { transition-duration: 150ms; }
.tip:has(.keys) { padding-right: 6px; }
.tip .keys { display: flex; align-items: center; gap: 4px; }
.tip kbd, .source kbd {
  display: inline-flex; align-items: center; justify-content: center; flex: none; height: 20px; min-width: 20px; padding: 0 4px;
  border: 1px solid var(--surface); border-radius: 6px; background: var(--hover) padding-box; color: var(--muted);
  box-shadow: var(--shadow), inset 0 0 0 1px var(--key-line);
  font-family: inherit; font-size: 11px; font-weight: 450; line-height: 16px; text-transform: uppercase; user-select: none;
}
.tip[data-instant] { transition: none; }
.confirm[data-starting-style] { opacity: 0; scale: 0.96; }
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
.mark { width: 18px; height: 18px; overflow: visible; }
.mark g { transition: transform 350ms var(--expand); }
.bar[data-mode="edit"] .mark-left { transform: translateX(-5px); }
.bar[data-mode="edit"] .mark-right { transform: translateX(5px); }
.trigger[data-busy] .mark-center { animation: pulse 900ms ease-in-out infinite; }
.outline {
  position: absolute; border-radius: 4px; pointer-events: none !important;
  outline: 2px solid var(--outline); outline-offset: ${PAD}px;
}
.tag { transition: opacity 100ms ease-out; }
@starting-style { .tag { opacity: 0; } }
.tag {
  position: fixed; height: 24px; padding: 0 8px; border-radius: 6px; pointer-events: none !important;
  display: flex; align-items: center; white-space: nowrap;
  background: var(--surface); box-shadow: var(--shadow); color: var(--muted);
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.outline.dragging {
  --tint: color-mix(in oklab, var(--outline) 8%, transparent);
  background: var(--tint); box-shadow: 0 0 0 ${PAD}px var(--tint);
}
.gutter { position: absolute; display: flex; gap: 2px; }
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
.indicator { position: absolute; height: 2px; border-radius: 1px; background: var(--outline); pointer-events: none !important; }
.indicator[data-glide] { transition: top 120ms ease-out; }
.panel { position: absolute; background: var(--surface); box-shadow: var(--shadow); }
.toolbar[data-placement^="top"] { transform-origin: bottom center; }
.toolbar[data-placement^="bottom"] { transform-origin: top center; }
.toolbar[data-state="open"] { animation: toolbar-in 150ms ease-out; }
.toolbar[data-state="closed"] { animation: toolbar-out 150ms ease-out forwards; pointer-events: none !important; }
@keyframes toolbar-in { from { opacity: 0; scale: 0.96; } }
@keyframes toolbar-out { to { opacity: 0; scale: 0.96; } }
.toolbar { display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 9999px; white-space: nowrap; }
.toolbar button {
  height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 9999px;
  display: inline-grid; place-items: center; background: transparent; color: var(--muted); cursor: pointer;
  transition: color 200ms ease-out;
}
.toolbar button:hover { background: var(--toolbar-hover); color: var(--text); }
.toolbar button[aria-pressed="true"] { background: var(--hover); color: var(--text); }
.toolbar input {
  height: 32px; width: 284px; padding: 0 12px; text-overflow: ellipsis; border: 0; background: transparent;
  color: inherit; font: inherit; font-weight: 450; outline: none;
}
.toolbar input::placeholder { color: var(--faint); }
.sep { flex-shrink: 0; width: 1px; height: 16px; margin: 0 4px; background: var(--line); }
.menu {
  min-width: 220px; max-height: 320px; overflow-y: auto; padding: 4px;
  display: flex; flex-direction: column; border-radius: 12px;
  background: var(--surface); box-shadow: 0 0 0 1px var(--line), 0 1px 2px 0 rgb(0 0 0 / 0.05); outline: none;
}
.menu[data-placement^="top"] { transform-origin: bottom left; }
.menu[data-placement^="bottom"] { transform-origin: top left; }
.menu[data-state="open"] { animation: menu-in 150ms ease-out; }
.menu[data-side] { transform-origin: var(--transform-origin); transition: transform 150ms ease-out, scale 150ms ease-out, opacity 150ms ease-out; }
.menu[data-starting-style], .menu[data-ending-style] { opacity: 0; scale: 0.95; }
@keyframes menu-in { from { opacity: 0; scale: 0.97; } }
.menu button, .menu [role="menuitem"] {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0;
  height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent;
  text-align: left; cursor: pointer; outline: none;
}
.menu button:hover, .menu button[data-active], .menu [data-highlighted] { background: var(--menu-hover); }
.announce { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.hint { color: var(--faint); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes pulse { 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

export const PAGE_CSS = `
[data-esqia-open] ${BLOCK_SELECTOR}, [data-esqia-open] ${BLOCK_SELECTOR} * { cursor: pointer !important; }
[data-esqia-mode="edit"] ${blockOfType("paragraph")} > *,
[data-esqia-mode="edit"] ${blockOfType("heading")} > *,
[data-esqia-mode="edit"] ${blockOfType("code")} > *,
[data-esqia-mode="edit"] ${blockOfType("list")} > * { cursor: text; }
.esqia-editor { display: contents; }
.esqia-editor > .ProseMirror { font-feature-settings: inherit; font-variant-ligatures: inherit; white-space: pre-wrap; }
.esqia-editor > .ProseMirror { outline: none; caret-color: var(--esqia-outline, oklch(74.6% 0.16 232.661)); }
[data-esqia-mode="edit"] ${blockOfType("spacer")} { display: block !important; }
[data-esqia-mode="edit"] ${blockOfType("spacer")},
.esqia-editor [data-esqia-spacer] { position: relative; }
[data-esqia-mode="edit"] ${blockOfType("spacer")}::after,
.esqia-editor [data-esqia-spacer]::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 1px dashed currentColor; opacity: 0;
}
[data-esqia-mode="edit"] ${blockOfType("spacer")}:hover::after,
.esqia-editor [data-esqia-spacer]:hover::after { opacity: 0.15; }
.esqia-editor .ProseMirror-selectednode { outline: 2px solid var(--esqia-outline, oklch(74.6% 0.16 232.661)); outline-offset: 2px; border-radius: 4px; }
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
