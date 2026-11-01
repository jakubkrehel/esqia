import { useEffect, useRef, useState } from "react";
import { type Corner, startCornerDrag } from "./corner-drag";
import { CheckIcon, RevertIcon, TrashIcon } from "./icons";

export const OUTLINE_COLORS = [
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
  outline,
  onCorner,
  onOutline,
  onRevert,
  onToggle,
}: {
  busy: boolean;
  changed: number;
  corner: Corner;
  editing: boolean;
  outline: string;
  onCorner: (corner: Corner) => void;
  onOutline: (color: string) => void;
  onRevert: () => Promise<boolean>;
  onToggle: () => void;
}) {
  const [confirmAt, setConfirmAt] = useState<{
    left: number;
    right: number;
  } | null>(null);
  const [reverting, setReverting] = useState(false);
  const [reverted, setReverted] = useState(false);
  const revert = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLDivElement>(null);
  const current = OUTLINE_COLORS.findIndex((color) => color.value === outline);
  const next = OUTLINE_COLORS[(current + 1) % OUTLINE_COLORS.length];
  const confirming = confirmAt !== null && editing;

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

  useEffect(() => {
    if (!reverted) {
      return;
    }
    const timer = setTimeout(() => setReverted(false), REVERTED_FOR);
    return () => clearTimeout(timer);
  }, [reverted]);

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
          <button
            aria-expanded={confirming}
            aria-label="Revert all changes"
            className="action"
            disabled={changed === 0}
            onClick={(event) => {
              const button = event.currentTarget;
              setConfirmAt(
                confirming
                  ? null
                  : {
                      left: button.offsetLeft,
                      right: button.offsetLeft + button.offsetWidth,
                    }
              );
            }}
            ref={revert}
            title={changed === 0 ? "Nothing to revert" : "Revert all changes"}
            type="button"
          >
            <RevertIcon />
          </button>
          <button
            aria-label={`Outline color: ${OUTLINE_COLORS[current]?.name}`}
            className="action"
            onClick={() => onOutline(next.value)}
            title={`Switch outline to ${next.name}`}
            type="button"
          >
            <span className="swatch" style={{ background: outline }} />
          </button>
        </div>
      </div>
      {confirming && (
        <div
          className="confirm"
          ref={confirm}
          style={
            corner.endsWith("right")
              ? { left: confirmAt.right, translate: "-100% 0" }
              : { left: confirmAt.left }
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
      )}
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
