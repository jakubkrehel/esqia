"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { ClickHere } from "@/components/click-here";
import { EsqiaMarkIcon } from "@/components/icons";
import { useVariant, type VariantId } from "./store";

type Mode = Exclude<VariantId, "arrow">;

interface Ping {
  key: number;
  to: DOMRect;
}

const ABOVE_TOOLBAR = 2_147_483_647;
const RINGS = [0, 1, 2] as const;
const VISIBLE_FOR = 1900;

const findTrigger = () =>
  document
    .querySelector("esqia-ui")
    ?.shadowRoot?.querySelector<HTMLElement>(".trigger");

function Rings({ to }: { to: DOMRect }) {
  return (
    <m.span
      aria-hidden="true"
      className="pointer-events-none fixed"
      exit={{ opacity: 0 }}
      style={{
        height: to.height,
        left: to.left,
        top: to.top,
        width: to.width,
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
            delay: ring * 0.3,
            duration: 1.1,
            ease: "easeOut",
            opacity: { delay: ring * 0.3, duration: 1.1, times: [0, 0.15, 1] },
          }}
        />
      ))}
    </m.span>
  );
}

function BeaconLink({ children, mode }: { children: ReactNode; mode: Mode }) {
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
    if (mode === "opens" && trigger.getAttribute("aria-pressed") !== "true") {
      trigger.click();
    }
    trigger.animate(
      reducedMotion ? { opacity: [1, 0.3, 1] } : { scale: [1, 1.25, 1] },
      { duration: 450, easing: "ease-out" }
    );
    if (!reducedMotion) {
      setPing({ key: Date.now(), to: trigger.getBoundingClientRect() });
    }
  };

  const mark = (
    <EsqiaMarkIcon className="mr-1 mb-0.5 inline-block h-3 w-4.25" />
  );

  return (
    <>
      {mode === "names" && "use "}
      <button
        className="article-underline cursor-pointer whitespace-nowrap"
        onClick={point}
        type="button"
      >
        {mode === "names" ? (
          <>the {mark}button</>
        ) : (
          <>
            {mark}
            {children}
          </>
        )}
      </button>
      <AnimatePresence>
        {ping && <Rings key={ping.key} to={ping.to} />}
      </AnimatePresence>
    </>
  );
}

export function ClickHereVariants({ children }: { children: ReactNode }) {
  const variant = useVariant();
  if (variant === "arrow") {
    return <ClickHere>{children}</ClickHere>;
  }
  return <BeaconLink mode={variant}>{children}</BeaconLink>;
}
