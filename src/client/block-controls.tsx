import { useEffect, useRef, useState } from "react";
import { Anchored } from "./anchored";
import type { Block } from "./blocks";
import type { SlashItem } from "./commands";
import {
  box,
  dropTarget,
  gutterPosition,
  hitTest,
  measureBlock,
  PAD,
  type Rect,
} from "./geometry";
import { GripIcon, PlusIcon, TrashIcon } from "./icons";
import { MenuItem } from "./menu-item";

interface Drag {
  block: Block;
  line: Rect | null;
  moved: boolean;
}

interface BlockControlsProps {
  host: HTMLElement;
  inserts: SlashItem[];
  onDelete: (block: Block) => void;
  onInsert: (block: Block, item: SlashItem) => void;
  onMove: (block: Block, target: Block | null) => void;
}

export function BlockControls({
  host,
  inserts,
  onMove,
  onInsert,
  onDelete,
}: BlockControlsProps) {
  const [hover, setHover] = useState<Block | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<Block | null>(null);
  const gutter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let pointer = { x: -1, y: -1 };

    const measure = () => {
      frame = 0;
      setHover(hitTest(pointer.x, pointer.y));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.composedPath().includes(host)) {
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
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
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [host]);

  const startDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    block: Block
  ) => {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY };
    let moved = false;
    setDrag({ block, line: null, moved: false });

    const onPointerMove = (move: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 4
      ) {
        return;
      }
      moved = true;
      setDrag({
        block,
        line: dropTarget(block, move.clientY).line,
        moved: true,
      });
    };
    const onPointerUp = (up: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDrag(null);
      setHover(null);
      if (moved) {
        onMove(block, dropTarget(block, up.clientY).target);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const block = drag?.block ?? menu ?? hover;
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
            ref={gutter}
            style={gutterPosition(geometry)}
          />
        </>
      )}
      {drag?.line && (
        <div
          className="indicator"
          style={{
            left: drag.line.left,
            top: drag.line.top,
            width: drag.line.width,
          }}
        />
      )}
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
    </>
  );
}

function Gutter({
  adding,
  gripping,
  onAdd,
  onDelete,
  onGrip,
  ref,
  style,
}: {
  adding: boolean;
  gripping: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onGrip: (event: React.PointerEvent<HTMLButtonElement>) => void;
  ref: React.Ref<HTMLDivElement>;
  style: React.CSSProperties;
}) {
  return (
    <div className="gutter" ref={ref} style={style}>
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
