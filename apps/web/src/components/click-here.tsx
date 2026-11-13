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
const LANDING_TURN = 0.8;
const MIN_LENGTH = 80;
const STEPS = 64;
const BOW = 0.18;
const WOBBLE = 0.012;
const MAX_WOBBLE = 3.5;
const LOOP_AT = 0.45;
const LOOP_SIZE = 0.15;
const MIN_LOOP = 14;
const MAX_LOOP = 34;
const LOOP_STRETCH = 1.2;
const LOOP_TIGHTNESS = 2.8;
const HEAD_LENGTH = 13;
const HEAD_SPREAD = 0.5;
const VISIBLE_FOR = 2500;
const DRAW = 1.1;
const EASE = [0.2, 0, 0, 1] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const vary = (amount: number) => 1 + (Math.random() - 0.5) * amount;

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
  const target = center(to);
  const start = edge(from, target);
  const landing =
    Math.atan2(start.y - target.y, start.x - target.x) - LANDING_TURN;
  const reach = Math.min(to.width, to.height) / 2 + GAP;
  const end = {
    x: target.x + Math.cos(landing) * reach,
    y: target.y + Math.sin(landing) * reach,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_LENGTH) {
    return null;
  }
  const along = { x: dx / length, y: dy / length };
  const normal = { x: -along.y, y: along.x };
  const bow = length * BOW * vary(0.5);
  const sway = Math.min(length * WOBBLE, MAX_WOBBLE);
  const slow = Math.random() * Math.PI * 2;
  const fast = Math.random() * Math.PI * 2;
  const radius = clamp(length * LOOP_SIZE, MIN_LOOP, MAX_LOOP) * vary(0.2);
  const stretch = LOOP_STRETCH * vary(0.3);
  const span = (Math.PI * 2 * radius * stretch) / (LOOP_TIGHTNESS * length);
  const loopStart = LOOP_AT * vary(0.25) - span / 2;
  const points = Array.from({ length: STEPS + 1 }, (_, index) => {
    const t = index / STEPS;
    const turn = clamp((t - loopStart) / span, 0, 1) * Math.PI * 2;
    const drift =
      Math.sin(t * Math.PI) *
      sway *
      (Math.sin(t * 7 + slow) + 0.5 * Math.sin(t * 17 + fast));
    const forward = radius * stretch * Math.sin(turn);
    const sideways =
      2 * t * (1 - t) * bow + radius * (1 - Math.cos(turn)) + drift;
    return {
      x: start.x + dx * t + along.x * forward + normal.x * sideways,
      y: start.y + dy * t + along.y * forward + normal.y * sideways,
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
  const before = points[STEPS - 4];
  const angle = Math.atan2(end.y - before.y, end.x - before.x);
  const wing = (spread: number, size: number) => ({
    x: end.x - Math.cos(angle + spread) * size,
    y: end.y - Math.sin(angle + spread) * size,
  });
  const upper = wing(HEAD_SPREAD * vary(0.4), HEAD_LENGTH * vary(0.3));
  const lower = wing(-HEAD_SPREAD * vary(0.4), HEAD_LENGTH * 0.85 * vary(0.3));
  return {
    head: `M ${at(upper)} L ${at(end)} L ${at(lower)}`,
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
