import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Esqia logo variants",
};

const SQUARE = 4;
const PITCH = 5;

const DIRECTIONS: Record<string, readonly [number, number]> = {
  a: [-1, -1],
  b: [1, -1],
  c: [0, 0],
  d: [0, 1],
  i: [0, 0],
  l: [-1, 0],
  p: [-1, 1],
  q: [1, 1],
  r: [1, 0],
  u: [0, -1],
};

const ONLY_EXPANDED = "i";

interface Variant {
  art: string[][];
  current?: boolean;
  idea: string;
  name: string;
  shift?: number | Record<string, number>;
}

interface Family {
  title: string;
  variants: Variant[];
}

const FAMILIES: Family[] = [
  {
    title: "Asterisks",
    variants: [
      {
        art: [["l..c..r", ".l.c.r.", "ll.c.rr", ".l.c.r.", "l..c..r"]],
        current: true,
        idea: "The asterisk splits around its own stem, which becomes the caret.",
        name: "Asterisk",
      },
      {
        art: [["l..i..r", ".l.i.r.", "ll.i.rr", ".l.i.r.", "l..i..r"]],
        idea: "The halves overlap into a three-wide asterisk and the caret only appears when open.",
        name: "Small asterisk",
        shift: 2,
      },
      {
        art: [["l..i..r", ".l.i.r.", "ll.i.rr", ".l.i.r.", "l..i..r"]],
        idea: "Same halves with a one-column gap, so the closed mark is an open cross.",
        name: "Hollow asterisk",
      },
      {
        art: [["...c...", "l..c..r", ".l.c.r.", "l..c..r", "...c..."]],
        idea: "The six-point glyph from a bitmap font. Lighter, with a full-height caret.",
        name: "Six-point asterisk",
      },
      {
        art: [
          ["....i....", ".l..i..r.", "lll.i.rrr", ".l..i..r.", "....i...."],
        ],
        idea: "Two markers, as in **bold**, that part to let the caret in.",
        name: "Bold",
      },
      {
        art: [
          [
            "a..u..b",
            ".a.u.b.",
            ".......",
            "ll.c.rr",
            ".......",
            ".p.d.q.",
            "p..d..q",
          ],
        ],
        idea: "All eight arms move outward from a centre that stays put.",
        name: "Burst",
      },
    ],
  },
  {
    title: "Headings",
    variants: [
      {
        art: [[".l.i.r.", "ll.c.rr", ".l.i.r.", "ll.c.rr", ".l.i.r."]],
        idea: "The hash splits down the middle and its two centre cells grow into the caret.",
        name: "Hash",
      },
      {
        art: [
          [
            ".l...r.",
            ".l...r.",
            ".l...r.",
            ".l.i.r.",
            ".l...r.",
            ".l...r.",
            ".l...r.",
          ],
          [
            ".......",
            "uuuuuuu",
            ".......",
            ".......",
            ".......",
            "ddddddd",
            ".......",
          ],
        ],
        idea: "The four bars move apart into a frame around the block being edited.",
        name: "Hash frame",
      },
    ],
  },
  {
    title: "Quotes",
    variants: [
      {
        art: [[".l.i.rr", "ll.i.rr", "ll.i.r.", "...i...", "...i..."]],
        idea: "Opening and closing marks with the caret dropping between them.",
        name: "Quotes",
      },
      {
        art: [["ll.....rr", "ll.iii.rr", "l......r.", "...iii..."]],
        idea: "The classic double-comma glyph. Open, the commas hold two lines of text.",
        name: "Pull quote",
        shift: 2,
      },
      {
        art: [
          ["l...i.r..", ".l..i..r.", "..l.i...r", ".l..i..r.", "l...i.r.."],
        ],
        idea: "A nested blockquote marker, >>, that separates around the caret.",
        name: "Nested quote",
        shift: 2,
      },
    ],
  },
  {
    title: "Brackets",
    variants: [
      {
        art: [["ll.i.rr", "l..i..r", "l..i..r", "l..i..r", "ll.i.rr"]],
        idea: "A closed box opens into the two brackets of a link.",
        name: "Box",
        shift: 2,
      },
      {
        art: [["ll.i.rr", "l..i..r", "l..i..r", "l..i..r", "ll.i.rr"]],
        idea: "The brackets are already apart when closed and widen for the caret.",
        name: "Link brackets",
      },
      {
        art: [["ll.c.rr", "l..i..r", "l..c..r", "l..i..r", "ll.c.rr"]],
        idea: "A ticked task box. Its centre column fills in to become the caret.",
        name: "Task box",
      },
      {
        art: [
          ["..l.i.r..", ".l..i..r.", "l...i...r", ".l..i..r.", "..l.i.r.."],
        ],
        idea: "A diamond that opens into the angle brackets of a JSX tag.",
        name: "Diamond",
        shift: 2,
      },
      {
        art: [
          ["..l.i.r..", ".l..i..r.", "l...i...r", ".l..i..r.", "..l.i.r.."],
        ],
        idea: "An empty tag, <>, with the caret arriving inside it.",
        name: "Fragment",
      },
      {
        art: [
          [".ll.i.rr.", ".l..i..r.", "l...i...r", ".l..i..r.", ".ll.i.rr."],
        ],
        idea: "The braces of an MDX expression, closed into a lozenge.",
        name: "Braces",
        shift: 2,
      },
      {
        art: [["u..u.", ".u..u", ".....", "iiii.", ".....", "d..d.", ".d..d"]],
        idea: "One row of backticks becomes an opening and closing fence around a line of code.",
        name: "Code fence",
        shift: { d: 3, u: 2 },
      },
    ],
  },
  {
    title: "Text and blocks",
    variants: [
      {
        art: [[".ccccc.", ".......", "ll.c.rr", ".......", ".ccc..."]],
        idea: "Three lines of text. The middle one parts around the cell where the caret lands.",
        name: "Paragraph",
      },
      {
        art: [["l.ccc", ".....", "l.ccc", ".....", "l.ccc"]],
        idea: "Plain lines when closed. Open, the first cell of each steps out as a bullet.",
        name: "List",
      },
      {
        art: [["ll.c.rr", "ll.c.rr", "ll.c.rr", "ll.c.rr", "ll.c.rr"]],
        idea: "A solid block cut in two by the caret. The most square of the set.",
        name: "Split block",
      },
      {
        art: [["a.u.b", ".....", "l.c.r", ".....", "p.d.q"]],
        idea: "A 3 by 3 block whose cells spread into a grid around the centre.",
        name: "Block",
      },
      {
        art: [["ll.c.rr", "l..c..r", "ll.c.rr", "l..c..r", "ll.c.rr"]],
        idea: "A table grid that opens into an E, the caret and a mirrored E.",
        name: "Table",
      },
      {
        art: [["...c...", "...c...", "...c...", ".......", "lll.rrr"]],
        idea: "A caret standing on an underscore, which opens beneath it.",
        name: "Underscore",
      },
    ],
  },
  {
    title: "Letters and cursors",
    variants: [
      {
        art: [["l..i..r", "ll.i.rr", "l..c..r", "l..i..r", "l..i..r"]],
        idea: "The M of the Markdown mark. Its middle cell extends into the caret.",
        name: "M",
      },
      {
        art: [["ll.c.rr", "...c...", "...c...", "...c...", "ll.c.rr"]],
        idea: "A text cursor whose serifs pull apart into corner marks.",
        name: "I-beam",
      },
      {
        art: [["ll.c.rr", "...c...", "...c...", "...c...", "...c..."]],
        idea: "A T for text. The bar splits and the stem is the caret.",
        name: "Type",
      },
      {
        art: [[".l.c.rr", "ll.c..r", "ll.c..r", ".l.c..r", "...c..r"]],
        idea: "A paragraph mark that comes apart into bowl, caret and stem.",
        name: "Pilcrow",
      },
    ],
  },
];

function firstIndex(position: number) {
  return FAMILIES.slice(0, position).reduce(
    (count, family) => count + family.variants.length,
    1
  );
}

function shiftOf(variant: Variant, group: string) {
  const { shift = 1 } = variant;
  return typeof shift === "number" ? shift : (shift[group] ?? 1);
}

function cellsOf(variant: Variant, expanded: boolean) {
  const seen = new Set<string>();
  const cells: [number, number][] = [];
  for (const layer of variant.art) {
    layer.forEach((line, row) => {
      [...line].forEach((group, column) => {
        const direction = DIRECTIONS[group];
        if (!direction || (group === ONLY_EXPANDED && !expanded)) {
          return;
        }
        const steps = expanded ? 0 : shiftOf(variant, group);
        const cell: [number, number] = [
          column - direction[0] * steps,
          row - direction[1] * steps,
        ];
        const key = cell.join(",");
        if (!seen.has(key)) {
          seen.add(key);
          cells.push(cell);
        }
      });
    });
  }
  return cells;
}

function Mark({
  expanded,
  scale,
  variant,
}: {
  expanded: boolean;
  scale: number;
  variant: Variant;
}) {
  const cells = cellsOf(variant, expanded);
  const columns = cells.map(([column]) => column);
  const rows = cells.map(([, row]) => row);
  const left = Math.min(...columns);
  const top = Math.min(...rows);
  const width = (Math.max(...columns) - left) * PITCH + SQUARE;
  const height = (Math.max(...rows) - top) * PITCH + SQUARE;

  return (
    <svg
      aria-hidden="true"
      className="flex-none"
      fill="currentColor"
      height={height * scale}
      viewBox={`${left * PITCH} ${top * PITCH} ${width} ${height}`}
      width={width * scale}
    >
      {cells.map(([column, row]) => (
        <rect
          height={SQUARE}
          key={`${column}-${row}`}
          width={SQUARE}
          x={column * PITCH}
          y={row * PITCH}
        />
      ))}
    </svg>
  );
}

function State({ expanded, variant }: { expanded: boolean; variant: Variant }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <div className="flex h-20 items-center text-gray-1200">
        <Mark expanded={expanded} scale={2} variant={variant} />
      </div>
      <div className="grid size-9 place-items-center rounded-full bg-gray-200 text-gray-1200">
        <Mark expanded={expanded} scale={0.5} variant={variant} />
      </div>
      <span className="font-text text-gray-900 text-xs">
        {expanded ? "Expanded" : "Collapsed"}
      </span>
    </div>
  );
}

function Card({ index, variant }: { index: number; variant: Variant }) {
  return (
    <li className="flex flex-col gap-5 rounded-2xl bg-preview-bg p-5 shadow-custom">
      <div className="flex gap-2">
        <State expanded={false} variant={variant} />
        <State expanded variant={variant} />
      </div>
      <div className="flex flex-col gap-1 font-text">
        <h3 className="flex items-baseline gap-2 font-medium text-gray-1200 text-sm">
          <span className="font-mono text-gray-900 text-xs tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
          {variant.name}
          {variant.current && (
            <span className="font-book text-gray-900 text-xs">Current</span>
          )}
        </h3>
        <p className="text-gray-1100 text-sm">{variant.idea}</p>
      </div>
    </li>
  );
}

export default function Page() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col px-6 pt-24 pb-32">
      <header className="flex flex-col gap-2">
        <h1 className="font-demibold font-text text-3xl text-gray-1200 tracking-tight">
          Logo variants
        </h1>
        <p className="max-w-160 font-text text-body text-gray-1100">
          Every mark is drawn from 4 by 4 squares on a 5 unit pitch. Each card
          shows the collapsed and expanded state at four times toolbar size, and
          again at toolbar size inside the trigger.
        </p>
      </header>
      {FAMILIES.map((family, position) => (
        <section key={family.title}>
          <h2 className="mt-16 mb-5 font-demibold font-text text-gray-1200 text-xl">
            {family.title}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {family.variants.map((variant, offset) => (
              <Card
                index={firstIndex(position) + offset}
                key={variant.name}
                variant={variant}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
