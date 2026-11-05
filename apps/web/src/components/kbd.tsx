import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={`inline-flex h-6 min-w-6 flex-none select-none items-center justify-center rounded-md border border-preview-border bg-preview-bg px-1.5 align-middle font-[450] font-sans text-[12px] text-gray-1100 uppercase ${children === "⌘" ? "pt-[0.5px]" : ""}`}
    >
      {children}
    </kbd>
  );
}
