import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EDITABLE } from "../shared/markdown";
import { deleteOps, moveOps, type Op } from "../shared/ops";
import { api, type ClientConfig } from "./api";
import {
  BLOCK_SELECTOR,
  type Block,
  blockRect,
  fileBlocks,
  readBlock,
  runAround,
  textOffsetAt,
} from "./blocks";
import { markOpen } from "./editor";
import { Run, type RunSnapshot } from "./run";

type Mode = "read" | "edit";
interface Rect {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface Geometry {
  handleTop: number;
  radius: number;
  rect: Rect;
}
interface Hover extends Geometry {
  block: Block;
}

const PAD = 4;
const HANDLE = 24;
const HANDLE_GAP = 4;
interface Drag {
  block: Block;
  line: Rect | null;
  moved: boolean;
}
type Toast = { text: string; tone: "info" | "error" } | null;
type OpenTarget =
  | { block: Block; caret?: { x: number; y: number } }
  | { after: Block };

const MODE_KEY = "esqia:mode";
const IDLE: RunSnapshot = {
  busy: null,
  saving: false,
  selection: 0,
  slash: null,
};
const unsubscribed = () => () => undefined;

function saveMode(mode: Mode): boolean {
  try {
    localStorage.setItem(MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "edit" ? "edit" : "read";
  } catch {
    return "read";
  }
}

function subscribeToBlocks(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

const pageHasBlocks = () => document.querySelector(BLOCK_SELECTOR) !== null;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function Chrome({ host }: { host: HTMLElement }) {
  const [mode, setMode] = useState<Mode>(readMode);
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [writing, setWriting] = useState(false);
  const [changed, setChanged] = useState(0);
  const refreshChanges = () => {
    api
      .changes()
      .then(({ files }) => setChanged(files.length))
      .catch(() => setChanged(0));
  };
  const hasBlocks = useSyncExternalStore(
    subscribeToBlocks,
    pageHasBlocks,
    () => false
  );
  const snapshot = useSyncExternalStore(
    run?.subscribe ?? unsubscribed,
    run?.getSnapshot ?? (() => IDLE),
    () => IDLE
  );

  const runRef = useRef<Run | null>(null);
  const closing = useRef<Promise<void> | null>(null);
  const lastFile = useRef<string | null>(null);
  const runs = useRef(new Set<Run>());
  const demoNoted = useRef(false);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const notify = (text: string, tone: "info" | "error" = "info") =>
    setToast({ text, tone });

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(
      () => setToast(null),
      toast.tone === "error" ? 5000 : 1600
    );
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    api
      .changes()
      .then(({ files }) => setChanged(files.length))
      .catch(() => setChanged(0));
  }, []);

  async function revertAll() {
    await closeRun();
    try {
      const { reverted, skipped } = await api.revert();
      setChanged(0);
      if (skipped.length > 0) {
        notify(
          `Reverted ${reverted.length} ${reverted.length === 1 ? "file" : "files"}. Skipped ${skipped.join(", ")}, changed in your editor since.`,
          "error"
        );
      } else if (reverted.length > 0) {
        notify(
          `Reverted ${reverted.length} ${reverted.length === 1 ? "file" : "files"}`
        );
      }
    } catch (error) {
      notify(errorText(error), "error");
    }
  }

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() =>
        setToast({
          text: "Can't reach the esqia sidecar. Restart `next dev`.",
          tone: "error",
        })
      );
  }, []);

  function closeRun(): Promise<void> {
    const current = runRef.current;
    if (!current) {
      return closing.current ?? Promise.resolve();
    }
    closing.current = current.close().finally(() => {
      closing.current = null;
    });
    return closing.current;
  }

  useEffect(() => {
    saveMode(mode);
    document.documentElement.dataset.esqiaMode = mode;
    if (mode === "read") {
      closeRun();
    }
    for (const parked of runs.current) {
      parked.setEditable(mode === "edit");
    }
    return () => {
      delete document.documentElement.dataset.esqiaMode;
    };
  }, [mode]);

  async function openRun(target: OpenTarget) {
    if (!config) {
      return;
    }
    const anchor = "after" in target ? target.after : target.block;
    const offset =
      "block" in target && target.caret
        ? textOffsetAt(anchor.el, target.caret.x, target.caret.y)
        : null;
    await closeRun();
    if (!anchor.el.isConnected) {
      return;
    }
    const fresh = readBlock(anchor.el);
    const blocks = "after" in target ? [] : runAround(fresh);
    const index = blocks.findIndex((b) => b.el === fresh.el);

    try {
      const next = await Run.open({
        after: "after" in target ? fresh : undefined,
        blocks,
        caret: index >= 0 ? { index, offset: offset ?? 0 } : undefined,
        config,
        file: fresh.file,
        onClose: () => setRun((value) => (value === next ? null : value)),
        onError: (message) => notify(message, "error"),
        onFocus: (focused) => setRun(focused),
        onSaved: refreshChanges,
      });
      runs.current.add(next);
      lastFile.current = fresh.file;
      setRun(next);
      if (!(api.live || demoNoted.current)) {
        demoNoted.current = true;
        notify(
          "Edits stay in this tab. Install esqia to save them to your files."
        );
      }
    } catch (error) {
      notify(errorText(error), "error");
    }
  }

  async function writeOps(
    el: HTMLElement,
    build: (source: string, blocks: Block[], block: Block) => Op[],
    showOnPage: (ops: Op[], block: Block, blocks: Block[]) => void
  ) {
    setWriting(true);
    try {
      await closeRun();
      const block = readBlock(el);
      const { source, hash } = await api.source(block.file);
      if (api.live && hash !== block.version) {
        throw new Error("The page is behind the file. Wait for it to refresh.");
      }
      const blocks = fileBlocks(block.file);
      const ops = build(source, blocks, block);
      if (ops.length > 0) {
        await api.ops(block.file, hash, ops);
        if (!api.live) {
          showOnPage(ops, block, blocks);
        }
      }
      lastFile.current = block.file;
      refreshChanges();
    } catch (error) {
      notify(errorText(error), "error");
    } finally {
      setWriting(false);
    }
  }

  async function undo() {
    if (!api.live) {
      return;
    }
    const file =
      lastFile.current ??
      document.querySelector<HTMLElement>(BLOCK_SELECTOR)?.dataset.esqiaFile;
    if (!file) {
      return;
    }
    try {
      await api.undo(file);
      refreshChanges();
      notify("Undone");
    } catch (error) {
      notify(errorText(error), "error");
    }
  }

  useShortcuts({
    editing: mode === "edit",
    hasRun: () => runRef.current !== null,
    onToggle: () => setMode(toggled),
    onUndo: undo,
  });

  if (!(hasBlocks && config)) {
    return toast ? <Status {...toast} /> : null;
  }

  const editing = mode === "edit";
  const busy = snapshot.saving || writing || snapshot.busy !== null;
  const status = snapshot.busy
    ? { text: snapshot.busy, tone: "info" as const }
    : toast;

  return (
    <div className="layer">
      {editing && (
        <BlockControls
          host={host}
          onActivate={(target) => openRun(target)}
          onBreak={(block) =>
            writeOps(
              block.el,
              (_source, _blocks, fresh) => [
                { end: fresh.end, expected: "", start: fresh.end, text: BREAK },
              ],
              (_ops, fresh) => breakOnPage(fresh)
            )
          }
          onDelete={(block) =>
            writeOps(
              block.el,
              (source, blocks, fresh) => deleteOps(source, blocks, fresh),
              (_ops, fresh) => removeFromPage(fresh)
            )
          }
          onMove={(block, target) =>
            writeOps(
              block.el,
              (source, blocks, fresh) =>
                moveOps(source, blocks, fresh, target && readBlock(target.el)),
              (ops, fresh, blocks) =>
                moveOnPage(ops, fresh, target && readBlock(target.el), blocks)
            )
          }
          onOutside={() => closeRun()}
          run={run}
        />
      )}
      {run &&
        (snapshot.slash ? (
          <Slash config={config} run={run} snapshot={snapshot} />
        ) : (
          <Bubble config={config} run={run} tick={snapshot.selection} />
        ))}
      <Toolbar
        busy={busy}
        changed={changed}
        demo={!api.live}
        editing={editing}
        onRevert={revertAll}
        onToggle={() => setMode(toggled)}
      />
      {status && <Status {...status} />}
    </div>
  );
}

const toggled = (mode: Mode): Mode => (mode === "edit" ? "read" : "edit");

function useShortcuts(options: {
  editing: boolean;
  hasRun: () => boolean;
  onToggle: () => void;
  onUndo: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && !event.shiftKey && key === "e") {
        event.preventDefault();
        options.onToggle();
        return;
      }
      if (
        !(options.editing && mod) ||
        event.shiftKey ||
        key !== "z" ||
        options.hasRun() ||
        isTyping()
      ) {
        return;
      }
      event.preventDefault();
      options.onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

function isTyping() {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement &&
    (active.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
  );
}

function Toolbar({
  busy,
  changed,
  demo,
  editing,
  onRevert,
  onToggle,
}: {
  busy: boolean;
  changed: number;
  demo: boolean;
  editing: boolean;
  onRevert: () => void;
  onToggle: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const idleLabel = demo ? "Try editing" : "Edit page";

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <>
      <div className="bar" data-mode={editing ? "edit" : "read"}>
        <button
          aria-label={editing ? "Stop editing" : "Edit this page"}
          aria-pressed={editing}
          className="trigger"
          data-busy={busy ? "" : undefined}
          onClick={onToggle}
          type="button"
        >
          <span className="mark" />
        </button>
        {editing && (
          <>
            <span className="sep" />
            <button
              aria-label={
                confirming
                  ? "Confirm reverting all changes"
                  : "Revert all changes"
              }
              className="action"
              data-confirming={confirming ? "" : undefined}
              disabled={changed === 0}
              onClick={() => {
                if (confirming) {
                  setConfirming(false);
                  onRevert();
                } else {
                  setConfirming(true);
                }
              }}
              title={changed === 0 ? "Nothing to revert" : "Revert all changes"}
              type="button"
            >
              <RevertIcon />
              {confirming && <span>Revert all</span>}
            </button>
          </>
        )}
      </div>
      {!editing && (
        <div className="label">
          {idleLabel} <kbd>⌘E</kbd>
        </div>
      )}
    </>
  );
}

interface BlockControlsProps {
  host: HTMLElement;
  onActivate: (target: OpenTarget) => void;
  onBreak: (block: Block) => void;
  onDelete: (block: Block) => void;
  onMove: (block: Block, target: Block | null) => void;
  onOutside: () => void;
  run: Run | null;
}

function BlockControls({
  host,
  run,
  onActivate,
  onMove,
  onBreak,
  onDelete,
  onOutside,
}: BlockControlsProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<(Hover & { kind: "add" | "block" }) | null>(
    null
  );

  useEffect(() => {
    let frame = 0;
    let pointer = { x: -1, y: -1 };

    const measure = () => {
      frame = 0;
      const block = hitTest(pointer.x, pointer.y);
      const geometry = block && measureBlock(block);
      setHover(block && geometry ? { block, ...geometry } : null);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      setMenu(null);
      if (run && !run.root.contains(event.target as Node)) {
        onOutside();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      const target = event.target as Element;
      if (run?.root.contains(target)) {
        if (target.closest("a")) {
          event.preventDefault();
        }
        return;
      }
      const wrapper = target.closest<HTMLElement>(BLOCK_SELECTOR);
      const block = wrapper && readBlock(wrapper);
      if (!(block && EDITABLE.has(block.type))) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setHover(null);
      onActivate({ block, caret: { x: event.clientX, y: event.clientY } });
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  });

  const startDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    block: Block
  ) => {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY };
    let moved = false;
    setDrag({ block, line: null, moved: false });

    const onPointerMove = (move: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 4
      ) {
        return;
      }
      moved = true;
      setDrag({
        block,
        line: dropTarget(block, move.clientY).line,
        moved: true,
      });
    };
    const onPointerUp = (up: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDrag(null);
      setHover(null);
      if (moved) {
        onMove(block, dropTarget(block, up.clientY).target);
        return;
      }
      const geometry = measureBlock(block);
      if (geometry) {
        setMenu({ block, ...geometry, kind: "block" });
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const current = drag ? measureBlock(drag.block) : hover;
  const block = drag?.block ?? hover?.block;
  const showControls = current && block && !menu;

  return (
    <>
      {showControls && (
        <>
          <div
            className={drag?.moved ? "outline dragging" : "outline"}
            style={{
              ...box(current.rect, PAD),
              borderRadius: current.radius + PAD,
            }}
          />
          <div className="gutter" style={gutterPosition(current)}>
            <button
              aria-label="Add below"
              onClick={() => setMenu({ ...current, block, kind: "add" })}
              type="button"
            >
              <PlusIcon />
            </button>
            <button
              aria-label="Drag to move, click for options"
              className="grip"
              data-active={drag ? "" : undefined}
              onPointerDown={(event) => startDrag(event, block)}
              type="button"
            >
              <GripIcon />
            </button>
          </div>
        </>
      )}
      {drag?.line && (
        <div
          className="indicator"
          style={{
            left: drag.line.left,
            top: drag.line.top,
            width: drag.line.width,
          }}
        />
      )}
      {menu && (
        <div
          className="panel menu"
          style={{
            left: gutterPosition(menu).left - (HANDLE * 2 + 2),
            top: menu.handleTop + HANDLE + 6,
          }}
        >
          {menu.kind === "add" ? (
            <>
              <MenuItem
                label="Paragraph"
                onSelect={() => {
                  setMenu(null);
                  onActivate({ after: menu.block });
                }}
              />
              <MenuItem
                hint="<br />"
                label="Line break"
                onSelect={() => {
                  setMenu(null);
                  onBreak(menu.block);
                }}
              />
            </>
          ) : (
            <>
              <MenuItem
                label="Add paragraph below"
                onSelect={() => {
                  setMenu(null);
                  onActivate({ after: menu.block });
                }}
              />
              <MenuItem
                label="Delete block"
                onSelect={() => {
                  setMenu(null);
                  onDelete(menu.block);
                }}
                tone="danger"
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function hitTest(x: number, y: number): Block | null {
  let best: { block: Block; area: number } | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const rect = blockRect(el);
    if (!rect) {
      continue;
    }
    if (
      y < rect.top - 4 ||
      y > rect.bottom + 4 ||
      x < rect.left - 64 ||
      x > rect.right + 16
    ) {
      continue;
    }
    const area = rect.width * rect.height;
    if (!best || area < best.area) {
      best = { area, block: readBlock(el) };
    }
  }
  return best?.block ?? null;
}

function dropTarget(
  block: Block,
  y: number
): { line: Rect | null; target: Block | null } {
  const siblings = fileBlocks(block.file).filter(
    (b) => b.el.parentElement === block.el.parentElement
  );
  const own = blockRect(block.el);
  const left = own?.left ?? 0;
  const width = own?.width ?? 0;
  let previousBottom: number | null = null;

  for (const sibling of siblings) {
    const rect = blockRect(sibling.el);
    if (!rect) {
      continue;
    }
    if (y < rect.top + rect.height / 2) {
      const top =
        previousBottom === null
          ? rect.top - 6
          : (previousBottom + rect.top) / 2 - 1;
      return { line: { height: 2, left, top, width }, target: sibling };
    }
    previousBottom = rect.bottom;
  }
  return {
    line:
      previousBottom === null
        ? null
        : { height: 2, left, top: previousBottom + 6, width },
    target: null,
  };
}

const BREAK = "\n\n<br />";

function breakOnPage(block: Block) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "contents";
  const start = block.end + 2;
  Object.assign(wrapper.dataset, {
    esqiaEnd: String(start + BREAK.length - 2),
    esqiaFile: block.file,
    esqiaRev: String(api.revision(block.file)),
    esqiaStart: String(start),
    esqiaType: "spacer",
    esqiaV: block.version,
  });
  wrapper.append(document.createElement("br"));
  block.el.after(wrapper);
}

function removeFromPage(block: Block) {
  block.el.dataset.esqiaRemoved = "";
  block.el.style.setProperty("display", "none", "important");
}

function moveOnPage(
  ops: Op[],
  block: Block,
  target: Block | null,
  blocks: Block[]
) {
  const [removal, insertion] = ops;
  if (!(removal && insertion)) {
    return;
  }
  if (target) {
    target.el.before(block.el);
  } else {
    blocks.at(-1)?.el.after(block.el);
  }
  let start = insertion.start;
  if (start > removal.start) {
    start -= removal.end - removal.start;
  }
  if (insertion.text.startsWith("\n\n")) {
    start += 2;
  }
  block.el.dataset.esqiaStart = String(start);
  block.el.dataset.esqiaEnd = String(start + block.end - block.start);
  block.el.dataset.esqiaRev = String(api.revision(block.file));
}

function measureBlock(block: Block): Geometry | null {
  const rect = blockRect(block.el);
  if (!rect) {
    return null;
  }
  const first = block.el.firstElementChild;
  const radius = first
    ? Number.parseFloat(getComputedStyle(first).borderTopLeftRadius) || 0
    : 0;
  const line = firstLineRect(block.el);

  const center =
    line && line.top - rect.top < 64
      ? line.top + line.height / 2
      : rect.top + HANDLE / 2;
  return { handleTop: center - HANDLE / 2, radius, rect: toRect(rect) };
}

function firstLineRect(el: HTMLElement): DOMRect | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });
  const text = walker.nextNode();
  if (!text?.textContent) {
    return null;
  }
  const start = text.textContent.search(/\S/);
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + 1);
  return range.getClientRects()[0] ?? null;
}

function gutterPosition(geometry: Geometry) {
  return {
    left: geometry.rect.left - PAD - HANDLE_GAP,
    top: geometry.handleTop,
    transform: "translateX(-100%)",
  };
}

function toRect(rect: DOMRect): Rect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function box(rect: Rect, pad: number) {
  return {
    height: rect.height + pad * 2,
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
  };
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
  onSelect: () => void;
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

function Bubble({
  run,
  config,
}: {
  run: Run;
  config: ClientConfig;
  tick: number;
}) {
  const { editor } = run;
  const { from, to, empty } = editor.state.selection;

  const [linkDraft, setLinkDraft] = useState<{
    from: number;
    href: string;
  } | null>(null);
  const linking = linkDraft && linkDraft.from === from ? linkDraft.href : null;
  const setLinking = (href: string | null) =>
    setLinkDraft(href === null ? null : { from, href });
  const inCode = editor.isActive("codeBlock");

  if (empty || inCode || (!editor.view.hasFocus() && linking === null)) {
    return null;
  }

  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);
  const top = Math.min(start.top, end.top) - 48;
  const left = Math.max(
    12,
    Math.min((start.left + end.right) / 2, window.innerWidth - 12)
  );

  const chain = () => editor.chain().focus();
  const button = (
    label: ReactNode,
    name: string,
    active: boolean,
    action: () => void
  ) => (
    <button
      aria-label={name}
      aria-pressed={active}
      key={name}
      onClick={action}
      onMouseDown={(e) => e.preventDefault()}
      type="button"
    >
      {label}
    </button>
  );

  const toggleJsxMark = (mark: ClientConfig["marks"][number]) => {
    const type = editor.schema.marks.jsx;
    const instance = type.create({
      close: `</${mark.tag}>`,
      name: mark.tag,
      open: markOpen(mark),
    });
    const active = editor.isActive("jsx", { open: markOpen(mark) });
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (active) {
          tr.removeMark(from, to, instance);
        } else {
          tr.addMark(from, to, instance);
        }
        return true;
      })
      .run();
  };

  return (
    <div
      className="panel toolbar"
      style={{ left, top: Math.max(8, top), transform: "translateX(-50%)" }}
    >
      {linking === null ? (
        <>
          {button("Text", "Text", editor.isActive("paragraph"), () =>
            chain().setParagraph().run()
          )}
          {button(
            "H2",
            "Heading 2",
            editor.isActive("heading", { level: 2 }),
            () => chain().toggleHeading({ level: 2 }).run()
          )}
          {button(
            "H3",
            "Heading 3",
            editor.isActive("heading", { level: 3 }),
            () => chain().toggleHeading({ level: 3 }).run()
          )}
          <span className="sep" />
          {button(<b>B</b>, "Bold", editor.isActive("bold"), () =>
            chain().toggleBold().run()
          )}
          {button(<i>I</i>, "Italic", editor.isActive("italic"), () =>
            chain().toggleItalic().run()
          )}
          {button(<CodeIcon />, "Code", editor.isActive("code"), () =>
            chain().toggleCode().run()
          )}
          {button(<LinkIcon />, "Link", editor.isActive("link"), () =>
            setLinking(
              (editor.getAttributes("link").href as string | undefined) ?? ""
            )
          )}
          {config.marks.length > 0 && <span className="sep" />}
          {config.marks.map((mark) =>
            button(
              mark.name,
              mark.name,
              editor.isActive("jsx", { open: markOpen(mark) }),
              () => toggleJsxMark(mark)
            )
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (linking.trim()) {
              chain()
                .extendMarkRange("link")
                .setLink({ href: linking.trim() })
                .run();
            } else {
              chain().extendMarkRange("link").unsetLink().run();
            }
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
      )}
    </div>
  );
}

interface SlashItem {
  apply: (run: Run) => void;
  hint?: string;
  id: string;
  label: string;
}

function slashItems(config: ClientConfig): SlashItem[] {
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
      if (file) {
        void r.insertMedia(file);
      }
    };
    input.click();
  };
  return [
    { apply: (r) => r.clearSlashText(), id: "text", label: "Text" },
    { apply: heading(2), hint: "##", id: "h2", label: "Heading 2" },
    { apply: heading(3), hint: "###", id: "h3", label: "Heading 3" },
    { apply: heading(1), hint: "#", id: "h1", label: "Heading 1" },
    {
      apply: (r) => {
        r.clearSlashText();
        r.editor.chain().focus().setCodeBlock().run();
      },
      hint: "```",
      id: "code",
      label: "Code block",
    },
    {
      apply: (r: Run) => r.insertSpacer(),
      hint: "<br />",
      id: "spacer",
      label: "Line break",
    },
    { apply: pick("image/*"), hint: "upload", id: "image", label: "Image" },
    { apply: pick("video/*"), hint: "upload", id: "video", label: "Video" },
    ...config.snippets.map((snippet) => ({
      apply: (r: Run) => {
        r.clearSlashText();
        r.insertBlock(snippet.source);
      },
      hint:
        snippet.source.length > 24
          ? `${snippet.source.slice(0, 22)}…`
          : snippet.source,
      id: `snippet:${snippet.name}`,
      label: snippet.name,
    })),
  ];
}

function Slash({
  run,
  config,
  snapshot,
}: {
  run: Run;
  config: ClientConfig;
  snapshot: RunSnapshot;
}) {
  const slash = snapshot.slash;
  const [dismissed, setDismissed] = useState(false);
  const query = slash?.query.trim().toLowerCase() ?? "";

  const [highlight, setHighlight] = useState({ index: 0, query });
  const active = highlight.query === query ? highlight.index : 0;
  const setActive = (next: (index: number) => number) =>
    setHighlight({ index: next(active), query });
  const items = slashItems(config).filter((item) =>
    item.label.toLowerCase().includes(query)
  );

  useEffect(() => {
    run.setSlashKeys((event) => {
      if (dismissed || items.length === 0) {
        return false;
      }
      if (
        event.key === "ArrowDown" ||
        (event.key === "Tab" && !event.shiftKey)
      ) {
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
    });
    return () => run.setSlashKeys(null);
  });

  if (!slash || dismissed || items.length === 0) {
    return null;
  }
  const below = slash.rect.bottom + 6;
  const top = below + 320 > window.innerHeight ? slash.rect.top - 6 : below;

  return (
    <div
      className="panel menu"
      role="listbox"
      style={{
        left: slash.rect.left,
        top,
        transform: top < below ? "translateY(-100%)" : undefined,
      }}
    >
      {items.map((item, index) => (
        <MenuItem
          active={index === active}
          hint={item.hint}
          key={item.id}
          label={item.label}
          onSelect={() => item.apply(run)}
        />
      ))}
    </div>
  );
}

function Status({ text, tone }: { text: string; tone: "info" | "error" }) {
  return (
    <div className="toast" data-tone={tone} role="status">
      {text}
    </div>
  );
}

const RevertIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
  >
    <path
      d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H7M3.5 6.5 6 4M3.5 6.5 6 9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="14"
    viewBox="0 0 16 16"
    width="14"
  >
    <path
      d="M8 3v10M3 8h10"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

const GripIcon = () => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="14"
    viewBox="0 0 16 16"
    width="14"
  >
    {[4, 8, 12].flatMap((y) => [
      <circle cx="6" cy={y} key={`a${y}`} r="1.2" />,
      <circle cx="10" cy={y} key={`b${y}`} r="1.2" />,
    ])}
  </svg>
);

const CodeIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="14"
    viewBox="0 0 16 16"
    width="14"
  >
    <path
      d="M6 4 2 8l4 4M10 4l4 4-4 4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="14"
    viewBox="0 0 16 16"
    width="14"
  >
    <path
      d="M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

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
.bar {
  position: fixed; left: calc(20px + env(safe-area-inset-left)); bottom: calc(20px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 4px; border-radius: 9999px;
}
.bar[data-mode="edit"] { padding: 4px; background: var(--surface); box-shadow: 0 0 0 1.5px var(--sky), var(--shadow); }
.trigger {
  width: 36px; height: 36px; border: 0; border-radius: 9999px; outline: none;
  display: grid; place-items: center; cursor: pointer;
  background: var(--surface); color: var(--muted); box-shadow: var(--shadow);
  transition: box-shadow 150ms ease-out, color 150ms ease-out, transform 150ms ease-out;
}
.trigger:hover { box-shadow: var(--shadow-hover); color: var(--text); }
.trigger:active { transform: scale(0.96); }
.trigger:focus-visible { box-shadow: var(--shadow), 0 0 0 4px rgb(0 0 0 / 0.1); }
.bar[data-mode="edit"] .trigger { width: 28px; height: 28px; box-shadow: none; color: var(--text); }
.bar[data-mode="edit"] .trigger:hover { background: var(--hover); }
.action {
  height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}
.action:hover:not(:disabled) { background: var(--hover); color: var(--text); }
.action:disabled { opacity: 0.4; cursor: default; }
.action[data-confirming], .action[data-confirming]:hover { padding: 0 10px 0 8px; color: var(--danger); background: color-mix(in oklab, var(--danger) 10%, transparent); }
.mark { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }
.trigger[data-busy] .mark { animation: pulse 900ms ease-in-out infinite; }
.label, .toast {
  position: fixed; left: calc(64px + env(safe-area-inset-left)); bottom: calc(23px + env(safe-area-inset-bottom));
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  background: var(--surface); box-shadow: var(--shadow); pointer-events: none !important;
}
.label { opacity: 0; transform: translateX(-4px); transition: opacity 150ms ease-out, transform 150ms ease-out; }
.bar:hover + .label { opacity: 1; transform: none; }
.toast { left: calc(20px + env(safe-area-inset-left)); bottom: calc(68px + env(safe-area-inset-bottom)); max-width: min(420px, calc(100vw - 40px)); white-space: normal; }
.toast[data-tone="error"] { color: var(--danger); }
kbd { font: inherit; color: var(--faint); margin-left: 4px; }
.outline {
  position: fixed; border-radius: 8px; pointer-events: none !important;
  box-shadow: 0 0 0 2px var(--sky);
}
.outline.dragging { background: color-mix(in oklab, var(--sky) 8%, transparent); }
.gutter { position: fixed; display: flex; gap: 2px; }
.gutter button {
  width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent;
  display: grid; place-items: center; color: var(--faint); cursor: pointer;
}
.gutter button:hover, .gutter button[data-active] { background: var(--hover); color: var(--text); }
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
[data-esqia-mode="edit"] [data-esqia-type="paragraph"] > *,
[data-esqia-mode="edit"] [data-esqia-type="heading"] > *,
[data-esqia-mode="edit"] [data-esqia-type="code"] > * { cursor: text; }
.esqia-editor { display: contents; }
.esqia-editor > .ProseMirror { font-feature-settings: inherit; font-variant-ligatures: inherit; white-space: pre-wrap; }
.esqia-editor > .ProseMirror { outline: none; caret-color: oklch(74.6% 0.16 232.661); }
.esqia-editor [data-esqia-spacer] { position: relative; }
.esqia-editor [data-esqia-spacer]::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 1px dashed currentColor; opacity: 0; transition: opacity 150ms ease-out;
}
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
