"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface Arrow {
  head: string;
  key: number;
  shaft: string;
}

const GAP = 10;
const MIN_LENGTH = 80;
const STEPS = 8;
const BOW = 0.18;
const WOBBLE = 0.006;
const HEAD_LENGTH = 12;
const HEAD_SPREAD = 0.5;
const VISIBLE_FOR = 2000;
const DRAW = 0.6;
const EASE = [0.2, 0, 0, 1] as const;

const center = (rect: DOMRect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

function edge(rect: DOMRect, toward: Point): Point {
  const from = center(rect);
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const reach =
    Math.min(rect.width / 2 / Math.abs(dx), rect.height / 2 / Math.abs(dy)) +
    GAP / Math.hypot(dx, dy);
  return { x: from.x + dx * reach, y: from.y + dy * reach };
}

const at = ({ x, y }: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

function sketch(from: DOMRect, to: DOMRect): Omit<Arrow, "key"> | null {
  const start = edge(from, center(to));
  const end = edge(to, center(from));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_LENGTH) {
    return null;
  }
  const normal = { x: -dy / length, y: dx / length };
  const control = {
    x: start.x + dx / 2 + normal.x * length * BOW,
    y: start.y + dy / 2 + normal.y * length * BOW,
  };
  const points = Array.from({ length: STEPS + 1 }, (_, index) => {
    const t = index / STEPS;
    const wobble = Math.sin(t * Math.PI * 3) * length * WOBBLE;
    return {
      x:
        (1 - t) ** 2 * start.x +
        2 * (1 - t) * t * control.x +
        t ** 2 * end.x +
        normal.x * wobble,
      y:
        (1 - t) ** 2 * start.y +
        2 * (1 - t) * t * control.y +
        t ** 2 * end.y +
        normal.y * wobble,
    };
  });
  const curves = points.slice(1, -1).map((point, index) => {
    const next = points[index + 2];
    const through =
      index === STEPS - 2
        ? next
        : { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    return `Q ${at(point)} ${at(through)}`;
  });
  const before = points[STEPS - 1];
  const angle = Math.atan2(end.y - before.y, end.x - before.x);
  const wing = (spread: number, size: number) => ({
    x: end.x - Math.cos(angle + spread) * size,
    y: end.y - Math.sin(angle + spread) * size,
  });
  return {
    head: `M ${at(wing(HEAD_SPREAD, HEAD_LENGTH))} L ${at(end)} L ${at(wing(-HEAD_SPREAD, HEAD_LENGTH * 0.85))}`,
    shaft: `M ${at(start)} ${curves.join(" ")}`,
  };
}

const findTrigger = () =>
  document
    .querySelector("esqia-ui")
    ?.shadowRoot?.querySelector<HTMLElement>(".trigger");

export function ClickHere({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [arrow, setArrow] = useState<Arrow | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!arrow) {
      return;
    }
    const timer = setTimeout(() => setArrow(null), VISIBLE_FOR);
    return () => clearTimeout(timer);
  }, [arrow]);

  const pulse = () => {
    findTrigger()?.animate(
      reducedMotion ? { opacity: [1, 0.3, 1] } : { scale: [1, 1.25, 1] },
      { duration: 450, easing: "ease-out" }
    );
  };

  const point = () => {
    const trigger = findTrigger();
    if (!(trigger && ref.current)) {
      return;
    }
    const drawn = reducedMotion
      ? null
      : sketch(
          ref.current.getBoundingClientRect(),
          trigger.getBoundingClientRect()
        );
    if (drawn) {
      setArrow({ ...drawn, key: Date.now() });
    } else {
      pulse();
    }
  };

  return (
    <>
      <button
        className="article-underline cursor-pointer"
        onClick={point}
        ref={ref}
        type="button"
      >
        {children}
      </button>
      <AnimatePresence>
        {arrow && (
          <m.svg
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-50 size-full text-gray-1200"
            exit={{ opacity: 0 }}
            fill="none"
            key={arrow.key}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          >
            <m.path
              animate={{ opacity: 1, pathLength: 1 }}
              d={arrow.shaft}
              initial={{ opacity: 0, pathLength: 0 }}
              transition={{
                duration: DRAW,
                ease: EASE,
                opacity: { duration: 0.01 },
              }}
            />
            <m.path
              animate={{ opacity: 1, pathLength: 1 }}
              d={arrow.head}
              initial={{ opacity: 0, pathLength: 0 }}
              onAnimationComplete={pulse}
              transition={{
                delay: DRAW - 0.1,
                duration: 0.2,
                ease: EASE,
                opacity: { delay: DRAW - 0.1, duration: 0.01 },
              }}
            />
          </m.svg>
        )}
      </AnimatePresence>
    </>
  );
}
