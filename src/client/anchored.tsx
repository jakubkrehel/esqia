import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

const closed = () => null;

export function Anchored({
  rect,
  context,
  placement,
  open = true,
  gap = 6,
  className,
  role,
  label,
  children,
}: {
  rect: () => DOMRect | null;
  context: Element;
  placement: Placement;
  open?: boolean;
  gap?: number;
  className: string;
  role?: string;
  label?: string;
  children: ReactNode;
}) {
  const [present, setPresent] = useState(open);
  if (open && !present) {
    setPresent(true);
  }
  const readRect = useRef<() => DOMRect | null>(closed);
  const lastRect = useRef<DOMRect | null>(null);
  const {
    refs: { setFloating, setReference },
    floatingStyles,
    isPositioned,
    placement: placed,
    update,
  } = useFloating({
    middleware: [offset(gap), flip({ padding: 8 }), shift({ padding: 8 })],
    placement,
    strategy: "fixed",
    transform: false,
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    setReference({
      contextElement: context,
      getBoundingClientRect: () => {
        const current = readRect.current();
        if (current) {
          lastRect.current = current;
        }
        return current ?? lastRect.current ?? new DOMRect();
      },
    });
  }, [setReference, context]);

  useLayoutEffect(() => {
    readRect.current = open ? rect : closed;
    if (open) {
      update();
    }
  });

  const skipExit =
    !isPositioned || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!present || (!open && skipExit)) {
    return null;
  }
  const state = open ? "open" : "closed";

  return (
    <div
      aria-label={label}
      className={className}
      data-placement={placed}
      data-state={isPositioned ? state : undefined}
      onAnimationEnd={(event) => {
        if (!open && event.target === event.currentTarget) {
          setPresent(false);
        }
      }}
      ref={setFloating}
      role={role}
      style={{
        ...floatingStyles,
        visibility: isPositioned ? undefined : "hidden",
      }}
    >
      {children}
    </div>
  );
}
