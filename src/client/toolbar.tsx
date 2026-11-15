import { type Ref, useEffect, useRef, useState } from "react";
import { type Corner, startCornerDrag } from "./corner-drag";
import {
  CheckIcon,
  MarkIcon,
  OpenIcon,
  RedoIcon,
  ResetIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";
import { ToolbarTip, useTip } from "./toolbar-tip";

export const OUTLINE_COLORS = [
  { name: "Gray", value: "oklch(70.8% 0 0)" },
  { name: "Sky", value: "oklch(74.6% 0.16 232.661)" },
  { name: "Violet", value: "oklch(70.2% 0.183 293.541)" },
  { name: "Pink", value: "oklch(71.8% 0.202 349.761)" },
  { name: "Orange", value: "oklch(75% 0.183 55.934)" },
  { name: "Emerald", value: "oklch(76.5% 0.177 163.223)" },
] as const;

const REVERTED_FOR = 1200;
export function Toolbar({
  busy,
  changed,
  corner,
  editing,
  inline,
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
  inline: boolean;
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
  if (confirmAt && !editing) {
    setConfirmAt(null);
  }
  const confirming = confirmAt !== null;
  const nothingChanged = changed === 0;
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
        event.preventDefault();
        setConfirmAt(null);
      }
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", escape, true);
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
      data-inline={inline ? "" : undefined}
      data-mode={editing ? "edit" : "read"}
      onPointerDown={
        inline ? undefined : (event) => startCornerDrag(event, corner, onCorner)
      }
    >
      <button
        aria-label={editing ? "Stop editing" : "Edit this page"}
        aria-pressed={editing}
        className="trigger"
        data-busy={busy ? "" : undefined}
        onClick={onToggle}
        type="button"
      >
        <MarkIcon />
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
            aria-label="Revert all"
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
      {tip && editing && !confirming && <ToolbarTip tip={tip} />}
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
        Revert all
      </button>
    </div>
  );
}
