"use client";

import { Fragment, useSyncExternalStore } from "react";
import { Kbd } from "@/components/kbd";

const OTHER_PLATFORMS: Record<string, string> = { "⌘": "Ctrl", "⌥": "Alt" };

const subscribe = () => () => undefined;
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);
const assumeApple = () => true;

export function Keys({ keys, spaced }: { keys: string[]; spaced?: boolean }) {
  const apple = useSyncExternalStore(subscribe, isApple, assumeApple);
  return keys.map((key, index) => (
    <Fragment key={key}>
      {spaced && index > 0 && " "}
      <Kbd>{apple ? key : (OTHER_PLATFORMS[key] ?? key)}</Kbd>
    </Fragment>
  ));
}
