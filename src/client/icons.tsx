import { IconArrowRedoDown } from "central-icons/IconArrowRedoDown";
import { IconArrowRotateCounterClockwise } from "central-icons/IconArrowRotateCounterClockwise";
import { IconArrowUndoUp } from "central-icons/IconArrowUndoUp";
import { IconChainLink4 } from "central-icons/IconChainLink4";
import { IconCheckmark1Medium } from "central-icons/IconCheckmark1Medium";
import { IconCirclePlus } from "central-icons/IconCirclePlus";
import { IconCodeLarge } from "central-icons/IconCodeLarge";
import { IconCodeLines } from "central-icons/IconCodeLines";
import { IconDotGrid2x3 } from "central-icons/IconDotGrid2x3";
import { IconItalic } from "central-icons/IconItalic";
import { IconTrashCan } from "central-icons/IconTrashCan";

const SIZE = 16;

export const UndoIcon = () => <IconArrowUndoUp size={SIZE} />;
export const RedoIcon = () => <IconArrowRedoDown size={SIZE} />;
export const BoldIcon = () => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height={SIZE}
    viewBox="0 0 24 24"
    width={SIZE}
  >
    <path
      clipRule="evenodd"
      d="M5 7.625C5 5.16376 6.92389 3 9.5 3H12.8333C15.8697 3 18.1667 5.55551 18.1667 8.5C18.1667 9.58312 17.8559 10.6136 17.3118 11.4836C18.3611 12.5023 19 13.9471 19 15.5C19 18.4445 16.703 21 13.6667 21H9.5C6.92389 21 5 18.8362 5 16.375V7.625ZM12.8333 10C13.4789 10 14.1667 9.4215 14.1667 8.5C14.1667 7.5785 13.4789 7 12.8333 7H9.5C9.31469 7 9 7.18675 9 7.625V10H12.8333ZM9 14H13.6667C14.3122 14 15 14.5785 15 15.5C15 16.4215 14.3122 17 13.6667 17H9.5C9.31469 17 9 16.8133 9 16.375V14Z"
      fillRule="evenodd"
    />
  </svg>
);
export const ItalicIcon = () => <IconItalic size={SIZE} />;
export const CheckIcon = () => <IconCheckmark1Medium size={SIZE} />;
export const PlusIcon = () => <IconCirclePlus size={SIZE} />;
export const GripIcon = () => <IconDotGrid2x3 size={SIZE} />;
export const LinkIcon = () => <IconChainLink4 size={SIZE} />;
export const CodeLargeIcon = () => <IconCodeLarge size={SIZE} />;
export const TrashIcon = () => <IconTrashCan size={SIZE} />;
export const ResetIcon = () => <IconArrowRotateCounterClockwise size={SIZE} />;
export const OpenIcon = () => <IconCodeLines size={SIZE} />;

const MARK_HALVES = {
  center: [
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
  ],
  left: [
    [0, 0],
    [1, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [0, 4],
  ],
  right: [
    [4, 0],
    [3, 1],
    [3, 2],
    [4, 2],
    [3, 3],
    [4, 4],
  ],
} as const;

const MARK_SQUARE = 4;
const MARK_PITCH = 5;

const Squares = ({
  cells,
}: {
  cells: readonly (readonly [number, number])[];
}) =>
  cells.map(([column, row]) => (
    <rect
      height={MARK_SQUARE}
      key={`${column}-${row}`}
      width={MARK_SQUARE}
      x={column * MARK_PITCH}
      y={row * MARK_PITCH}
    />
  ));

export const MarkIcon = () => (
  <svg
    aria-hidden="true"
    className="mark"
    fill="currentColor"
    viewBox="-6 -6 36 36"
  >
    <g className="mark-left">
      <Squares cells={MARK_HALVES.left} />
    </g>
    <g className="mark-center">
      <Squares cells={MARK_HALVES.center} />
    </g>
    <g className="mark-right">
      <Squares cells={MARK_HALVES.right} />
    </g>
  </svg>
);
