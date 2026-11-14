"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { EsqiaMarkIcon } from "@/components/icons";

interface Ping {
  key: number;
  to: DOMRect;
}

const ABOVE_TOOLBAR = 2_147_483_647;
const RINGS = [0, 1, 2] as const;
const RING_EVERY = 0.3;
const RING_FOR = 1.1;
const VISIBLE_FOR = 1900;

const findTrigger = () =>
  document
    .querySelector("esqia-ui")
    ?.shadowRoot?.querySelector<HTMLElement>(".trigger");

export function ClickHere({ children }: { children: ReactNode }) {
  const [ping, setPing] = useState<Ping | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!ping) {
      return;
    }
    const timer = setTimeout(() => setPing(null), VISIBLE_FOR);
    return () => clearTimeout(timer);
  }, [ping]);

  const point = () => {
    const trigger = findTrigger();
    if (!trigger) {
      return;
    }
    trigger.animate(
      reducedMotion ? { opacity: [1, 0.3, 1] } : { scale: [1, 1.25, 1] },
      { duration: 450, easing: "ease-out" }
    );
    if (!reducedMotion) {
      setPing({ key: Date.now(), to: trigger.getBoundingClientRect() });
    }
  };

  return (
    <>
      <button
        className="article-underline cursor-pointer whitespace-nowrap"
        onClick={point}
        type="button"
      >
        <EsqiaMarkIcon className="mr-1 mb-0.5 inline-block h-3 w-4.25" />
        {children}
      </button>
      <AnimatePresence>
        {ping && (
          <m.span
            aria-hidden="true"
            className="pointer-events-none fixed"
            exit={{ opacity: 0 }}
            key={ping.key}
            style={{
              height: ping.to.height,
              left: ping.to.left,
              top: ping.to.top,
              width: ping.to.width,
              zIndex: ABOVE_TOOLBAR,
            }}
          >
            {RINGS.map((ring) => (
              <m.span
                animate={{ opacity: [0, 0.7, 0], scale: [1, 2.8] }}
                className="absolute inset-0 rounded-full border-2 border-gray-1200"
                initial={{ opacity: 0, scale: 1 }}
                key={ring}
                transition={{
                  delay: ring * RING_EVERY,
                  duration: RING_FOR,
                  ease: "easeOut",
                  opacity: {
                    delay: ring * RING_EVERY,
                    duration: RING_FOR,
                    times: [0, 0.15, 1],
                  },
                }}
              />
            ))}
          </m.span>
        )}
      </AnimatePresence>
    </>
  );
}
