import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EDITABLE } from "../shared/markdown";
import { deleteOps, moveOps } from "../shared/ops";
import { api, type ClientConfig } from "./api";
import { BLOCK_SELECTOR, type Block, blockRect, fileBlocks, readBlock, runAround, textOffsetAt } from "./blocks";
import { markOpen } from "./editor";
import { Run, type RunSnapshot } from "./run";

type Mode = "read" | "edit";
type Rect = { left: number; top: number; width: number; height: number };

const MODE_KEY = "esqe:mode";
const IDLE: RunSnapshot = { saving: false, busy: null, slash: null, selection: 0 };
const noop = () => () => {};

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "edit" ? "edit" : "read";
  } catch {
    return "read";
  }
}

export function Chrome({ host }: { host: HTMLElement }) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [hasBlocks, setHasBlocks] = useState(false);
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [hover, setHover] = useState<{ block: Block; rect: Rect } | null>(null);
  const [drag, setDrag] = useState<{ block: Block; line: Rect | null; target: Block | null; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<{ block: Block; rect: Rect } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [writing, setWriting] = useState(false);

  const runRef = useRef<Run | null>(null);
  const closing = useRef<Promise<void> | null>(null);
  const lastFile = useRef<string | null>(null);
  runRef.current = run;

  const snapshot = useSyncExternalStore(run?.subscribe ?? noop, run?.getSnapshot ?? (() => IDLE), () => IDLE);

  const notify = (text: string, tone: "info" | "error" = "info") => setToast({ text, tone });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "error" ? 5000 : 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    // Sites switch themes with a media query or a class on <html>; the computed color-scheme reflects either.
    const sync = () => {
      host.dataset.theme = getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "dark" : "light";
    };
    sync();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, [host]);

  useEffect(() => {
    api.config().then(setConfig, () => notify("Can't reach the esqe sidecar. Restart `next dev`.", "error"));
  }, []);

  useEffect(() => {
    const check = () => setHasBlocks(document.querySelector(BLOCK_SELECTOR) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
    document.documentElement.dataset.esqeMode = mode;
    if (mode === "read") {
      void closeRun();
      setHover(null);
      setMenu(null);
    }
    return () => {
      delete document.documentElement.dataset.esqeMode;
    };
  }, [mode]);

  async function closeRun() {
    const current = runRef.current;
    if (!current) return closing.current ?? undefined;
    closing.current = current.close().finally(() => {
      closing.current = null;
    });
    return closing.current;
  }

  async function openRun(options: { block: Block; caret?: { x: number; y: number } } | { after: Block }) {
    if (!config) return;
    const anchor = "after" in options ? options.after : options.block;
    const offset = "block" in options && options.caret ? textOffsetAt(anchor.el, options.caret.x, options.caret.y) : null;
    await closeRun();
    if (!anchor.el.isConnected) return;
    const fresh = readBlock(anchor.el);
    const blocks = "after" in options ? [] : runAround(fresh);
    const index = blocks.findIndex((b) => b.el === fresh.el);

    try {
      const next = await Run.open({
        file: fresh.file,
        blocks,
        after: "after" in options ? fresh : undefined,
        caret: index >= 0 ? { index, offset: offset ?? 0 } : undefined,
        config,
        onError: (message) => notify(message, "error"),
        onClose: () => setRun((value) => (value === next ? null : value)),
      });
      lastFile.current = fresh.file;
      setRun(next);
      setHover(null);
      setMenu(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  }

  async function writeOps(block: Block, build: (source: string, blocks: Block[]) => ReturnType<typeof moveOps>) {
    setWriting(true);
    try {
      await closeRun();
      const { source, hash } = await api.source(block.file);
      if (hash !== block.version) throw new Error("The page is behind the file. Wait for it to refresh.");
      const ops = build(source, fileBlocks(block.file));
      if (ops.length) await api.ops(block.file, hash, ops);
      lastFile.current = block.file;
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setWriting(false);
    }
  }

  async function undo() {
    const file = lastFile.current ?? document.querySelector<HTMLElement>(BLOCK_SELECTOR)?.dataset.esqeFile;
    if (!file) return;
    try {
      await api.undo(file);
      notify("Undone");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setMode((value) => (value === "edit" ? "read" : "edit"));
        return;
      }
      if (mode !== "edit" || runRef.current || !mod || event.shiftKey || event.key.toLowerCase() !== "z") return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
      event.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (mode !== "edit") return;
    let frame = 0;
    let pointer = { x: -1, y: -1 };

    const measure = () => {
      frame = 0;
      if (drag) return;
      const block = hitTest(pointer.x, pointer.y);
      const rect = block && blockRect(block.el);
      setHover(block && rect ? { block, rect: toRect(rect) } : null);
    };
    const onMove = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) return;
      pointer = { x: event.clientX, y: event.clientY };
      frame ||= requestAnimationFrame(measure);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) return;
      setMenu(null);
      const current = runRef.current;
      if (current && !current.root.contains(event.target as Node)) void closeRun();
    };

    const onClick = (event: MouseEvent) => {
      if (event.composedPath().includes(host)) return;
      const target = event.target as Element;
      if (runRef.current?.root.contains(target)) {
        if (target.closest("a")) event.preventDefault();
        return;
      }
      const wrapper = target.closest<HTMLElement>(BLOCK_SELECTOR);
      if (!wrapper) return;
      const block = readBlock(wrapper);
      if (!EDITABLE.has(block.type)) return;
      event.preventDefault();
      event.stopPropagation();
      void openRun({ block, caret: { x: event.clientX, y: event.clientY } });
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  });

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, block: Block) => {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY };
    let moved = false;
    setDrag({ block, line: null, target: null, moved: false });

    // On window, not the grip: the gutter unmounts once the drag starts.
    const onMove = (move: PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 4) return;
      moved = true;
      setDrag({ block, ...dropTarget(block, move.clientY), moved: true });
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);
      if (moved) {
        const { target } = dropTarget(block, up.clientY);
        void writeOps(block, (source, blocks) => moveOps(source, blocks, block, target));
      } else {
        const rect = blockRect(block.el);
        if (rect) setMenu({ block, rect: toRect(rect) });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!hasBlocks || !config) return toast ? <Toast {...toast} /> : null;

  const editing = mode === "edit";
  const editor = run?.editor;

  return (
    <div className="layer">
      {editing && hover && !drag && !menu && (
        <>
          <div className="outline" style={box(hover.rect, 4)} />
          <div className="gutter" style={{ left: hover.rect.left - 50, top: hover.rect.top }}>
            <button aria-label="Add a paragraph below" onClick={() => void openRun({ after: hover.block })} type="button">
              <PlusIcon />
            </button>
            <button
              aria-label="Drag to move, click for options"
              className="grip"
              onPointerDown={(event) => startDrag(event, hover.block)}
              type="button"
            >
              <GripIcon />
            </button>
          </div>
        </>
      )}

      {drag?.moved && (() => {
        const rect = blockRect(drag.block.el);
        return rect ? <div className="outline dragging" style={box(toRect(rect), 4)} /> : null;
      })()}
      {drag?.line && <div className="indicator" style={{ left: drag.line.left, top: drag.line.top, width: drag.line.width }} />}

      {menu && (
        <div className="panel menu" style={{ left: menu.rect.left - 50, top: menu.rect.top + 28 }}>
          <MenuItem
            label="Add paragraph below"
            onSelect={() => {
              setMenu(null);
              void openRun({ after: menu.block });
            }}
          />
          <MenuItem
            label="Delete block"
            onSelect={() => {
              setMenu(null);
              void writeOps(menu.block, (source, blocks) => deleteOps(source, blocks, menu.block));
            }}
            tone="danger"
          />
        </div>
      )}

      {editor && run && !snapshot.slash && <Bubble config={config} run={run} tick={snapshot.selection} />}
      {editor && run && snapshot.slash && <Slash config={config} run={run} snapshot={snapshot} />}

      <button
        aria-label={editing ? "Stop editing" : "Edit this page"}
        aria-pressed={editing}
        className="trigger"
        data-busy={snapshot.saving || writing || snapshot.busy ? "" : undefined}
        data-mode={mode}
        onClick={() => setMode(editing ? "read" : "edit")}
        type="button"
      >
        <FeatherIcon />
      </button>
      <div className="label">
        {editing ? "Stop editing" : "Edit page"} <kbd>⌘⇧E</kbd>
      </div>

      {(toast || snapshot.busy) && <Toast text={snapshot.busy ?? toast?.text ?? ""} tone={snapshot.busy ? "info" : (toast?.tone ?? "info")} />}
    </div>
  );
}

function hitTest(x: number, y: number): Block | null {
  let best: { block: Block; area: number } | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const rect = blockRect(el);
    if (!rect) continue;
    if (y < rect.top - 4 || y > rect.bottom + 4 || x < rect.left - 64 || x > rect.right + 16) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { block: readBlock(el), area };
  }
  return best?.block ?? null;
}

function dropTarget(block: Block, y: number): { line: Rect | null; target: Block | null } {
  const siblings = fileBlocks(block.file).filter((b) => b.el.parentElement === block.el.parentElement);
  const own = blockRect(block.el);
  const left = own?.left ?? 0;
  const width = own?.width ?? 0;
  let previousBottom: number | null = null;

  for (const sibling of siblings) {
    const rect = blockRect(sibling.el);
    if (!rect) continue;
    if (y < rect.top + rect.height / 2) {
      const top = previousBottom === null ? rect.top - 6 : (previousBottom + rect.top) / 2 - 1;
      return { line: { left, top, width, height: 2 }, target: sibling };
    }
    previousBottom = rect.bottom;
  }
  return { line: previousBottom === null ? null : { left, top: previousBottom + 6, width, height: 2 }, target: null };
}

function toRect(rect: DOMRect): Rect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function box(rect: Rect, pad: number) {
  return { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
}

function MenuItem({
  label,
  hint,
  active,
  tone,
  onSelect,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  tone?: "danger";
  onSelect(): void;
}) {
  return (
    <button
      data-active={active ? "" : undefined}
      data-tone={tone}
      onClick={onSelect}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      <span>{label}</span>
      {hint && <span className="hint">{hint}</span>}
    </button>
  );
}

function Bubble({ run, config }: { run: Run; config: ClientConfig; tick: number }) {
  const { editor } = run;
  const [linking, setLinking] = useState<string | null>(null);
  const { from, to, empty } = editor.state.selection;
  const inCode = editor.isActive("codeBlock");

  useEffect(() => {
    if (empty) setLinking(null);
  }, [empty]);

  if (empty || inCode || !editor.view.hasFocus() && linking === null) return null;

  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  const top = Math.min(start.top, end.top) - 48;
  const left = Math.max(12, Math.min((start.left + end.right) / 2, window.innerWidth - 12));

  const chain = () => editor.chain().focus();
  const button = (label: ReactNode, name: string, active: boolean, action: () => void) => (
    <button aria-label={name} aria-pressed={active} key={name} onClick={action} onMouseDown={(e) => e.preventDefault()} type="button">
      {label}
    </button>
  );

  const toggleJsxMark = (mark: ClientConfig["marks"][number]) => {
    const type = editor.schema.marks.jsx;
    const instance = type.create({ open: markOpen(mark), close: `</${mark.tag}>`, name: mark.tag });
    const active = editor.isActive("jsx", { open: markOpen(mark) });
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (active) tr.removeMark(from, to, instance);
        else tr.addMark(from, to, instance);
        return true;
      })
      .run();
  };

  return (
    <div className="panel toolbar" style={{ left, top: Math.max(8, top), transform: "translateX(-50%)" }}>
      {linking !== null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (linking.trim()) chain().extendMarkRange("link").setLink({ href: linking.trim() }).run();
            else chain().extendMarkRange("link").unsetLink().run();
            setLinking(null);
          }}
        >
          <input
            aria-label="Link URL"
            autoFocus
            onChange={(event) => setLinking(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLinking(null);
                editor.commands.focus();
              }
            }}
            placeholder="Paste a link, or leave empty to remove"
            value={linking}
          />
        </form>
      ) : (
        <>
          {button("Text", "Text", editor.isActive("paragraph"), () => chain().setParagraph().run())}
          {button("H2", "Heading 2", editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run())}
          {button("H3", "Heading 3", editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run())}
          <span className="sep" />
          {button(<b>B</b>, "Bold", editor.isActive("bold"), () => chain().toggleBold().run())}
          {button(<i>I</i>, "Italic", editor.isActive("italic"), () => chain().toggleItalic().run())}
          {button(<CodeIcon />, "Code", editor.isActive("code"), () => chain().toggleCode().run())}
          {button(<LinkIcon />, "Link", editor.isActive("link"), () =>
            setLinking((editor.getAttributes("link").href as string | undefined) ?? "")
          )}
          {config.marks.length > 0 && <span className="sep" />}
          {config.marks.map((mark) =>
            button(mark.name, mark.name, editor.isActive("jsx", { open: markOpen(mark) }), () => toggleJsxMark(mark))
          )}
        </>
      )}
    </div>
  );
}

interface SlashItem {
  id: string;
  label: string;
  hint?: string;
  apply(run: Run): void;
}

function slashItems(config: ClientConfig, run: Run): SlashItem[] {
  const heading = (level: 1 | 2 | 3) => (r: Run) => {
    r.clearSlashText();
    r.editor.chain().focus().setHeading({ level }).run();
  };
  const pick = (accept: string) => (r: Run) => {
    r.clearSlashText();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void r.insertMedia(file);
    };
    input.click();
  };
  return [
    { id: "text", label: "Text", apply: (r) => r.clearSlashText() },
    { id: "h2", label: "Heading 2", hint: "##", apply: heading(2) },
    { id: "h3", label: "Heading 3", hint: "###", apply: heading(3) },
    { id: "h1", label: "Heading 1", hint: "#", apply: heading(1) },
    {
      id: "code",
      label: "Code block",
      hint: "```",
      apply: (r) => {
        r.clearSlashText();
        r.editor.chain().focus().setCodeBlock().run();
      },
    },
    ...(run.usesSpacers ? [{ id: "spacer", label: "Spacer", hint: "<br />", apply: (r: Run) => r.insertSpacer() }] : []),
    { id: "image", label: "Image", hint: "upload", apply: pick("image/*") },
    { id: "video", label: "Video", hint: "upload", apply: pick("video/*") },
    ...config.snippets.map((snippet) => ({
      id: `snippet:${snippet.name}`,
      label: snippet.name,
      hint: snippet.source.length > 24 ? `${snippet.source.slice(0, 22)}…` : snippet.source,
      apply: (r: Run) => {
        r.clearSlashText();
        r.insertBlock(snippet.source);
      },
    })),
  ];
}

function Slash({ run, config, snapshot }: { run: Run; config: ClientConfig; snapshot: RunSnapshot }) {
  const slash = snapshot.slash;
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const query = slash?.query.trim().toLowerCase() ?? "";
  const items = slashItems(config, run).filter((item) => item.label.toLowerCase().includes(query));

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    run.slashKeys = (event) => {
      if (dismissed || items.length === 0) return false;
      if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        items[active]?.apply(run);
        return true;
      }
      if (event.key === "Escape") {
        setDismissed(true);
        return true;
      }
      return false;
    };
    return () => {
      run.slashKeys = null;
    };
  });

  if (!slash || dismissed || items.length === 0) return null;
  const below = slash.rect.bottom + 6;
  const top = below + 320 > window.innerHeight ? slash.rect.top - 6 : below;

  return (
    <div
      className="panel menu"
      role="listbox"
      style={{ left: slash.rect.left, top, transform: top < below ? "translateY(-100%)" : undefined }}
    >
      {items.map((item, index) => (
        <MenuItem active={index === active} hint={item.hint} key={item.id} label={item.label} onSelect={() => item.apply(run)} />
      ))}
    </div>
  );
}

function Toast({ text, tone }: { text: string; tone: "info" | "error" }) {
  return (
    <div className="toast" data-tone={tone} role="status">
      {text}
    </div>
  );
}

// central-icons IconFeather (round-filled-radius-3-stroke-2), used under Jakub's Central Icons license.
const FeatherIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
    <path
      clipRule="evenodd"
      d="M19.659 6.15104C20.2637 5.01081 20.0195 3.81804 19.2828 3.01152C18.5709 2.2321 17.4389 1.84265 16.2688 2.05967C11.6838 2.91008 8.58259 5.56118 6.65681 9.06061C4.75002 12.5255 4 16.8034 4 21C4 21.5523 4.44772 22 5 22C5.55228 22 6 21.5523 6 21C6 20.3169 6.02104 19.6361 6.06439 18.9615C12.1381 18.9315 15.3042 15.9958 16.7859 13.8402C17.709 12.4972 17.3596 10.9668 16.4649 9.91497C16.6308 9.7779 16.8102 9.62401 16.9979 9.45433C17.8512 8.68296 18.9178 7.54865 19.659 6.15104Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const PlusIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const GripIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 16 16" width="14">
    {[4, 8, 12].flatMap((y) => [<circle cx="6" cy={y} key={`a${y}`} r="1.2" />, <circle cx="10" cy={y} key={`b${y}`} r="1.2" />])}
  </svg>
);

const CodeIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const LinkIcon = () => (
  <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
    <path
      d="M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

// Mirrors the teardown toolbar on jakub.kr: preview-bg surface, shadow-custom ring, ghost buttons.
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
  --danger: oklch(0.577 0.245 27.325);
  --shadow: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06), 0 2px 4px 0 rgb(0 0 0 / 0.04);
  --shadow-hover: 0 0 0 1px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08), 0 2px 4px 0 rgb(0 0 0 / 0.06);
}
:host([data-theme="dark"]) {
  --surface: oklch(0.178 0 0);
  --hover: oklch(0.213 0 0);
  --line: oklch(0.264 0 0);
  --text: oklch(0.949 0 0);
  --muted: oklch(0.773 0 0);
  --faint: oklch(0.583 0 0);
  --danger: oklch(0.704 0.191 22.216);
  --shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
  --shadow-hover: 0 0 0 1px rgb(255 255 255 / 0.13);
}
* { box-sizing: border-box; }
.layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font: 500 14px/1.25 var(--font-sans, -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif);
  -webkit-font-smoothing: antialiased; color: var(--text);
}
.layer > * { pointer-events: auto; }
button { font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
.trigger {
  position: fixed; left: calc(20px + env(safe-area-inset-left)); bottom: calc(20px + env(safe-area-inset-bottom));
  width: 36px; height: 36px; border: 0; border-radius: 9999px; outline: none;
  display: grid; place-items: center; cursor: pointer;
  background: var(--surface); color: var(--muted); box-shadow: var(--shadow);
  transition: box-shadow 150ms ease-out, color 150ms ease-out, transform 150ms ease-out;
}
.trigger:hover { box-shadow: var(--shadow-hover); color: var(--text); }
.trigger:active { transform: scale(0.96); }
.trigger:focus-visible { box-shadow: var(--shadow), 0 0 0 4px rgb(0 0 0 / 0.1); }
.trigger[data-mode="edit"] { color: var(--text); box-shadow: 0 0 0 1.5px var(--sky), var(--shadow); }
.trigger[data-busy] svg { animation: pulse 900ms ease-in-out infinite; }
.label, .toast {
  position: fixed; left: calc(64px + env(safe-area-inset-left)); bottom: calc(23px + env(safe-area-inset-bottom));
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  background: var(--surface); box-shadow: var(--shadow); pointer-events: none !important;
}
.label { opacity: 0; transform: translateX(-4px); transition: opacity 150ms ease-out, transform 150ms ease-out; }
.trigger:hover + .label { opacity: 1; transform: none; }
.toast { max-width: min(420px, calc(100vw - 84px)); white-space: normal; }
.toast[data-tone="error"] { color: var(--danger); }
kbd { font: inherit; color: var(--faint); margin-left: 4px; }
.outline {
  position: fixed; border-radius: 8px; pointer-events: none !important;
  box-shadow: 0 0 0 1px var(--sky);
}
.outline.dragging { background: color-mix(in oklab, var(--sky) 8%, transparent); }
.gutter { position: fixed; display: flex; gap: 2px; }
.gutter button {
  width: 22px; height: 24px; border: 0; border-radius: 6px; background: transparent;
  display: grid; place-items: center; color: var(--faint); cursor: pointer;
}
.gutter button:hover { background: var(--hover); color: var(--text); }
.gutter .grip { cursor: grab; touch-action: none; }
.gutter .grip:active { cursor: grabbing; }
.indicator { position: fixed; height: 2px; border-radius: 1px; background: var(--sky); pointer-events: none !important; }
.panel { position: fixed; background: var(--surface); box-shadow: var(--shadow); }
.toolbar { display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 9999px; white-space: nowrap; }
.toolbar button {
  height: 32px; min-width: 32px; padding: 0 10px; border: 0; border-radius: 9999px;
  display: inline-grid; place-items: center; background: transparent; color: var(--muted); cursor: pointer;
}
.toolbar button:hover { background: var(--hover); color: var(--text); }
.toolbar button[aria-pressed="true"] { background: var(--hover); color: var(--text); }
.toolbar input {
  height: 32px; width: 260px; padding: 0 12px; border: 0; background: transparent;
  color: inherit; font: inherit; outline: none;
}
.toolbar input::placeholder { color: var(--faint); }
.sep { width: 1px; height: 16px; margin: 0 4px; background: var(--line); }
.menu {
  min-width: 220px; max-height: 320px; overflow-y: auto; padding: 4px;
  display: flex; flex-direction: column; border-radius: 12px;
  box-shadow: 0 0 0 1px var(--line), 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
.menu button {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent;
  text-align: left; cursor: pointer;
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
[data-esqe-mode="edit"] [data-esqe-type="paragraph"] > *,
[data-esqe-mode="edit"] [data-esqe-type="heading"] > *,
[data-esqe-mode="edit"] [data-esqe-type="code"] > * { cursor: text; }
.esqe-editor { display: contents; }
/* Tiptap's own .ProseMirror rule turns off font features and keeps trailing spaces, which changes glyph widths and wrapping. */
.esqe-editor > .ProseMirror { font-feature-settings: inherit; font-variant-ligatures: inherit; white-space: pre-wrap; }
.esqe-editor > .ProseMirror { outline: none; caret-color: oklch(74.6% 0.16 232.661); }
.esqe-editor [data-esqe-spacer] { position: relative; }
.esqe-editor [data-esqe-spacer]::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 1px dashed currentColor; opacity: 0; transition: opacity 150ms ease-out;
}
.esqe-editor [data-esqe-spacer]:hover::after { opacity: 0.15; }
.esqe-editor .ProseMirror-selectednode { outline: 2px solid oklch(74.6% 0.16 232.661); outline-offset: 2px; border-radius: 4px; }
.esqe-editor .ProseMirror-selectednode[data-esqe-spacer]::after { opacity: 0.4; }
.esqe-editor [data-esqe-jsx-block] { margin: 1.5rem 0; }
.esqe-editor [data-esqe-jsx-block] img,
.esqe-editor [data-esqe-jsx-block] video { display: block; max-width: 100%; height: auto; border-radius: 8px; }
.esqe-editor [data-esqe-jsx-block] code {
  display: block; padding: 10px 12px; border-radius: 8px; white-space: pre-wrap;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in oklab, currentColor 6%, transparent);
}
.esqe-editor [data-esqe-jsx-inline] {
  padding: 0 4px; border-radius: 4px; font: 0.8em ui-monospace, SFMono-Regular, Menlo, monospace;
  background: color-mix(in oklab, currentColor 8%, transparent);
}
.esqe-editor [data-esqe-jsx] { text-decoration: underline dotted; text-underline-offset: 3px; }
.esqe-editor .is-empty::before {
  content: attr(data-placeholder); float: left; height: 0; pointer-events: none; opacity: 0.35;
}
`;
