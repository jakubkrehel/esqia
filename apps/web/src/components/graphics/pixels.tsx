import { Frame } from "./parts";

const COLUMNS = 25;
const ROWS = 13;
const PITCH = 24;
const SQUARE = 20;
const MARK_COLUMN = 9;
const MARK_ROW = 4;

const SIDES = new Set([
  "0-0",
  "1-1",
  "0-2",
  "1-2",
  "1-3",
  "0-4",
  "6-0",
  "5-1",
  "5-2",
  "6-2",
  "5-3",
  "6-4",
]);

const CELLS = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const markColumn = column - MARK_COLUMN;
  const markRow = row - MARK_ROW;
  const inRows = markRow >= 0 && markRow <= 4;
  return {
    caret: inRows && markColumn === 3,
    key: `${column}-${row}`,
    mark: SIDES.has(`${markColumn}-${markRow}`),
    x: column * PITCH - 2,
    y: row * PITCH - 6,
  };
});

const CARET = CELLS.filter((cell) => cell.caret);

export function Pixels() {
  return (
    <Frame nested>
      <svg className="size-full" viewBox="0 0 592 296">
        {CELLS.map((cell) => (
          <rect
            className={cell.mark ? "fill-gray-1200" : "fill-gray-200/50"}
            height={SQUARE}
            key={cell.key}
            width={SQUARE}
            x={cell.x}
            y={cell.y}
          />
        ))}
        {CARET.map((cell) => (
          <rect
            className="graphic-caret fill-gray-1200"
            height={SQUARE}
            key={cell.key}
            width={SQUARE}
            x={cell.x}
            y={cell.y}
          />
        ))}
      </svg>
    </Frame>
  );
}
