"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { GROUPS, ORDER, setVariant, useVariant, type VariantId } from "./store";
import "./picker.css";

const STEP: Record<string, number> = { "[": -1, "]": 1 };

function typing(event: KeyboardEvent) {
  const target = event.composedPath()[0];
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

export function VariantHarness({ children }: { children: ReactNode }) {
  const active = useVariant();
  const [hidden, setHidden] = useState(false);
  const list = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        typing(event)
      ) {
        return;
      }
      if (event.key.toLowerCase() === "h") {
        setHidden((value) => !value);
        return;
      }
      const step = STEP[event.key];
      if (!step) {
        return;
      }
      event.preventDefault();
      const index = ORDER.indexOf(active);
      setVariant(ORDER[(index + step + ORDER.length) % ORDER.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    list.current
      ?.querySelector(`[data-variant="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="pointer-variant-page" data-hidden={hidden ? "" : undefined}>
      <div className="pointer-variant-layout">
        <nav
          aria-label="Variants"
          className="pointer-variant-picker"
          ref={list}
        >
          {GROUPS.map((group) => (
            <div
              aria-labelledby={`variants-${group.id}`}
              className="pointer-variant-picker-group"
              key={group.id}
              role="group"
            >
              <span
                className="pointer-variant-picker-heading"
                id={`variants-${group.id}`}
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="12"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  viewBox="0 0 16 16"
                  width="12"
                >
                  <path d="M3 3v4a3 3 0 0 0 3 3h7" />
                  <path d="m10 7 3 3-3 3" />
                </svg>
                {group.label}
              </span>
              {group.variants.map((variant) => (
                <button
                  aria-pressed={variant.id === active}
                  data-variant={variant.id}
                  key={variant.id}
                  onClick={() => setVariant(variant.id)}
                  type="button"
                >
                  {variant.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="pointer-variant-picker-select">
          <select
            aria-label="Variant"
            onChange={(event) => setVariant(event.target.value as VariantId)}
            value={active}
          >
            {GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <svg
            aria-hidden="true"
            fill="none"
            height="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 16 16"
            width="12"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </div>

        <div className="pointer-variant-stage">{children}</div>
      </div>
    </div>
  );
}
