import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import { useEffect, useState } from "react";
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
import { createTips, REDO_TIP, Tips, UNDO_TIP } from "./toolbar-tip";

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
  const [confirming, setConfirming] = useState(false);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const current = OUTLINE_COLORS.findIndex((color) => color.value === outline);
  const outlineName = OUTLINE_COLORS[current]?.name ?? "Custom";
  const next = OUTLINE_COLORS[(current + 1) % OUTLINE_COLORS.length];
  if (confirming && !editing) {
    setConfirming(false);
  }
  const nothingChanged = changed === 0;
  const above = corner.startsWith("bottom");
  const [tips] = useState(createTips);
  const side = above ? "top" : "bottom";

  return (
    <div
      className="bar"
      data-corner={corner}
      data-inline={inline ? "" : undefined}
      data-mode={editing ? "edit" : "read"}
      onPointerDown={
        inline ? undefined : (event) => startCornerDrag(event, corner, onCorner)
      }
      ref={setBar}
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
        <Tips
          container={bar}
          disabled={confirming || !editing}
          handle={tips}
          side={side}
        >
          <div className="tray-items">
            <span className="sep" />
            {onUndo && (
              <Tooltip.Trigger
                aria-disabled={nothingChanged}
                aria-keyshortcuts="Meta+Z Control+Z"
                aria-label="Undo"
                className="action"
                handle={tips}
                onClick={() => nothingChanged || onUndo()}
                payload={UNDO_TIP}
              >
                <UndoIcon />
              </Tooltip.Trigger>
            )}
            {onRedo && (
              <Tooltip.Trigger
                aria-disabled={redoable === 0}
                aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
                aria-label="Redo"
                className="action"
                handle={tips}
                onClick={() => redoable === 0 || onRedo()}
                payload={REDO_TIP}
              >
                <RedoIcon />
              </Tooltip.Trigger>
            )}
            <Popover.Root
              onOpenChange={(open) => setConfirming(open && !nothingChanged)}
              open={confirming}
            >
              <Tooltip.Trigger
                aria-disabled={nothingChanged}
                aria-label="Revert all"
                className="action"
                handle={tips}
                payload="Revert all"
                render={<Popover.Trigger />}
              >
                <ResetIcon />
              </Tooltip.Trigger>
              <Popover.Portal container={bar}>
                <Popover.Positioner align="start" side={side} sideOffset={12}>
                  <Popover.Popup className="confirm">
                    <RevertConfirm changed={changed} onRevert={onRevert} />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <span className="sep" />
            {onOpen && (
              <Tooltip.Trigger
                aria-label="Open in editor"
                className="action"
                handle={tips}
                onClick={onOpen}
                payload="Open in editor"
              >
                <OpenIcon />
              </Tooltip.Trigger>
            )}
            <Tooltip.Trigger
              aria-label={`Theme: ${outlineName}`}
              className="action"
              handle={tips}
              onClick={() => onOutline(next.value)}
              payload="Theme"
            >
              <span className="swatch" style={{ background: outline }} />
            </Tooltip.Trigger>
          </div>
        </Tips>
      </div>
    </div>
  );
}

function RevertConfirm({
  changed,
  onRevert,
}: {
  changed: number;
  onRevert: () => Promise<boolean>;
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
    <button
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
  );
}
