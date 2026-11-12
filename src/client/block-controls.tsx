import { useEffect, useRef, useState } from "react";
import { EDITABLE } from "../shared/markdown";
import { Anchored } from "./anchored";
import type { Block } from "./blocks";
import type { SlashItem } from "./commands";
import {
  box,
  dropTarget,
  edgeScroll,
  gutterPosition,
  hitTest,
  measureBlock,
  PAD,
  type Rect,
  tagPosition,
} from "./geometry";
import { CodeIcon, GripIcon, PlusIcon, TrashIcon } from "./icons";
import { MenuItem } from "./menu-item";
import type { SourceDraft } from "./source-draft";
import { SourcePanel } from "./source-panel";

const MODIFIERS = new Set(["Alt", "Control", "Meta", "Shift"]);
const TYPING_PAUSE = 600;

type LineOf = (block: Pick<Block, "file" | "start">) => Promise<number>;

interface Drag {
  block: Block;
  glide: boolean;
  line: Rect | null;
  moved: boolean;
}

interface BlockControlsProps {
  host: HTMLElement;
  inserts: SlashItem[];
  lineOf?: LineOf;
  onDelete: (block: Block) => void;
  onInsert: (block: Block, item: SlashItem) => void;
  onMove: (block: Block, target: Block | null) => void;
  onOpen?: (block: Block) => void;
  onSource?: (block: Block) => void;
  source: SourceDraft | null;
}

export function BlockControls({
  host,
  inserts,
  lineOf,
  onMove,
  onInsert,
  onDelete,
  onOpen,
  onSource,
  source,
}: BlockControlsProps) {
  const [hover, setHover] = useState<Block | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<Block | null>(null);
  const gutter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let pointer = { x: -1, y: -1 };
    let typing = false;
    let pause: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      frame = 0;
      setHover(typing ? null : hitTest(pointer.x, pointer.y));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      typing = false;
      clearTimeout(pause);
      schedule();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        MODIFIERS.has(event.key) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !(target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      typing = true;
      clearTimeout(pause);
      pause = setTimeout(() => {
        typing = false;
        schedule();
      }, TYPING_PAUSE);
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.composedPath().includes(host)) {
        setMenu(null);
      }
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(pause);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [host]);

  const startDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    block: Block
  ) => {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY };
    let y = origin.y;
    let moved = false;
    let frame = 0;
    setDrag({ block, glide: false, line: null, moved: false });

    const place = (glide: boolean) =>
      setDrag({ block, glide, line: dropTarget(block, y).line, moved: true });
    const onPointerMove = (move: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 4
      ) {
        return;
      }
      moved = true;
      y = move.clientY;
      place(true);
    };
    const onScroll = () => {
      if (moved) {
        place(false);
      }
    };
    const scrollAtEdge = () => {
      const speed = moved ? edgeScroll(y) : 0;
      if (speed) {
        window.scrollBy({ behavior: "instant", top: speed });
      }
      frame = requestAnimationFrame(scrollAtEdge);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown, true);
      setDrag(null);
      setHover(null);
    };
    const onPointerUp = (up: PointerEvent) => {
      stop();
      if (moved) {
        onMove(block, dropTarget(block, up.clientY).target);
      }
    };
    const onKeyDown = (key: KeyboardEvent) => {
      if (key.key === "Escape") {
        key.preventDefault();
        key.stopPropagation();
        stop();
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", onKeyDown, true);
    frame = requestAnimationFrame(scrollAtEdge);
  };

  const block = drag?.block ?? menu ?? source?.block ?? hover;
  const geometry = block && measureBlock(block);

  return (
    <>
      {block && geometry && (
        <>
          <div
            className={drag?.moved ? "outline dragging" : "outline"}
            style={{
              ...box(geometry.rect),
              borderRadius: geometry.radius ? geometry.radius + PAD : undefined,
            }}
          />
          <Gutter
            adding={Boolean(menu)}
            gripping={Boolean(drag)}
            onAdd={() => setMenu(menu ? null : block)}
            onDelete={() => {
              setHover(null);
              onDelete(block);
            }}
            onGrip={(event) => startDrag(event, block)}
            onSource={
              onSource && !EDITABLE.has(block.type)
                ? () => {
                    setMenu(null);
                    onSource(block);
                  }
                : undefined
            }
            ref={gutter}
            sourcing={source?.block.el === block.el}
            style={gutterPosition(geometry)}
          />
          <OpenTag
            block={block}
            hidden={Boolean(drag)}
            lineOf={lineOf}
            style={tagPosition(geometry)}
          />
        </>
      )}
      <DropLine drag={drag} />
      {menu && (
        <Anchored
          className="panel menu"
          context={menu.el}
          placement="bottom-start"
          rect={() => gutter.current?.getBoundingClientRect() ?? null}
        >
          {inserts.map((item) => (
            <MenuItem
              hint={item.hint}
              key={item.label}
              label={item.label}
              onSelect={() => {
                setMenu(null);
                onInsert(menu, item);
              }}
            />
          ))}
        </Anchored>
      )}
      {source && (
        <SourcePanel
          anchor={gutter}
          draft={source}
          onOpen={onOpen ? () => onOpen(source.block) : undefined}
        />
      )}
    </>
  );
}

function DropLine({ drag }: { drag: Drag | null }) {
  if (!drag?.line) {
    return null;
  }
  const { left, top, width } = drag.line;
  return (
    <div
      className="indicator"
      data-glide={drag.glide ? "" : undefined}
      style={{ left, top, width }}
    />
  );
}

function OpenTag({
  block,
  hidden,
  lineOf,
  style,
}: {
  block: Block;
  hidden: boolean;
  lineOf?: LineOf;
  style: React.CSSProperties;
}) {
  const [alt, setAlt] = useState(false);
  const opening = alt && lineOf !== undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setAlt(event.altKey);
    const onPointerMove = (event: PointerEvent) => setAlt(event.altKey);
    const onBlur = () => setAlt(false);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!opening) {
      return;
    }
    document.documentElement.dataset.esqiaOpen = "";
    return () => {
      delete document.documentElement.dataset.esqiaOpen;
    };
  }, [opening]);

  if (!opening || hidden) {
    return null;
  }
  return (
    <OpenLabel
      block={block}
      key={`${block.file}:${block.start}`}
      lineOf={lineOf}
      style={style}
    />
  );
}

function OpenLabel({
  block,
  lineOf,
  style,
}: {
  block: Block;
  lineOf: LineOf;
  style: React.CSSProperties;
}) {
  const [line, setLine] = useState<number | null>(null);
  const { file, start } = block;

  useEffect(() => {
    let current = true;
    lineOf({ file, start })
      .then((found) => current && setLine(found))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [file, start, lineOf]);

  return (
    <div className="tag" style={style}>
      {file.split("/").at(-1)}
      {line !== null && `:${line}`}
    </div>
  );
}

function Gutter({
  adding,
  gripping,
  onAdd,
  onDelete,
  onGrip,
  onSource,
  ref,
  sourcing,
  style,
}: {
  adding: boolean;
  gripping: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onGrip: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSource?: () => void;
  ref: React.Ref<HTMLDivElement>;
  sourcing: boolean;
  style: React.CSSProperties;
}) {
  return (
    <div className="gutter" ref={ref} style={style}>
      {onSource && (
        <button
          aria-expanded={sourcing}
          aria-label="Edit source"
          data-active={sourcing ? "" : undefined}
          onClick={onSource}
          type="button"
        >
          <CodeIcon />
        </button>
      )}
      <button aria-label="Delete block" onClick={onDelete} type="button">
        <TrashIcon />
      </button>
      <button
        aria-expanded={adding}
        aria-label="Add below"
        data-active={adding ? "" : undefined}
        onClick={onAdd}
        type="button"
      >
        <PlusIcon />
      </button>
      <button
        aria-label="Drag to move"
        className="grip"
        data-active={gripping ? "" : undefined}
        onPointerDown={onGrip}
        type="button"
      >
        <GripIcon />
      </button>
    </div>
  );
}
