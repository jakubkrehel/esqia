"use client";

import { useSyncExternalStore } from "react";

export const GROUPS = [
  {
    id: "current",
    label: "Current",
    variants: [{ id: "arrow", label: "Arrow" }],
  },
  {
    id: "beacon",
    label: "Beacon",
    variants: [
      { id: "points", label: "Points" },
      { id: "opens", label: "Opens" },
      { id: "names", label: "Names the button" },
    ],
  },
] as const;

export type VariantId = (typeof GROUPS)[number]["variants"][number]["id"];

export const ORDER: VariantId[] = GROUPS.flatMap((group) =>
  group.variants.map((variant) => variant.id)
);

const PARAM = "__pointer";
const CHANGE = "variantchange";
const FALLBACK: VariantId = "points";

function read(): VariantId {
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return ORDER.find((id) => id === value) ?? FALLBACK;
}

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(CHANGE, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHANGE, notify);
  };
}

export const useVariant = () =>
  useSyncExternalStore(subscribe, read, () => FALLBACK);

export function setVariant(id: VariantId) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(CHANGE));
}
