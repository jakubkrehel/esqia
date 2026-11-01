import type { PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";

export const CORNERS = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
] as const;
export type Corner = (typeof CORNERS)[number];

interface Point {
  x: number;
  y: number;
}

const THRESHOLD = 5;
const DECELERATION = 0.999;
const SNAP = "translate 480ms cubic-bezier(0.34, 1.25, 0.64, 1)";

const project = (speed: number) =>
  ((speed / 1000) * DECELERATION) / (1 - DECELERATION);

export function startCornerDrag(
  down: ReactPointerEvent<HTMLElement>,
  corner: Corner,
  onCorner: (corner: Corner) => void
) {
  const el = down.currentTarget;
  if (down.button !== 0) {
    return;
  }
  const start = { x: down.clientX, y: down.clientY };
  const rest = el.getBoundingClientRect();
  const offset: Point = { x: 0, y: 0 };
  let samples: { at: number; x: number; y: number }[] = [];
  let dragging = false;

  const move = (event: PointerEvent) => {
    offset.x = event.clientX - start.x;
    offset.y = event.clientY - start.y;
    if (!dragging) {
      if (Math.hypot(offset.x, offset.y) < THRESHOLD) {
        return;
      }
      dragging = true;
      el.setPointerCapture(event.pointerId);
      el.dataset.dragging = "";
      el.style.transition = "none";
      document.body.style.userSelect = "none";
    }
    el.style.translate = `${offset.x}px ${offset.y}px`;
    samples = [
      ...samples.slice(-5),
      { at: event.timeStamp, x: event.clientX, y: event.clientY },
    ];
  };

  const end = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    if (!dragging) {
      return;
    }
    document.body.style.removeProperty("user-select");
    delete el.dataset.dragging;
    el.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => el.removeEventListener("click", swallow, true), 0);
    snap(el, rest, offset, velocity(samples), corner, onCorner);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

function swallow(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function velocity(samples: { at: number; x: number; y: number }[]): Point {
  const first = samples[0];
  const last = samples.at(-1);
  if (!(first && last) || last.at === first.at) {
    return { x: 0, y: 0 };
  }
  const elapsed = last.at - first.at;
  return {
    x: ((last.x - first.x) / elapsed) * 1000,
    y: ((last.y - first.y) / elapsed) * 1000,
  };
}

function snap(
  el: HTMLElement,
  rest: DOMRect,
  offset: Point,
  speed: Point,
  from: Corner,
  onCorner: (corner: Corner) => void
) {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const centerX = rest.left + offset.x + rest.width / 2 + project(speed.x);
  const centerY = rest.top + offset.y + rest.height / 2 + project(speed.y);
  const to: Corner = `${centerY < height / 2 ? "top" : "bottom"}-${
    centerX < width / 2 ? "left" : "right"
  }`;

  const insetX = from.endsWith("left") ? rest.left : width - rest.right;
  const insetY = from.startsWith("top") ? rest.top : height - rest.bottom;
  const target = {
    x: to.endsWith("left") ? insetX : width - insetX - rest.width,
    y: to.startsWith("top") ? insetY : height - insetY - rest.height,
  };
  const shift = { x: target.x - rest.left, y: target.y - rest.top };

  const settle = () => {
    flushSync(() => onCorner(to));
    el.style.removeProperty("translate");
    el.style.removeProperty("transition");
  };

  const still = shift.x === offset.x && shift.y === offset.y;
  if (still || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settle();
    return;
  }
  el.style.transition = SNAP;
  el.style.translate = `${shift.x}px ${shift.y}px`;
  el.addEventListener("transitionend", function done(event) {
    if (event.propertyName !== "translate") {
      return;
    }
    el.removeEventListener("transitionend", done);
    settle();
  });
}
