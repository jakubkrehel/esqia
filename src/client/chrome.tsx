import { useEffect, useState, useSyncExternalStore } from "react";
import { insertBreakOps, moveOps, removeOps } from "../shared/ops";
import type { Backend } from "./api";
import { BlockControls } from "./block-controls";
import { BLOCK_SELECTOR, fileBlocks, readBlock } from "./blocks";
import { Bubble } from "./bubble";
import { CORNERS } from "./corner-drag";
import { usePageClicks } from "./page-clicks";
import { IDLE_RUN } from "./run";
import { INITIAL_SESSION, Session } from "./session";
import { Slash } from "./slash";
import { OUTLINE_COLORS, Status, Toolbar } from "./toolbar";

const MODES = ["read", "edit"] as const;
type Mode = (typeof MODES)[number];
type Toast = { text: string; tone: "info" | "error" } | null;

const MODE_KEY = "esqia:mode";
const OUTLINE_KEY = "esqia:outline";
const CORNER_KEY = "esqia:corner";
const OUTLINES: string[] = OUTLINE_COLORS.map((color) => color.value);
const unsubscribed = () => () => undefined;

function readStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const saved = localStorage.getItem(key);
    return allowed.find((value) => value === saved) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function useStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
) {
  const [value, setValue] = useState(() => readStored(key, allowed, fallback));
  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

function subscribeToBlocks(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

const pageHasBlocks = () => document.querySelector(BLOCK_SELECTOR) !== null;

export function Chrome({
  backend,
  host,
}: {
  backend: Backend;
  host: HTMLElement;
}) {
  const [mode, setMode] = useStored(MODE_KEY, MODES, "read");
  const [toast, setToast] = useState<Toast>(null);
  const [outline, setOutline] = useStored(
    OUTLINE_KEY,
    OUTLINES,
    OUTLINE_COLORS[0].value
  );
  const [corner, setCorner] = useStored(CORNER_KEY, CORNERS, "bottom-left");
  const [session] = useState(
    () =>
      new Session(backend, (text, tone = "info") => setToast({ text, tone }))
  );
  const { changed, config, redoable, run, writing } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    () => INITIAL_SESSION
  );
  const hasBlocks = useSyncExternalStore(
    subscribeToBlocks,
    pageHasBlocks,
    () => false
  );
  const snapshot = useSyncExternalStore(
    run?.subscribe ?? unsubscribed,
    run?.getSnapshot ?? (() => IDLE_RUN),
    () => IDLE_RUN
  );

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

  useEffect(() => session.load(), [session]);

  useEffect(() => {
    document.documentElement.dataset.esqiaMode = mode;
    session.setEditable(mode === "edit");
    return () => {
      delete document.documentElement.dataset.esqiaMode;
    };
  }, [mode, session]);

  useEffect(() => {
    host.style.setProperty("--outline", outline);
  }, [outline, host]);

  useShortcuts({
    editing: mode === "edit",
    hasRun: () => session.getSnapshot().run !== null,
    onRedo: session.canRedo ? () => session.redo() : undefined,
    onToggle: () => setMode(toggled),
    onUndo: session.canUndo ? () => session.undo() : undefined,
  });
  usePageClicks(host, session, mode === "edit");

  if (!(hasBlocks && config)) {
    return toast ? <Status corner={corner} {...toast} /> : null;
  }

  const editing = mode === "edit";
  const busy = snapshot.saving || writing;

  return (
    <div className="layer">
      {editing && (
        <BlockControls
          host={host}
          onActivate={(target) => session.open(target)}
          onBreak={(block) =>
            session.write(block.el, (_source, fresh) => insertBreakOps(fresh))
          }
          onDelete={(block) => session.write(block.el, removeOps)}
          onMove={(block, target) =>
            session.write(block.el, (source, fresh) =>
              moveOps(
                source,
                fileBlocks(fresh.file),
                fresh,
                target && readBlock(target.el)
              )
            )
          }
        />
      )}
      {run &&
        (snapshot.slash ? (
          <Slash run={run} slash={snapshot.slash} />
        ) : (
          <Bubble config={config} run={run} />
        ))}
      <Toolbar
        busy={busy}
        changed={changed}
        corner={corner}
        editing={editing}
        onCorner={setCorner}
        onOpen={session.canOpen ? () => session.openInEditor() : undefined}
        onOutline={setOutline}
        onRedo={session.canRedo ? () => session.redo() : undefined}
        onRevert={() => session.revert()}
        onToggle={() => setMode(toggled)}
        onUndo={session.canUndo ? () => session.undo() : undefined}
        outline={outline}
        redoable={redoable}
      />
      {toast && <Status corner={corner} {...toast} />}
    </div>
  );
}

const toggled = (mode: Mode): Mode => (mode === "edit" ? "read" : "edit");

function useShortcuts(options: {
  editing: boolean;
  hasRun: () => boolean;
  onRedo?: () => void;
  onToggle: () => void;
  onUndo?: () => void;
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
      const step = event.shiftKey ? options.onRedo : options.onUndo;
      if (
        !(options.editing && mod && step) ||
        key !== "z" ||
        options.hasRun() ||
        isTyping()
      ) {
        return;
      }
      event.preventDefault();
      step();
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
