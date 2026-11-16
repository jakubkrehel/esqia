import { IconArrowRedoDown } from "central-icons/IconArrowRedoDown";
import { IconArrowRotateCounterClockwise } from "central-icons/IconArrowRotateCounterClockwise";
import { IconArrowUndoUp } from "central-icons/IconArrowUndoUp";
import { IconCodeLines } from "central-icons/IconCodeLines";
import type { ReactNode } from "react";

const OPEN_MARK = [
  [0, 0],
  [1, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [0, 4],
  [3, 0],
  [3, 1],
  [3, 2],
  [3, 3],
  [3, 4],
  [6, 0],
  [5, 1],
  [5, 2],
  [6, 2],
  [5, 3],
  [6, 4],
] as const;

const MARK_SQUARE = 4;
const MARK_PITCH = 5;

function Action({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-gray-1100">
      {children}
    </span>
  );
}

export function ToolbarGraphic() {
  return (
    <div
      aria-hidden="true"
      className="flex w-max select-none items-center gap-1 rounded-full bg-preview-bg px-2 shadow-custom dark:bg-gray-background"
    >
      <Action>
        <IconArrowUndoUp className="size-6" />
      </Action>
      <Action>
        <IconArrowRedoDown className="size-6" />
      </Action>
      <span className="mx-1 h-6 w-px shrink-0 bg-gray-400" />
      <span className="grid size-15 shrink-0 place-items-center text-gray-1200">
        <svg
          aria-hidden="true"
          className="h-6 w-8.5"
          fill="currentColor"
          viewBox="0 0 34 24"
        >
          {OPEN_MARK.map(([column, row]) => (
            <rect
              height={MARK_SQUARE}
              key={`${column}-${row}`}
              width={MARK_SQUARE}
              x={column * MARK_PITCH}
              y={row * MARK_PITCH}
            />
          ))}
        </svg>
      </span>
      <span className="mx-1 h-6 w-px shrink-0 bg-gray-400" />
      <Action>
        <IconArrowRotateCounterClockwise className="size-6" />
      </Action>
      <Action>
        <IconCodeLines className="size-6" />
      </Action>
    </div>
  );
}
