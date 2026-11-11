"use client";

import {
  AnimatePresence,
  m,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
import { POP_SMALL, REST, SPRING_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SwapProps {
  children: React.ReactNode;
  className?: string;
  from?: TargetAndTransition;
  mode?: "popLayout" | "wait";
  static?: boolean;
  to?: TargetAndTransition;
  transition?: Transition;
  value: string;
}

export default function Swap({
  children,
  className,
  from = POP_SMALL,
  mode = "popLayout",
  static: isStatic = false,
  to = from,
  transition = SPRING_FAST,
  value,
}: SwapProps) {
  if (isStatic) {
    return children;
  }

  return (
    <AnimatePresence initial={false} mode={mode}>
      <m.span
        animate={REST}
        className={cn(
          "flex items-center justify-center will-change-transform",
          className
        )}
        exit={to}
        initial={from}
        key={value}
        transition={transition}
      >
        {children}
      </m.span>
    </AnimatePresence>
  );
}
