import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Corner, startCornerDrag } from "./corner-drag";
import {
  CheckIcon,
  OpenIcon,
  RedoIcon,
  ResetIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

export const OUTLINE_COLORS = [
  { name: "Gray", value: "oklch(70.8% 0 0)" },
  { name: "Sky", value: "oklch(74.6% 0.16 232.661)" },
  { name: "Violet", value: "oklch(70.2% 0.183 293.541)" },
  { name: "Pink", value: "oklch(71.8% 0.202 349.761)" },
  { name: "Orange", value: "oklch(75% 0.183 55.934)" },
  { name: "Emerald", value: "oklch(76.5% 0.177 163.223)" },
] as const;

const REVERTED_FOR = 1200;
const TIP_DELAY = 200;
const TIP_WARM_FOR = 300;

type TipId = "undo" | "redo" | "revert" | "open" | "outline";

interface Tip {
  id: TipId;
  instant: boolean;
  open: boolean;
  x: number;
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = useRef(false);
  const warmUntil = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (button: HTMLElement, id: TipId) => {
    clearTimeout(timer.current);
    const x = button.offsetLeft + button.offsetWidth / 2;
    const reveal = (instant: boolean) => {
      open.current = true;
      setTip({ id, instant, open: true, x });
    };
    if (performance.now() < warmUntil.current) {
      reveal(true);
    } else {
      timer.current = setTimeout(() => reveal(false), TIP_DELAY);
    }
  };

  const hide = () => {
    clearTimeout(timer.current);
    if (open.current) {
      open.current = false;
      warmUntil.current = performance.now() + TIP_WARM_FOR;
    }
    setTip((current) => current && { ...current, instant: false, open: false });
  };

  const bind = (id: TipId) => ({
    onBlur: hide,
    onFocus: (event: FocusEvent<HTMLButtonElement>) => {
      if (event.currentTarget.matches(":focus-visible")) {
        show(event.currentTarget, id);
      }
    },
    onPointerDown: hide,
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) =>
      show(event.currentTarget, id),
    onPointerLeave: hide,
  });

  return { bind, tip };
}

const MOD =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘"
    : "Ctrl+";

function tipLabel(id: TipId): ReactNode {
  switch (id) {
    case "undo":
      return (
        <>
          Undo
          <kbd>{MOD}Z</kbd>
        </>
      );
    case "redo":
      return (
        <>
          Redo
          <kbd>{MOD}⇧Z</kbd>
        </>
      );
    case "revert":
      return "Revert all changes";
    case "open":
      return "Open in editor";
    default:
      return "Theme";
  }
}

export function Toolbar({
  busy,
  changed,
  corner,
  editing,
  outline,
  onCorner,
  onOpen,
  onOutline,
  onRedo,
  onRevert,
  onToggle,
  onUndo,
  redoable,
}: {
  busy: boolean;
  changed: number;
  corner: Corner;
  editing: boolean;
  outline: string;
  onCorner: (corner: Corner) => void;
  onOpen?: () => void;
  onOutline: (color: string) => void;
  onRedo?: () => void;
  onRevert: () => Promise<boolean>;
  onToggle: () => void;
  onUndo?: () => void;
  redoable: number;
}) {
  const [confirmAt, setConfirmAt] = useState<ConfirmAt | null>(null);
  const revert = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLDivElement>(null);
  const current = OUTLINE_COLORS.findIndex((color) => color.value === outline);
  const outlineName = OUTLINE_COLORS[current]?.name ?? "Custom";
  const next = OUTLINE_COLORS[(current + 1) % OUTLINE_COLORS.length];
  const confirming = confirmAt !== null && editing;
  const nothingChanged = changed === 0;
  const disabled: Partial<Record<TipId, boolean>> = {
    redo: redoable === 0,
    revert: nothingChanged,
    undo: nothingChanged,
  };
  const { bind, tip } = useTip();

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const dismiss = (event: Event) => {
      const path = event.composedPath();
      if (
        !(
          (confirm.current && path.includes(confirm.current)) ||
          (revert.current && path.includes(revert.current))
        )
      ) {
        setConfirmAt(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmAt(null);
      }
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [confirming]);

  const toggleConfirm = (button: HTMLButtonElement) => {
    if (confirming) {
      setConfirmAt(null);
    } else if (!nothingChanged) {
      setConfirmAt({
        left: button.offsetLeft,
        right: button.offsetLeft + button.offsetWidth,
      });
    }
  };

  return (
    <div
      className="bar"
      data-corner={corner}
      data-mode={editing ? "edit" : "read"}
      onPointerDown={(event) => startCornerDrag(event, corner, onCorner)}
    >
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
      <div className="tray" inert={!editing}>
        <div className="tray-items">
          <span className="sep" />
          {onUndo && (
            <button
              aria-disabled={nothingChanged}
              aria-keyshortcuts="Meta+Z Control+Z"
              aria-label="Undo"
              className="action"
              onClick={() => nothingChanged || onUndo()}
              type="button"
              {...bind("undo")}
            >
              <UndoIcon />
            </button>
          )}
          {onRedo && (
            <button
              aria-disabled={redoable === 0}
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
              aria-label="Redo"
              className="action"
              onClick={() => redoable === 0 || onRedo()}
              type="button"
              {...bind("redo")}
            >
              <RedoIcon />
            </button>
          )}
          <button
            aria-disabled={nothingChanged}
            aria-expanded={confirming}
            aria-label="Revert all changes"
            className="action"
            onClick={(event) => toggleConfirm(event.currentTarget)}
            ref={revert}
            type="button"
            {...bind("revert")}
          >
            <ResetIcon />
          </button>
          {onOpen && (
            <button
              aria-label="Open in editor"
              className="action"
              onClick={onOpen}
              type="button"
              {...bind("open")}
            >
              <OpenIcon />
            </button>
          )}
          <button
            aria-label={`Theme: ${outlineName}`}
            className="action"
            onClick={() => onOutline(next.value)}
            type="button"
            {...bind("outline")}
          >
            <span className="swatch" style={{ background: outline }} />
          </button>
        </div>
      </div>
      {tip && editing && !confirming && !disabled[tip.id] && (
        <ToolbarTip label={tipLabel(tip.id)} tip={tip} />
      )}
      {confirming && (
        <RevertConfirm
          at={confirmAt}
          changed={changed}
          corner={corner}
          onRevert={onRevert}
          ref={confirm}
        />
      )}
    </div>
  );
}

interface ConfirmAt {
  left: number;
  right: number;
}

function RevertConfirm({
  at,
  changed,
  corner,
  onRevert,
  ref,
}: {
  at: ConfirmAt;
  changed: number;
  corner: Corner;
  onRevert: () => Promise<boolean>;
  ref: Ref<HTMLDivElement>;
}) {
  const [reverting, setReverting] = useState(false);
  const [reverted, setReverted] = useState(false);

  useEffect(() => {
    if (!reverted) {
      return;
    }
    const timer = setTimeout(() => setReverted(false), REVERTED_FOR);
    return () => clearTimeout(timer);
  }, [reverted]);

  return (
    <div
      className="confirm"
      ref={ref}
      style={
        corner.endsWith("right")
          ? { left: at.right, translate: "-100% 0" }
          : { left: at.left }
      }
    >
      <button
        autoFocus
        data-reverted={reverted ? "" : undefined}
        disabled={changed === 0 && !reverting && !reverted}
        onClick={async () => {
          if (reverting || reverted) {
            return;
          }
          setReverting(true);
          const done = await onRevert();
          setReverting(false);
          setReverted(done);
        }}
        type="button"
      >
        <span className="swap">
          <span data-shown={reverted ? undefined : ""}>
            <TrashIcon />
          </span>
          <span data-shown={reverted ? "" : undefined}>
            <CheckIcon />
          </span>
        </span>
        Revert all changes
      </button>
    </div>
  );
}

function ToolbarTip({ label, tip }: { label: ReactNode; tip: Tip }) {
  return (
    <div
      aria-hidden="true"
      className="tip"
      data-instant={tip.instant ? "" : undefined}
      data-open={tip.open ? "" : undefined}
      style={{ left: tip.x }}
    >
      {label}
    </div>
  );
}

export function Status({
  corner,
  text,
  tone,
}: {
  corner: Corner;
  text: string;
  tone: "info" | "error";
}) {
  return (
    <div className="toast" data-corner={corner} data-tone={tone} role="status">
      {text}
    </div>
  );
}
