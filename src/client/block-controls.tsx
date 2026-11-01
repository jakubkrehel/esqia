import { useEffect, useRef, useState } from "react";
import { LINE_BREAK } from "../shared/ops";
import { Anchored } from "./anchored";
import type { Block } from "./blocks";
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
import type { OpenTarget } from "./session";

interface Drag {
  block: Block;
  line: Rect | null;
  moved: boolean;
}

type MenuKind = "add" | "block";

interface BlockAction {
  hint?: string;
  label: string;
  select: (block: Block) => void;
  tone?: "danger";
}

interface BlockControlsProps {
  host: HTMLElement;
  onActivate: (target: OpenTarget) => void;
  onBreak: (block: Block) => void;
  onDelete: (block: Block) => void;
  onMove: (block: Block, target: Block | null) => void;
}

export function BlockControls({
  host,
  onActivate,
  onMove,
  onBreak,
  onDelete,
}: BlockControlsProps) {
  const [hover, setHover] = useState<Block | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<{ block: Block; kind: MenuKind } | null>(
    null
  );
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
      } else if (measureBlock(block)) {
        setMenu({ block, kind: "block" });
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const addParagraph = (block: Block) => onActivate({ at: "after", block });
  const actions: Record<MenuKind, BlockAction[]> = {
    add: [
      { label: "Paragraph", select: addParagraph },
      { hint: LINE_BREAK, label: "Line break", select: onBreak },
    ],
    block: [
      { label: "Add paragraph below", select: addParagraph },
      { label: "Delete block", select: onDelete, tone: "danger" },
    ],
  };

  const block = drag?.block ?? menu?.block ?? hover;
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
            adding={menu?.kind === "add"}
            gripping={Boolean(drag) || menu?.kind === "block"}
            onAdd={() =>
              setMenu(menu?.kind === "add" ? null : { block, kind: "add" })
            }
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
          context={menu.block.el}
          placement="bottom-start"
          rect={() => gutter.current?.getBoundingClientRect() ?? null}
        >
          {actions[menu.kind].map((action) => (
            <MenuItem
              hint={action.hint}
              key={action.label}
              label={action.label}
              onSelect={() => {
                setMenu(null);
                action.select(menu.block);
              }}
              tone={action.tone}
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
        aria-label="Drag to move, click for options"
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
