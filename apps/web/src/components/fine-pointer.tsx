"use client";

import { type ReactNode, useSyncExternalStore } from "react";

const FINE_POINTER = "(pointer: fine)";

function subscribe(onChange: () => void) {
  const media = matchMedia(FINE_POINTER);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const hasFinePointer = () => matchMedia(FINE_POINTER).matches;
const assumeCoarse = () => false;

export function FinePointer({ children }: { children: ReactNode }) {
  const fine = useSyncExternalStore(subscribe, hasFinePointer, assumeCoarse);
  return fine ? children : null;
}
